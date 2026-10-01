"""Admin management API, business rule, and tenant-scoping tests."""

import json
import unittest
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from pydantic import ValidationError
from supabase import ClientOptions, create_client

from app.core.config import Settings
from app.main import create_app
from app.repositories.admin_records_repository import AdminRecordsRepository, search_term
from app.repositories.errors import RecordChangedError, RecordNotFoundError
from app.schemas.admin_records import (
    AdminCompanySettingsUpdate,
    AdminKnowledgeUpdate,
    AdminPricingRuleCreate,
    AdminPricingRuleUpdate,
    AdminServiceCreate,
    AdminServiceUpdate,
)
from app.services.admin_records_service import AdminRecordConflictError, AdminRecordsService

ADMIN_HEADERS = {"X-Admin-API-Key": "admin-test-key-not-real"}
NOW = datetime(2026, 9, 30, 12, 0, tzinfo=UTC)


def service_row(service_id, name="Product Photography", *, pricing_type="per_image", is_active=True):
    return {
        "id": str(service_id), "name": name, "category": "Product", "description": None,
        "pricing_type": pricing_type, "is_active": is_active,
        "created_at": NOW.isoformat(), "updated_at": NOW.isoformat(),
    }


def rule_row(rule_id, service_id, rule_type="per_image", value="25", condition=None, *, active=True):
    return {
        "id": str(rule_id), "service_id": str(service_id), "service_name": "Product Photography",
        "service_is_active": active, "rule_type": rule_type, "value": value,
        "condition": condition or {}, "created_at": NOW.isoformat(), "updated_at": NOW.isoformat(),
    }


class FakeRecordsRepository:
    """In-memory stand-in exposing only what the service layer calls."""

    def __init__(self, company_id):
        self.company_id = str(company_id)
        self.services: dict[str, dict] = {}
        self.rules: dict[str, dict] = {}
        self.updates: list[tuple] = []
        self.deleted: list[str] = []

    async def get_service(self, service_id):
        return self.services.get(str(service_id))

    async def service_names(self):
        return [{"id": row["id"], "name": row["name"]} for row in self.services.values()]

    async def create_service(self, payload):
        row = service_row(uuid4(), payload["name"], pricing_type=payload["pricing_type"])
        self.services[row["id"]] = row
        return row

    async def update_service(self, service_id, payload, expected):
        self.updates.append(("services", str(service_id), payload, expected))
        return {**self.services[str(service_id)], **payload}

    async def delete_service(self, service_id):
        self.deleted.append(str(service_id))
        return {"id": str(service_id)}

    async def list_pricing_rules(self, *, service_id=None):
        return [row for row in self.rules.values() if service_id is None or row["service_id"] == str(service_id)]

    async def get_pricing_rule(self, rule_id):
        return self.rules.get(str(rule_id))

    async def create_pricing_rule(self, payload):
        row = rule_row(uuid4(), payload["service_id"], payload["rule_type"], payload["value"], payload["condition"])
        self.rules[row["id"]] = row
        return row

    async def update_pricing_rule(self, rule_id, payload, expected):
        self.updates.append(("pricing_rules", str(rule_id), payload, expected))
        self.rules[str(rule_id)].update(payload)
        return self.rules[str(rule_id)]

    async def delete_pricing_rule(self, rule_id):
        self.deleted.append(str(rule_id))
        return {"id": str(rule_id)}

    async def update_knowledge(self, document_id, payload, expected):
        self.updates.append(("knowledge_documents", str(document_id), payload, expected))
        return {
            "id": str(document_id), "title": payload.get("title", "FAQ"), "content": payload.get("content", "Text"),
            "embedding_model": payload.get("embedding_model"),
            "created_at": NOW.isoformat(), "updated_at": NOW.isoformat(),
        }


class FakeEmbeddings:
    configured = True
    model_name = "test-embedding-model"

    async def create_embedding(self, text):
        return [0.1, 0.2]


class AdminRecordsServiceRuleTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.company = uuid4()
        self.repository = FakeRecordsRepository(self.company)
        self.service = AdminRecordsService(self.company, repository=self.repository)
        self.product = uuid4()
        self.repository.services[str(self.product)] = service_row(self.product)

    def add_rule(self, rule_type="per_image", value="25", condition=None, *, active=True):
        rule_id = uuid4()
        self.repository.rules[str(rule_id)] = rule_row(rule_id, self.product, rule_type, value, condition, active=active)
        return rule_id

    async def test_repository_must_belong_to_configured_company(self):
        with self.assertRaises(ValueError):
            AdminRecordsService(uuid4(), repository=self.repository)

    async def test_service_names_must_stay_unique_for_exact_name_lookups(self):
        with self.assertRaises(AdminRecordConflictError):
            await self.service.create_service(AdminServiceCreate(name="  product photography ", pricing_type="per_image"))
        renamed = await self.service.update_service(
            self.product, AdminServiceUpdate(name="Product Photography", expected_updated_at=NOW),
        )
        self.assertEqual(renamed.name, "Product Photography")

    async def test_pricing_type_change_requires_rate_rules_to_be_replaced_first(self):
        self.add_rule()
        with self.assertRaises(AdminRecordConflictError):
            await self.service.update_service(
                self.product, AdminServiceUpdate(pricing_type="fixed", expected_updated_at=NOW),
            )
        self.assertEqual(self.repository.updates, [])

    async def test_service_with_pricing_rules_cannot_be_deleted(self):
        self.add_rule()
        with self.assertRaises(AdminRecordConflictError):
            await self.service.delete_service(self.product)
        self.assertEqual(self.repository.deleted, [])

    async def test_unknown_service_is_not_found_before_any_write(self):
        with self.assertRaises(RecordNotFoundError):
            await self.service.create_pricing_rule(AdminPricingRuleCreate(
                service_id=uuid4(), rule_type="per_image", value=Decimal("10"),
            ))

    async def test_rate_rules_are_unique_nonnegative_and_unconditioned(self):
        self.add_rule()
        cases = [
            AdminPricingRuleCreate(service_id=self.product, rule_type="per_image", value=Decimal("30")),
            AdminPricingRuleCreate(service_id=self.product, rule_type="base", value=Decimal("-1")),
            AdminPricingRuleCreate(service_id=self.product, rule_type="base", value=Decimal("5"), condition={"x": 1}),
            AdminPricingRuleCreate(service_id=self.product, rule_type="addon", value=Decimal("5"), condition={"code": "rush"}),
        ]
        for payload in cases:
            with self.subTest(payload=payload), self.assertRaises(AdminRecordConflictError):
                await self.service.create_pricing_rule(payload)
        self.assertEqual(len(self.repository.rules), 1)

    async def test_addon_codes_are_unique_per_service(self):
        await self.service.create_pricing_rule(AdminPricingRuleCreate(
            service_id=self.product, rule_type="addon", value=Decimal("5"),
            condition={"code": "rush", "pricing_type": "fixed"},
        ))
        with self.assertRaises(AdminRecordConflictError):
            await self.service.create_pricing_rule(AdminPricingRuleCreate(
                service_id=self.product, rule_type="addon", value=Decimal("7"),
                condition={"code": "rush", "pricing_type": "per_image"},
            ))

    async def test_rule_update_keeps_service_association_and_passes_concurrency_token(self):
        rule_id = self.add_rule()
        updated = await self.service.update_pricing_rule(
            rule_id, AdminPricingRuleUpdate(value=Decimal("27.5"), expected_updated_at=NOW),
        )
        self.assertEqual(updated.service_id, self.product)
        table, record_id, payload, expected = self.repository.updates[-1]
        self.assertEqual((table, record_id, expected), ("pricing_rules", str(rule_id), NOW))
        self.assertNotIn("service_id", payload)
        self.assertEqual(Decimal(payload["value"]), Decimal("27.5"))

    async def test_last_rate_of_active_service_cannot_be_deleted(self):
        rate = self.add_rule()
        addon = self.add_rule("addon", "5", {"code": "rush", "pricing_type": "fixed"})
        with self.assertRaises(AdminRecordConflictError):
            await self.service.delete_pricing_rule(rate)
        self.assertEqual(await self.service.delete_pricing_rule(addon), addon)
        inactive_rate = self.add_rule("base", "10", active=False)
        self.assertEqual(await self.service.delete_pricing_rule(inactive_rate), inactive_rate)

    async def test_live_custom_rule_types_are_not_rejected(self):
        custom = uuid4()
        self.repository.services[str(custom)] = service_row(custom, "Lifestyle Photography", pricing_type="custom")
        created = await self.service.create_pricing_rule(AdminPricingRuleCreate(
            service_id=custom, rule_type="minimum_fee", value=Decimal("0"), condition={"note": "manual"},
        ))
        self.assertEqual(created.rule_type, "minimum_fee")

    async def test_knowledge_content_edit_clears_stale_embedding_without_provider(self):
        document = uuid4()
        await self.service.update_knowledge(document, AdminKnowledgeUpdate(content="New policy", expected_updated_at=NOW))
        payload = self.repository.updates[-1][2]
        self.assertIsNone(payload["embedding"])
        self.assertIsNone(payload["embedding_model"])

        await self.service.update_knowledge(document, AdminKnowledgeUpdate(title="Renamed", expected_updated_at=NOW))
        self.assertNotIn("embedding", self.repository.updates[-1][2])

    async def test_knowledge_content_edit_reembeds_with_configured_provider(self):
        service = AdminRecordsService(self.company, repository=self.repository, embeddings=FakeEmbeddings())
        document = await service.update_knowledge(
            uuid4(), AdminKnowledgeUpdate(content="New policy", expected_updated_at=NOW),
        )
        payload = self.repository.updates[-1][2]
        self.assertEqual(payload["embedding"], [0.1, 0.2])
        self.assertEqual(payload["embedding_model"], "test-embedding-model")
        self.assertTrue(document.has_embedding)


