"""Retell tool authentication, routing, and response contract tests."""

import hashlib
import hmac
import json
import time
import unittest
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from supabase import ClientOptions, create_client

from app.core.config import Settings
from app.main import create_app
from app.schemas.tools import (
    CalculateQuoteResponse,
    CreateLeadResponse,
    KnowledgeSource,
    SearchKnowledgeResponse,
    SearchServiceResponse,
    ServiceMatch,
)
from app.services.tool_service import ToolService
from app.repositories.lead_repository import LeadRepository
from app.repositories.service_repository import ServiceRepository
from app.schemas.quote import QuoteCalculation
from app.schemas.tools import CalculateQuoteRequest, CreateLeadRequest, SearchServiceRequest


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
