"""Knowledge API, repository, embedding, and context tests without live services."""

import json
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from pydantic import ValidationError
from supabase import ClientOptions, create_client

from app.core.config import Settings
from app.main import create_app
from app.repositories.knowledge_repository import KnowledgeRepository
from app.schemas.knowledge import KnowledgeSearchResult
from app.services.embedding_service import (
    EmbeddingProviderUnavailableError,
    EmbeddingService,
)
from app.services.knowledge_service import KnowledgeService


class FakeEmbeddingProvider:
    model_name = "fake-test-model"
    dimensions = 3

    async def embed(self, text: str) -> list[float]:
        return [0.1, 0.2, 0.3]


class KnowledgeApiTests(unittest.TestCase):
    def setUp(self):
        self.company = uuid4()
        self.document = uuid4()
        self.settings = Settings(
            _env_file=None,
            environment="testing",
            agent_company_id=self.company,
            supabase_url="https://project.example.com",
            supabase_key="fake-test-key",
        )
        self.requests: list[httpx.Request] = []
        self.responses: list[httpx.Response | Exception] = []

    def call(self, path: str, payload: dict) -> httpx.Response:
        def handler(request: httpx.Request) -> httpx.Response:
            self.requests.append(request)
            response = self.responses.pop(0)
            if isinstance(response, Exception):
                raise response
            return response

        with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
            client = create_client(
                "https://project.example.com",
                "fake-test-key",
                options=ClientOptions(
                    httpx_client=transport,
                    auto_refresh_token=False,
                    persist_session=False,
                ),
            )
            with patch("app.repositories.base.get_supabase_client", return_value=client):
                with TestClient(create_app(self.settings)) as api:
                    return api.post(path, json=payload)

    def test_add_document_without_provider_stores_null_embedding(self):
        self.responses.append(httpx.Response(201, json=[{
            "id": str(self.document),
            "company_id": str(self.company),
            "title": "Studio policy",
            "content": "Bookings require a deposit.",
            "embedding": None,
            "embedding_model": None,
        }]))
        response = self.call("/api/v1/knowledge", {
            "company_id": str(self.company),
            "title": "Studio policy",
            "content": "Bookings require a deposit.",
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["has_embedding"], False)
        body = json.loads(self.requests[0].content)
        self.assertEqual(body["company_id"], str(self.company))
        self.assertIsNone(body["embedding"])
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_add_document_accepts_valid_supplied_embedding(self):
        self.responses.append(httpx.Response(201, json=[{
            "id": str(self.document),
            "company_id": str(self.company),
            "title": "FAQ",
            "content": "Delivery takes five days.",
            "embedding": [0.1, 0.2, 0.3],
            "embedding_model": "external-test-model",
        }]))
        response = self.call("/api/v1/knowledge", {
            "company_id": str(self.company),
            "title": "FAQ",
            "content": "Delivery takes five days.",
            "embedding": [0.1, 0.2, 0.3],
            "embedding_model": "external-test-model",
        })
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["has_embedding"])

    def test_full_text_search_without_provider(self):
        self.responses.append(httpx.Response(200, json=[{
            "id": str(self.document),
            "title": "Turnaround",
            "content": "Standard delivery is five business days.",
            "relevance": 0.25,
            "created_at": "2026-01-01T00:00:00Z",
        }]))
        response = self.call("/api/v1/knowledge/search", {
            "company_id": str(self.company),
            "query": "delivery time",
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["retrieval_mode"], "full_text")
        self.assertIn("[Knowledge source: Turnaround]", data["context"])
        request_body = json.loads(self.requests[0].content)
        self.assertEqual(self.requests[0].url.path, "/rest/v1/rpc/search_knowledge_documents_text")
        self.assertEqual(request_body["p_company_id"], str(self.company))
        self.assertEqual(request_body["p_query"], "delivery time")

    def test_semantic_search_uses_supplied_vector_and_threshold(self):
        self.responses.append(httpx.Response(200, json=[]))
        response = self.call("/api/v1/knowledge/search", {
            "company_id": str(self.company),
            "query": "delivery time",
            "query_embedding": [0.1, 0.2, 0.3],
            "embedding_model": "external-test-model",
            "similarity_threshold": 0.8,
            "limit": 3,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["retrieval_mode"], "semantic")
        body = json.loads(self.requests[0].content)
        self.assertEqual(self.requests[0].url.path, "/rest/v1/rpc/search_knowledge_documents_vector")
        self.assertEqual(body["p_query_embedding"], [0.1, 0.2, 0.3])
        self.assertEqual(body["p_embedding_model"], "external-test-model")
        self.assertEqual(body["p_match_threshold"], 0.8)

    def test_other_company_and_invalid_vectors_fail_before_database(self):
        payloads = [
            {"company_id": str(uuid4()), "title": "FAQ", "content": "Content"},
            {"company_id": str(self.company), "title": "FAQ", "content": "Content", "embedding": []},
            {"company_id": str(self.company), "title": "FAQ", "content": "Content", "embedding": [0.1]},
            {"company_id": str(self.company), "query": "test", "query_embedding": ["NaN"]},
            {"company_id": str(self.company), "query": "test", "query_embedding": [True]},
            {"company_id": str(self.company), "query": " ", "limit": 5},
        ]
        paths = ["/api/v1/knowledge", "/api/v1/knowledge", "/api/v1/knowledge",
                 "/api/v1/knowledge/search", "/api/v1/knowledge/search",
                 "/api/v1/knowledge/search"]
        for path, payload in zip(paths, payloads):
            with self.subTest(payload=payload):
                response = self.call(path, payload)
                self.assertIn(response.status_code, {403, 422})
        self.assertEqual(self.requests, [])

    def test_repository_failure_is_sanitized(self):
        self.responses.append(httpx.ReadTimeout("secret document provider detail"))
        with self.assertLogs("app.api.v1.routes.knowledge", level="WARNING") as logs:
            response = self.call("/api/v1/knowledge/search", {
                "company_id": str(self.company),
                "query": "delivery",
            })
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("secret document", response.text + "\n".join(logs.output))

    def test_routes_are_absent_in_staging_and_production(self):
        for environment in ("staging", "production"):
            self.settings.environment = environment
            response = self.call("/api/v1/knowledge/search", {
                "company_id": str(self.company),
                "query": "delivery",
            })
            self.assertEqual(response.status_code, 404)
        self.assertEqual(self.requests, [])


class EmbeddingAndServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_embedding_provider_contract_and_dimension_validation(self):
        self.assertEqual(
            await EmbeddingService(FakeEmbeddingProvider()).create_embedding("content"),
            [0.1, 0.2, 0.3],
        )
        with self.assertRaises(EmbeddingProviderUnavailableError):
            await EmbeddingService().create_embedding("content")
        provider = FakeEmbeddingProvider()
        provider.dimensions = 2
        with self.assertRaises(ValueError):
            await EmbeddingService(provider).create_embedding("content")

    async def test_configured_provider_is_used_for_ingestion_and_search(self):
        company = uuid4()
        repository = AsyncMock(spec=KnowledgeRepository)
        repository.company_id = str(company)
        repository.insert_document.return_value = {
            "id": str(uuid4()), "company_id": str(company), "title": "FAQ", "content": "Content",
        }
        repository.search_documents.return_value = []
        service = KnowledgeService(
            company,
            repository=repository,
            embeddings=EmbeddingService(FakeEmbeddingProvider()),
        )
        from app.schemas.knowledge import KnowledgeDocumentCreate, KnowledgeSearchRequest

        await service.add_document(KnowledgeDocumentCreate(
            company_id=company, title="FAQ", content="Content",
        ))
        saved = repository.insert_document.call_args.args[0]
        self.assertEqual(saved.embedding, [0.1, 0.2, 0.3])
        self.assertEqual(saved.embedding_model, "fake-test-model")
        result = await service.retrieve_relevant_knowledge(KnowledgeSearchRequest(
            company_id=company, query="question",
        ))
        self.assertEqual(result.retrieval_mode, "semantic")
        self.assertEqual(repository.search_documents.call_args.kwargs["query_embedding"], [0.1, 0.2, 0.3])
        self.assertEqual(repository.search_documents.call_args.kwargs["embedding_model"], "fake-test-model")

    async def test_context_is_source_labelled_and_bounded(self):
        company = uuid4()
        repository = AsyncMock(spec=KnowledgeRepository)
        repository.company_id = str(company)
        service = KnowledgeService(company, repository=repository)
        documents = [KnowledgeSearchResult(
            id=uuid4(), title="Policy", content="x" * 1000, relevance=0.5,
        )]
        context = service.prepare_context(documents, max_characters=500)
        self.assertEqual(len(context), 500)
        self.assertTrue(context.startswith("[Knowledge source: Policy]"))

    async def test_repository_retrieve_by_company_omits_embedding(self):
        company = uuid4()
        requests: list[httpx.Request] = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return httpx.Response(200, json=[])

        with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
            client = create_client("https://project.example.com", "fake", options=ClientOptions(
                httpx_client=transport, auto_refresh_token=False, persist_session=False,
            ))
            result = await KnowledgeRepository(company, client=client).retrieve_by_company(limit=10, offset=20)
        self.assertEqual(result, [])
        self.assertNotIn("embedding", requests[0].url.params["select"])
        self.assertEqual(requests[0].url.params["company_id"], f"eq.{company}")


if __name__ == "__main__":
    unittest.main()