class AdminSettingsValidationTests(unittest.TestCase):
    def test_valid_live_shape_is_accepted(self):
        payload = AdminCompanySettingsUpdate(
            currency="USD", timezone="America/New_York", tax_rate=Decimal("7.5"),
            business_hours={"monday": {"open": "09:00", "close": "18:00"}, "sunday": {"closed": True}},
            settings={"booking": {"minimum_advance_days": 3, "slot_duration_minutes": {"Product Photography": 60}}},
            expected_updated_at=NOW,
        )
        self.assertEqual(payload.business_hours["sunday"], {"closed": True})

    def test_invalid_values_are_rejected(self):
        cases = [
            {"currency": "usd"},
            {"timezone": "Mars/Base"},
            {"tax_rate": Decimal("101")},
            {"business_hours": {"monday": {"open": "18:00", "close": "09:00"}}},
            {"business_hours": {"monday": {"open": "9am", "close": "18:00"}}},
            {"business_hours": {"monday": "closed"}},
            {"settings": {"booking": {"minimum_advance_days": -1}}},
            {"settings": {"booking": {"minimum_advance_days": 2.5}}},
            {"settings": {"booking": {"slot_duration_minutes": {"Product Photography": 0}}}},
            {"settings": {"retell_api_key": "never-store-me"}},
            {"unexpected": True},
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValidationError):
                AdminCompanySettingsUpdate(expected_updated_at=NOW, **case)


class AdminRecordsRepositoryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.company = uuid4()
        self.record = uuid4()
        self.requests: list[httpx.Request] = []
        self.responses: list[httpx.Response] = []

        def handler(request):
            self.requests.append(request)
            return self.responses.pop(0)

        transport = httpx.Client(transport=httpx.MockTransport(handler))
        self.addCleanup(transport.close)
        client = create_client("https://project.example.com", "test-only-key", options=ClientOptions(
            httpx_client=transport, auto_refresh_token=False, persist_session=False,
        ))
        self.repository = AdminRecordsRepository(self.company, client=client)

    def test_search_terms_cannot_inject_postgrest_filter_syntax(self):
        self.assertEqual(search_term("a),company_id.neq.(x"), "a company_id.neq. x")
        self.assertEqual(search_term('  jane@example.com "*%  '), "jane@example.com")
        self.assertIsNone(search_term(" (), "))

    async def test_updates_are_tenant_scoped_compare_and_set(self):
        self.responses.append(httpx.Response(200, json=[{
            "id": str(self.record), "name": "Customer", "created_at": NOW.isoformat(), "updated_at": NOW.isoformat(),
        }]))
        await self.repository.update_customer(self.record, {"name": "Customer"}, NOW)
        request = self.requests[-1]
        self.assertEqual(request.method, "PATCH")
        self.assertEqual(request.url.path, "/rest/v1/customers")
        self.assertEqual(request.url.params["company_id"], f"eq.{self.company}")
        self.assertEqual(request.url.params["id"], f"eq.{self.record}")
        self.assertEqual(request.url.params["updated_at"], f"eq.{NOW.isoformat()}")
        self.assertEqual(json.loads(request.content), {"name": "Customer"})

    async def test_stale_update_is_distinguished_from_missing_record(self):
        self.responses.extend([httpx.Response(200, json=[]), httpx.Response(200, json=[{"id": str(self.record)}])])
        with self.assertRaises(RecordChangedError):
            await self.repository.update_project(self.record, {"status": "draft"}, NOW)

        self.responses.extend([httpx.Response(200, json=[]), httpx.Response(200, json=[])])
        with self.assertRaises(RecordNotFoundError):
            await self.repository.update_project(self.record, {"status": "draft"}, NOW)
        self.assertTrue(all(r.url.params["company_id"] == f"eq.{self.company}" for r in self.requests))

    async def test_pricing_rules_are_scoped_through_owning_service(self):
        self.responses.append(httpx.Response(200, json=[], headers={"content-range": "*/0"}))
        await self.repository.list_pricing_rules()
        request = self.requests[-1]
        self.assertEqual(request.url.params["services.company_id"], f"eq.{self.company}")
        self.assertIn("services!inner", request.url.params["select"])

    async def test_search_is_sanitized_and_tenant_scoped(self):
        self.responses.append(httpx.Response(200, json=[], headers={"content-range": "*/0"}))
        await self.repository.list_customers(search="ann),id.neq.(", limit=25, offset=0)
        request = self.requests[-1]
        self.assertEqual(request.url.params["company_id"], f"eq.{self.company}")
        self.assertNotIn("id.neq", request.url.params["or"].replace("ann id.neq.", ""))
        self.assertNotIn("),", request.url.params["or"][:-1])


