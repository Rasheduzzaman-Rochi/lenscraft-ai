"""Knowledge ingestion, retrieval, and bounded context preparation."""

from typing import Any
from uuid import UUID

from pydantic import ValidationError

from app.repositories.errors import RepositoryError
from app.repositories.knowledge_repository import KnowledgeRepository
from app.schemas.knowledge import (
    KnowledgeDocument,
    KnowledgeDocumentCreate,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    KnowledgeSearchResult,
)
from app.services.embedding_service import EmbeddingService


class KnowledgeDataError(ValueError):
    """Stored knowledge data is malformed or incompatible with the current provider."""


class KnowledgeService:
    """Coordinate provider-neutral embeddings with tenant-scoped persistence."""

    def __init__(
        self,
        company_id: UUID,
        *,
        repository: KnowledgeRepository | None = None,
        embeddings: EmbeddingService | None = None,
    ) -> None:
        self.company_id = UUID(str(company_id))
        self.repository = repository if repository is not None else KnowledgeRepository(company_id)
        if self.repository.company_id != str(self.company_id):
            raise ValueError("Knowledge repository belongs to another company")
        self.embeddings = embeddings if embeddings is not None else EmbeddingService()

    async def add_document(self, data: KnowledgeDocumentCreate) -> KnowledgeDocument:
        """Optionally create an embedding, persist the document, and return safe metadata."""
        self._require_company(data.company_id)
        vector = data.embedding
        embedding_model = data.embedding_model
        if vector is None and self.embeddings.configured:
            vector = await self.embeddings.create_embedding(data.content)
            embedding_model = self.embeddings.model_name
        saved = await self.repository.insert_document(data.model_copy(update={
            "embedding": vector,
            "embedding_model": embedding_model,
        }))
        try:
            return KnowledgeDocument(
                id=saved["id"],
                company_id=saved["company_id"],
                title=saved["title"],
                content=saved["content"],
                has_embedding=vector is not None,
                embedding_model=embedding_model,
            )
        except (KeyError, TypeError, ValidationError):
            raise RepositoryError("Database returned an invalid knowledge document") from None

    async def retrieve_relevant_knowledge(
        self, request: KnowledgeSearchRequest,
    ) -> KnowledgeSearchResponse:
        """Prefer semantic retrieval; use full text until a provider/vector is available."""
        self._require_company(request.company_id)
        vector = request.query_embedding
        embedding_model = request.embedding_model
        if vector is None and self.embeddings.configured:
            vector = await self.embeddings.create_embedding(request.query)
            embedding_model = self.embeddings.model_name
        records = await self.repository.search_documents(
            query=request.query,
            query_embedding=vector,
            embedding_model=embedding_model,
            limit=request.limit,
            similarity_threshold=request.similarity_threshold,
        )
        try:
            documents = [KnowledgeSearchResult.model_validate(self._result_fields(row)) for row in records]
        except (KeyError, TypeError, ValidationError):
            raise KnowledgeDataError("Knowledge search returned invalid document data") from None
        return KnowledgeSearchResponse(
            company_id=self.company_id,
            retrieval_mode="semantic" if vector is not None else "full_text",
            documents=documents,
            context=self.prepare_context(documents, max_characters=request.max_context_characters),
        )

    def prepare_context(
        self, documents: list[KnowledgeSearchResult], *, max_characters: int = 12_000,
    ) -> str:
        """Build bounded source-labelled context without mutating or summarizing content."""
        if not 500 <= max_characters <= 50_000:
            raise ValueError("max_characters must be between 500 and 50000")
        sections: list[str] = []
        remaining = max_characters
        for document in documents:
            safe_title = " ".join(document.title.splitlines())
            prefix = f"[Knowledge source: {safe_title}]\n"
            if len(prefix) >= remaining:
                break
            content = document.content[: remaining - len(prefix)]
            section = prefix + content
            sections.append(section)
            remaining -= len(section) + 2
            if remaining <= 0:
                break
        return "\n\n".join(sections)

    def _require_company(self, company_id: UUID) -> None:
        if company_id != self.company_id:
            raise ValueError("Knowledge request belongs to another company")

    @staticmethod
    def _result_fields(record: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": record["id"],
            "title": record["title"],
            "content": record["content"],
            "relevance": record["relevance"],
        }
