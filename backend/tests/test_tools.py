"""Retell tool authentication, routing, and response contract tests."""

import hashlib
import hmac
import json
import time
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from supabase import ClientOptions, create_client

from app.core.config import Settings
from app.main import create_app
from app.schemas.tools import (
    CalculateQuoteResponse,
    CheckBookingAvailabilityResponse,
    CreateBookingConflictResponse,
    CreateLeadResponse,
    GetBookingStatusResponse,
    KnowledgeSource,
    SearchKnowledgeResponse,
    SearchServiceResponse,
    ServiceMatch,
)
from app.services.tool_service import ToolService
from app.repositories.lead_repository import LeadRepository
from app.repositories.booking_repository import BookingRepository
from app.repositories.errors import RepositoryError
from app.repositories.service_repository import ServiceRepository
from app.schemas.quote import QuoteCalculation
from app.schemas.tools import (
    CalculateQuoteRequest,
    CheckBookingAvailabilityRequest,
    CreateBookingRequest,
    CreateBookingResponse,
    CreateLeadRequest,
    GetBookingStatusRequest,
    SearchServiceRequest,
)


def sign(body: bytes, key: str) -> str:
    timestamp = str(int(time.time() * 1000))
    digest = hmac.new(key.encode(), body + timestamp.encode(), hashlib.sha256).hexdigest()
    return f"v={timestamp},d={digest}"