class AdminRecordsApiTests(unittest.TestCase):
    def setUp(self):
        self.company = uuid4()
        self.settings = Settings(
            _env_file=None, environment="testing", agent_company_id=self.company,
            supabase_url="https://project.example.com", supabase_key="server-test-key",
            admin_api_key="admin-test-key-not-real",
        )

    def client(self) -> TestClient:
        return TestClient(create_app(self.settings))

    def test_every_management_route_requires_the_admin_key(self):
        record = uuid4()
        routes = [
            ("GET", "/api/v1/admin/services"), ("POST", "/api/v1/admin/services"),
            ("PATCH", f"/api/v1/admin/services/{record}"), ("DELETE", f"/api/v1/admin/services/{record}"),
            ("GET", "/api/v1/admin/pricing-rules"), ("POST", "/api/v1/admin/pricing-rules"),
            ("PATCH", f"/api/v1/admin/pricing-rules/{record}"), ("DELETE", f"/api/v1/admin/pricing-rules/{record}"),
            ("GET", "/api/v1/admin/customers"), ("PATCH", f"/api/v1/admin/customers/{record}"),
            ("GET", "/api/v1/admin/projects"), ("PATCH", f"/api/v1/admin/projects/{record}"),
            ("GET", "/api/v1/admin/knowledge"), ("POST", "/api/v1/admin/knowledge"),
            ("PATCH", f"/api/v1/admin/knowledge/{record}"), ("DELETE", f"/api/v1/admin/knowledge/{record}"),
            ("GET", "/api/v1/admin/settings"), ("PATCH", "/api/v1/admin/settings"),
            ("PATCH", f"/api/v1/admin/leads/{record}"),
        ]
        with self.client() as client:
            for method, path in routes:
                with self.subTest(method=method, path=path):
                    response = client.request(method, path, json={})
                    self.assertEqual(response.status_code, 401)

    def test_company_id_cannot_be_supplied_by_the_caller(self):
        with self.client() as client:
            response = client.post("/api/v1/admin/services", headers=ADMIN_HEADERS, json={
                "name": "Video", "pricing_type": "fixed", "company_id": str(uuid4()),
            })
        self.assertEqual(response.status_code, 422)

    def test_business_conflicts_and_stale_edits_return_safe_409_messages(self):
        with patch(
            "app.api.v1.routes.admin_records.AdminRecordsService.delete_pricing_rule",
            new=AsyncMock(side_effect=AdminRecordConflictError("Deactivate the service first.")),
        ), self.client() as client:
            response = client.delete(f"/api/v1/admin/pricing-rules/{uuid4()}", headers=ADMIN_HEADERS)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], "Deactivate the service first.")
        self.assertEqual(response.headers["cache-control"], "no-store")

        with patch(
            "app.api.v1.routes.admin_records.AdminRecordsService.update_customer",
            new=AsyncMock(side_effect=RecordChangedError("changed")),
        ), self.client() as client:
            response = client.patch(
                f"/api/v1/admin/customers/{uuid4()}", headers=ADMIN_HEADERS,
                json={"name": "Customer", "expected_updated_at": NOW.isoformat()},
            )
        self.assertEqual(response.status_code, 409)
        self.assertIn("changed since you opened it", response.json()["detail"])

    def test_booking_filters_are_validated_and_forwarded(self):
        with patch(
            "app.api.v1.routes.admin.AdminService.list_bookings",
            new=AsyncMock(return_value={"items": [], "total": 0, "limit": 25, "offset": 0}),
        ) as method, self.client() as client:
            response = client.get("/api/v1/admin/bookings", headers=ADMIN_HEADERS, params={
                "limit": 25, "search": "jane", "service": "Product Photography",
                "date_from": "2026-10-01T04:00:00Z", "date_to": "2026-10-02T04:00:00Z",
            })
            invalid = client.get("/api/v1/admin/bookings", headers=ADMIN_HEADERS, params={
                "date_from": "2026-10-02T04:00:00Z", "date_to": "2026-10-01T04:00:00Z",
            })
        self.assertEqual(response.status_code, 200)
        kwargs = method.await_args.kwargs
        self.assertEqual((kwargs["search"], kwargs["service"]), ("jane", "Product Photography"))
        self.assertEqual(kwargs["date_from"], datetime(2026, 10, 1, 4, tzinfo=UTC))
        self.assertEqual(invalid.status_code, 422)


if __name__ == "__main__":
    unittest.main()