class RetellToolApiTests(unittest.TestCase):
    def setUp(self):
        self.company = uuid4()
        self.key = "retell-tool-test-key"
        self.settings = Settings(
            _env_file=None,
            environment="production",
            agent_company_id=self.company,
            retell_api_key=self.key,
            supabase_url="https://project.example.com",
            supabase_key="server-test-key",
        )

    def send(self, path: str, payload: dict, *, valid_signature: bool = True):
        body = json.dumps(payload, separators=(",", ":")).encode()
        headers = {
            "content-type": "application/json",
            "x-retell-signature": sign(body, self.key if valid_signature else "wrong"),
        }
        with TestClient(create_app(self.settings)) as client:
            return client.post(path, content=body, headers=headers)

    def test_search_service_is_available_in_production_and_signed(self):
        expected = SearchServiceResponse(services=[ServiceMatch(
            id=uuid4(), name="Product photography", category="ecommerce",
            description="Catalog-ready images", pricing_type="per_image", relevance=0.8,
        )])
        with patch.object(ToolService, "search_service", AsyncMock(return_value=expected)) as method:
            response = self.send("/api/v1/tools/search-service", {
                "company_id": str(self.company), "query": "catalog photos",
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["services"][0]["name"], "Product photography")
        self.assertEqual(response.headers["cache-control"], "no-store")
        method.assert_awaited_once()

    def test_quote_tool_uses_existing_response_contract(self):
        expected = CalculateQuoteResponse(
            service="Product photography", base_price="20", addons="5", total_price="25",
        )
        with patch.object(ToolService, "calculate_quote", AsyncMock(return_value=expected)):
            response = self.send("/api/v1/tools/calculate-quote", {
                "company_id": str(self.company), "service_name": "Product photography",
                "image_count": 10, "addons": ["rush"],
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total_price"], 25.0)

    def test_create_lead_returns_retry_metadata_and_ids(self):
        expected = CreateLeadResponse(
            customer_id=uuid4(), lead_id=uuid4(), project_id=uuid4(), replayed=False,
        )
        payload = {
            "company_id": str(self.company),
            "request_id": "retell-call-123",
            "customer": {"name": "Jane", "email": "JANE@example.com"},
            "lead": {"intent": "ecommerce launch"},
            "project": {"service_type": "Product photography", "image_count": 12},
        }
        with patch.object(ToolService, "create_lead", AsyncMock(return_value=expected)):
            response = self.send("/api/v1/tools/create-lead", payload)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["success"])
        self.assertFalse(response.json()["replayed"])
        self.assertEqual(response.json()["customer_id"], str(expected.customer_id))

    def test_create_booking_persists_nested_customer_and_all_booking_fields(self):
        customer_id, booking_id = uuid4(), uuid4()
        requests: list[httpx.Request] = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            if request.method == "GET":
                return httpx.Response(200, json=[])
            return httpx.Response(200, json=[{
                "customer_id": str(customer_id),
                "booking_id": str(booking_id),
                "status": "pending",
            }])

        with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
            client = create_client(
                "https://project.example.com",
                "fake",
                options=ClientOptions(
                    httpx_client=transport,
                    auto_refresh_token=False,
                    persist_session=False,
                ),
            )
            with patch("app.repositories.base.get_supabase_client", return_value=client):
                response = self.send("/api/v1/tools/create-booking", {
                    "company_id": str(self.company),
                    "customer": {
                        "name": "Jane Doe",
                        "email": "JANE@example.com",
                        "phone": "+15555550123",
                        "business_name": "Jane Studio",
                        "industry": "Retail",
                    },
                    "date_time": "2099-06-01T14:30:00Z",
                    "service_type": "Product photography",
                    "notes": "Bring the summer collection.",
                })

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json(), {
            "success": True,
            "customer_id": str(customer_id),
            "booking_id": str(booking_id),
            "status": "pending",
            "message": "Booking created successfully",
        })
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(requests[0].url.path, "/rest/v1/bookings")
        self.assertEqual(requests[1].url.path, "/rest/v1/rpc/create_booking_tool_workflow")
        body = json.loads(requests[1].content)
        self.assertEqual(body["p_company_id"], str(self.company))
        self.assertEqual(body["p_customer"]["email"], "jane@example.com")
        self.assertEqual(body["p_customer"]["industry"], "Retail")
        self.assertEqual(body["p_service_type"], "Product photography")
        self.assertEqual(body["p_notes"], "Bring the summer collection.")

    def test_create_booking_validates_nested_payload_before_database_access(self):
        base = {
            "company_id": str(self.company),
            "customer": {"name": "Jane Doe"},
            "date_time": "2099-06-01T14:30:00Z",
            "service_type": "Product photography",
            "notes": "",
        }
        invalid = [
            {**base, "service_type": " "},
            {**base, "date_time": "2020-01-01T00:00:00Z"},
            {**base, "date_time": "2099-06-01T14:30:00"},
            {**base, "customer": {"name": " "}},
            {**base, "customer_name": "old-flat-contract"},
        ]
        with patch("app.repositories.base.get_supabase_client") as client_factory:
            for payload in invalid:
                with self.subTest(payload=payload):
                    response = self.send("/api/v1/tools/create-booking", payload)
                    self.assertEqual(response.status_code, 422)
        client_factory.assert_not_called()

    def test_create_booking_returns_safe_conflict_response(self):
        with patch.object(
            ToolService,
            "create_booking",
            AsyncMock(return_value=CreateBookingConflictResponse()),
        ):
            response = self.send("/api/v1/tools/create-booking", {
                "company_id": str(self.company),
                "customer": {"name": "Jane Doe"},
                "date_time": "2099-06-01T14:30:00Z",
                "service_type": "Product photography",
            })
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {
            "success": False,
            "conflict": True,
            "message": "That time is not available.",
        })

    def test_check_booking_availability_is_a_signed_retell_tool(self):
        expected = CheckBookingAvailabilityResponse(
            available=False,
            reason="confirmed_booking_exists",
            message="That time is already booked.",
        )
        with patch.object(
            ToolService,
            "check_booking_availability",
            AsyncMock(return_value=expected),
        ) as method:
            response = self.send("/api/v1/tools/check-booking-availability", {
                "company_id": str(self.company),
                "date_time": "2099-06-01T14:30:00Z",
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "available": False,
            "reason": "confirmed_booking_exists",
            "message": "That time is already booked.",
        })
        method.assert_awaited_once()

        response = self.send(
            "/api/v1/tools/check-booking-availability",
            {
                "company_id": str(self.company),
                "date_time": "2099-06-01T14:30:00Z",
            },
            valid_signature=False,
        )
        self.assertEqual(response.status_code, 401)

    def test_booking_status_lookup_by_email_returns_safe_fields(self):
        booking_id = uuid4()
        expected = GetBookingStatusResponse(
            found=True,
            booking_id=booking_id,
            service_type="Fashion Photography",
            date_time="2099-09-10T09:00:00Z",
            status="confirmed",
        )
        with patch.object(
            ToolService, "get_booking_status", AsyncMock(return_value=expected),
        ) as method:
            response = self.send("/api/v1/tools/get-booking-status", {
                "company_id": str(self.company),
                "email": " CUSTOMER@EXAMPLE.COM ",
            })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "found": True,
            "booking_id": str(booking_id),
            "service_type": "Fashion Photography",
            "date_time": "2099-09-10T09:00:00Z",
            "status": "confirmed",
        })
        self.assertEqual(method.await_args.args[0].email, "customer@example.com")
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_booking_status_lookup_accepts_phone(self):
        expected = GetBookingStatusResponse(
            found=True,
            booking_id=uuid4(),
            date_time="2099-09-10T09:00:00Z",
            status="pending",
        )
        with patch.object(
            ToolService, "get_booking_status", AsyncMock(return_value=expected),
        ) as method:
            response = self.send("/api/v1/tools/get-booking-status", {
                "company_id": str(self.company),
                "phone": "+8801700000000",
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(method.await_args.args[0].phone, "+8801700000000")

    def test_booking_status_lookup_accepts_booking_id(self):
        booking_id = uuid4()
        expected = GetBookingStatusResponse(
            found=True,
            booking_id=booking_id,
            date_time="2099-09-10T09:00:00Z",
            status="rejected",
        )
        with patch.object(
            ToolService, "get_booking_status", AsyncMock(return_value=expected),
        ) as method:
            response = self.send("/api/v1/tools/get-booking-status", {
                "company_id": str(self.company),
                "booking_id": str(booking_id),
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(method.await_args.args[0].booking_id, booking_id)

    def test_booking_status_unknown_customer_is_neutral(self):
        expected = GetBookingStatusResponse(
            found=False,
            message="No matching booking was found.",
        )
        with patch.object(
            ToolService, "get_booking_status", AsyncMock(return_value=expected),
        ):
            response = self.send("/api/v1/tools/get-booking-status", {
                "company_id": str(self.company),
                "email": "unknown@example.com",
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "found": False,
            "message": "No matching booking was found.",
        })

    def test_booking_status_lookup_rejects_invalid_signature_and_company(self):
        payload = {
            "company_id": str(self.company),
            "email": "customer@example.com",
        }
        with patch.object(ToolService, "get_booking_status", AsyncMock()) as method:
            response = self.send(
                "/api/v1/tools/get-booking-status", payload, valid_signature=False,
            )
        self.assertEqual(response.status_code, 401)
        method.assert_not_awaited()

        response = self.send("/api/v1/tools/get-booking-status", {
            **payload,
            "company_id": str(uuid4()),
        })
        self.assertEqual(response.status_code, 403)

    def test_booking_status_lookup_requires_identifier(self):
        with patch.object(ToolService, "get_booking_status", AsyncMock()) as method:
            response = self.send("/api/v1/tools/get-booking-status", {
                "company_id": str(self.company),
            })
        self.assertEqual(response.status_code, 422)
        method.assert_not_awaited()

    def test_booking_status_lookup_fails_safely_without_retell_configuration(self):
        settings = Settings(
            _env_file=None,
            environment="production",
            agent_company_id=self.company,
            supabase_url="https://project.example.com",
            supabase_key="server-test-key",
        )
        with TestClient(create_app(settings)) as client:
            response = client.post(
                "/api/v1/tools/get-booking-status",
                json={
                    "company_id": str(self.company),
                    "email": "customer@example.com",
                },
            )
        self.assertEqual(response.status_code, 503)

    def test_booking_status_repository_errors_are_sanitized(self):
        with patch.object(
            ToolService,
            "get_booking_status",
            AsyncMock(side_effect=RepositoryError("provider secret")),
        ):
            response = self.send("/api/v1/tools/get-booking-status", {
                "company_id": str(self.company),
                "email": "customer@example.com",
            })
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("provider secret", response.text)

    def test_knowledge_tool_returns_bounded_context_and_source_metadata(self):
        expected = SearchKnowledgeResponse(
            context="[Knowledge source: Delivery]\nFive business days.",
            sources=[KnowledgeSource(id=uuid4(), title="Delivery", relevance=0.5)],
            retrieval_mode="full_text",
        )
        with patch.object(ToolService, "search_knowledge", AsyncMock(return_value=expected)):
            response = self.send("/api/v1/tools/search-knowledge", {
                "company_id": str(self.company), "question": "When is delivery?",
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["sources"][0]["title"], "Delivery")

    def test_unsigned_knowledge_test_route_is_development_only(self):
        expected = SearchKnowledgeResponse(
            context="[Knowledge source: Delivery]\nFive business days.",
            sources=[KnowledgeSource(id=uuid4(), title="Delivery", relevance=0.5)],
            retrieval_mode="full_text",
        )
        payload = {"company_id": str(self.company), "question": "When is delivery?"}

        for environment in ("development", "testing"):
            with self.subTest(environment=environment):
                settings = Settings(
                    _env_file=None,
                    environment=environment,
                    agent_company_id=self.company,
                    supabase_url="https://project.example.com",
                    supabase_key="server-test-key",
                )
                with patch.object(ToolService, "search_knowledge", AsyncMock(return_value=expected)) as method:
                    with TestClient(create_app(settings)) as client:
                        response = client.post(
                            "/api/v1/tools/search-knowledge-test",
                            json=payload,
                        )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), expected.model_dump(mode="json"))
                self.assertEqual(response.headers["cache-control"], "no-store")
                method.assert_awaited_once()

        for environment in ("staging", "production"):
            with self.subTest(environment=environment):
                settings = Settings(_env_file=None, environment=environment)
                with TestClient(create_app(settings)) as client:
                    response = client.post(
                        "/api/v1/tools/search-knowledge-test",
                        json=payload,
                    )
                    paths = client.get("/openapi.json").json()["paths"]
                self.assertEqual(response.status_code, 404)
                self.assertNotIn("/api/v1/tools/search-knowledge-test", paths)

    def test_unsigned_knowledge_test_route_requires_database_configuration(self):
        settings = Settings(_env_file=None, environment="testing")
        with TestClient(create_app(settings)) as client:
            response = client.post(
                "/api/v1/tools/search-knowledge-test",
                json={"company_id": str(self.company), "question": "Delivery?"},
            )
        self.assertEqual(response.status_code, 503)

    def test_production_knowledge_route_still_requires_retell_signature(self):
        with TestClient(create_app(self.settings)) as client:
            response = client.post(
                "/api/v1/tools/search-knowledge",
                json={"company_id": str(self.company), "question": "Delivery?"},
            )
        self.assertEqual(response.status_code, 401)

    def test_invalid_signature_and_wrong_company_are_rejected(self):
        response = self.send("/api/v1/tools/search-service", {
            "company_id": str(self.company), "query": "catalog",
        }, valid_signature=False)
        self.assertEqual(response.status_code, 401)
        response = self.send("/api/v1/tools/search-service", {
            "company_id": str(uuid4()), "query": "catalog",
        })
        self.assertEqual(response.status_code, 403)

    def test_validation_rejects_unknown_fields_before_tool_execution(self):
        with patch.object(ToolService, "search_service", AsyncMock()) as method:
            response = self.send("/api/v1/tools/search-service", {
                "company_id": str(self.company), "query": "catalog", "untrusted": True,
            })
        self.assertEqual(response.status_code, 422)
        method.assert_not_awaited()


class ToolServiceTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def service_with_dependencies(company, *, quotes):
        services = Mock(spec=ServiceRepository)
        services.company_id = str(company)
        leads = Mock(spec=LeadRepository)
        leads.company_id = str(company)
        knowledge = Mock()
        knowledge.company_id = company
        return ToolService(
            company, services=services, leads=leads, quotes=quotes, knowledge=knowledge,
        )

    async def test_quote_result_is_converted_to_tool_contract(self):
        company = uuid4()
        quotes = Mock()
        quotes.calculate_quote = AsyncMock(return_value=QuoteCalculation(
            service="Product photography", base_price="10", addons="2", total_price="12",
        ))
        service = self.service_with_dependencies(company, quotes=quotes)
        result = await service.calculate_quote(CalculateQuoteRequest(
            company_id=company, service_name="Product photography", image_count=5, addons=[],
        ))
        self.assertIsInstance(result, CalculateQuoteResponse)
        self.assertEqual(float(result.total_price), 12)

    async def test_booking_service_uses_schema_and_repository_result(self):
        company = uuid4()
        customer_id, booking_id = uuid4(), uuid4()
        services = Mock(spec=ServiceRepository)
        services.company_id = str(company)
        leads = Mock(spec=LeadRepository)
        leads.company_id = str(company)
        bookings = Mock(spec=BookingRepository)
        bookings.company_id = str(company)
        bookings.find_booking_conflicts = AsyncMock(return_value=[])
        bookings.create_booking = AsyncMock(return_value={
            "customer_id": str(customer_id),
            "booking_id": str(booking_id),
            "status": "pending",
        })
        knowledge = Mock()
        knowledge.company_id = company
        service = ToolService(
            company,
            services=services,
            leads=leads,
            bookings=bookings,
            quotes=Mock(),
            knowledge=knowledge,
        )
        request = CreateBookingRequest(
            company_id=company,
            customer={"name": "Jane"},
            date_time=datetime.now(UTC) + timedelta(days=1),
            service_type="Portrait session",
            notes="Outdoor session",
        )

        result = await service.create_booking(request)

        self.assertIsInstance(result, CreateBookingResponse)
        self.assertEqual(result.customer_id, customer_id)
        self.assertEqual(result.booking_id, booking_id)
        bookings.create_booking.assert_awaited_once_with(request)

    async def test_create_booking_stops_before_write_for_confirmed_slot(self):
        company = uuid4()
        services = Mock(spec=ServiceRepository)
        services.company_id = str(company)
        leads = Mock(spec=LeadRepository)
        leads.company_id = str(company)
        bookings = Mock(spec=BookingRepository)
        bookings.company_id = str(company)
        bookings.find_booking_conflicts = AsyncMock(return_value=[{
            "id": str(uuid4()),
            "date_time": "2099-06-01T14:30:00Z",
            "status": "confirmed",
        }])
        bookings.create_booking = AsyncMock()
        knowledge = Mock()
        knowledge.company_id = company
        service = ToolService(
            company,
            services=services,
            leads=leads,
            bookings=bookings,
            quotes=Mock(),
            knowledge=knowledge,
        )
        request = CreateBookingRequest(
            company_id=company,
            customer={"name": "Jane"},
            date_time="2099-06-01T14:30:00Z",
            service_type="Portrait session",
        )

        result = await service.create_booking(request)

        self.assertFalse(result.success)
        self.assertTrue(result.conflict)
        bookings.create_booking.assert_not_awaited()

    async def test_create_booking_allows_and_reports_pending_slot(self):
        company = uuid4()
        customer_id, booking_id = uuid4(), uuid4()
        services = Mock(spec=ServiceRepository)
        services.company_id = str(company)
        leads = Mock(spec=LeadRepository)
        leads.company_id = str(company)
        bookings = Mock(spec=BookingRepository)
        bookings.company_id = str(company)
        bookings.find_booking_conflicts = AsyncMock(return_value=[{
            "id": str(uuid4()),
            "date_time": "2099-06-01T14:30:00Z",
            "status": "pending",
        }])
        bookings.create_booking = AsyncMock(return_value={
            "customer_id": str(customer_id),
            "booking_id": str(booking_id),
            "status": "pending",
        })
        knowledge = Mock()
        knowledge.company_id = company
        service = ToolService(
            company,
            services=services,
            leads=leads,
            bookings=bookings,
            quotes=Mock(),
            knowledge=knowledge,
        )
        request = CreateBookingRequest(
            company_id=company,
            customer={"name": "Jane"},
            date_time="2099-06-01T14:30:00Z",
            service_type="Portrait session",
        )

        result = await service.create_booking(request)

        self.assertTrue(result.success)
        self.assertTrue(result.pending_conflict)
        bookings.create_booking.assert_awaited_once_with(request)

    async def test_booking_tenant_is_checked_before_repository_access(self):
        company = uuid4()
        services = Mock(spec=ServiceRepository)
        services.company_id = str(company)
        leads = Mock(spec=LeadRepository)
        leads.company_id = str(company)
        bookings = Mock(spec=BookingRepository)
        bookings.company_id = str(company)
        bookings.create_booking = AsyncMock()
        knowledge = Mock()
        knowledge.company_id = company
        service = ToolService(
            company, services=services, leads=leads, bookings=bookings,
            quotes=Mock(), knowledge=knowledge,
        )
        with self.assertRaises(PermissionError):
            await service.create_booking(CreateBookingRequest(
                company_id=uuid4(),
                customer={"name": "Jane"},
                date_time=datetime.now(UTC) + timedelta(days=1),
                service_type="Portrait session",
            ))
        bookings.create_booking.assert_not_awaited()

    async def test_booking_status_selects_nearest_upcoming_booking(self):
        company = uuid4()
        services = Mock(spec=ServiceRepository)
        services.company_id = str(company)
        leads = Mock(spec=LeadRepository)
        leads.company_id = str(company)
        bookings = Mock(spec=BookingRepository)
        bookings.company_id = str(company)
        now = datetime.now(UTC)
        bookings.find_customer_bookings = AsyncMock(return_value=[
            {
                "id": str(uuid4()),
                "service_type": "Later session",
                "date_time": now + timedelta(days=10),
                "status": "pending",
            },
            {
                "id": str(uuid4()),
                "service_type": "Nearest session",
                "date_time": now + timedelta(days=2),
                "status": "confirmed",
            },
            {
                "id": str(uuid4()),
                "service_type": "Past session",
                "date_time": now - timedelta(days=1),
                "status": "cancelled",
            },
        ])
        knowledge = Mock()
        knowledge.company_id = company
        service = ToolService(
            company,
            services=services,
            leads=leads,
            bookings=bookings,
            quotes=Mock(),
            knowledge=knowledge,
        )

        result = await service.get_booking_status(GetBookingStatusRequest(
            company_id=company,
            email="customer@example.com",
        ))

        self.assertTrue(result.found)
        self.assertEqual(result.service_type, "Nearest session")
        bookings.find_customer_bookings.assert_awaited_once()

    async def test_create_lead_delegates_one_hashed_idempotent_command(self):
        company = uuid4()
        customer_id, lead_id, project_id = uuid4(), uuid4(), uuid4()
        services = Mock(spec=ServiceRepository)
        services.company_id = str(company)
        leads = Mock(spec=LeadRepository)
        leads.company_id = str(company)
        leads.create_tool_workflow = AsyncMock(return_value={
            "customer_id": str(customer_id),
            "lead_id": str(lead_id),
            "project_id": str(project_id),
            "replayed": True,
        })
        knowledge = Mock()
        knowledge.company_id = company
        tool_service = ToolService(
            company,
            services=services,
            leads=leads,
            quotes=Mock(),
            knowledge=knowledge,
        )
        request = CreateLeadRequest.model_validate({
            "company_id": str(company),
            "request_id": "call-123",
            "customer": {"name": "Jane", "email": "JANE@example.com"},
            "project": {"image_count": 4},
        })

        result = await tool_service.create_lead(request)

        self.assertTrue(result.replayed)
        self.assertEqual(result.project_id, project_id)
        arguments = leads.create_tool_workflow.await_args.kwargs
        self.assertEqual(arguments["request_id"], "call-123")
        self.assertEqual(arguments["customer"]["email"], "jane@example.com")
        self.assertRegex(arguments["request_hash"], r"^[0-9a-f]{64}$")

    async def test_tenant_is_checked_before_repository_access(self):
        company = uuid4()
        services = Mock(spec=ServiceRepository)
        services.company_id = str(company)
        services.search_active_services = AsyncMock()
        leads = Mock(spec=LeadRepository)
        leads.company_id = str(company)
        knowledge = Mock()
        knowledge.company_id = company
        tool_service = ToolService(
            company, services=services, leads=leads, quotes=Mock(), knowledge=knowledge,
        )
        with self.assertRaises(PermissionError):
            await tool_service.search_service(SearchServiceRequest(
                company_id=uuid4(), query="product photography",
            ))
        services.search_active_services.assert_not_awaited()


class ToolRepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_service_search_uses_tenant_scoped_rpc(self):
        company = uuid4()
        service_id = uuid4()
        requests: list[httpx.Request] = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return httpx.Response(200, json=[{
                "id": str(service_id), "name": "Product photography",
                "category": "ecommerce", "description": "Catalog images",
                "pricing_type": "per_image", "relevance": 0.75,
            }])

        with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
            client = create_client(
                "https://project.example.com", "fake",
                options=ClientOptions(httpx_client=transport, auto_refresh_token=False, persist_session=False),
            )
            rows = await ServiceRepository(company, client=client).search_active_services("catalog", limit=3)
        self.assertEqual(rows[0]["id"], str(service_id))
        self.assertEqual(requests[0].url.path, "/rest/v1/rpc/search_active_services")
        body = json.loads(requests[0].content)
        self.assertEqual(body, {
            "p_company_id": str(company), "p_query": "catalog", "p_limit": 3,
        })

    async def test_lead_workflow_sends_no_tenant_inside_record_payloads(self):
        company = uuid4()
        requests: list[httpx.Request] = []
        ids = [str(uuid4()), str(uuid4()), str(uuid4())]

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return httpx.Response(200, json=[{
                "customer_id": ids[0], "lead_id": ids[1], "project_id": ids[2], "replayed": False,
            }])

        with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
            client = create_client(
                "https://project.example.com", "fake",
                options=ClientOptions(httpx_client=transport, auto_refresh_token=False, persist_session=False),
            )
            row = await LeadRepository(company, client=client).create_tool_workflow(
                request_id="call-123", request_hash="a" * 64,
                customer={"name": "Jane"}, lead={"status": "new"}, project={"status": "draft"},
            )
        self.assertEqual(row["project_id"], ids[2])
        self.assertEqual(requests[0].url.path, "/rest/v1/rpc/create_lead_tool_workflow")
        body = json.loads(requests[0].content)
        self.assertEqual(body["p_company_id"], str(company))
        self.assertNotIn("company_id", body["p_customer"])


if __name__ == "__main__":
    unittest.main()
