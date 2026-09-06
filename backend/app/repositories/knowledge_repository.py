"""Tenant-scoped knowledge persistence and retrieval through Supabase."""

from collections.abc import Mapping
from typing import Any

from app.repositories.base import BaseRepository, Record, pagination
from app.schemas.knowledge import KnowledgeDocumentCreate, validate_embedding


class KnowledgeRepository(BaseRepository):
    """Store documents and search only within the repository's company."""

    async def insert_document(
        self, data: KnowledgeDocumentCreate | Mapping[str, Any],
    ) -> Record:
        """Insert a validated document; tenant identity comes from this repository."""
        document = KnowledgeDocumentCreate.model_validate(data)
        if str(document.company_id) != self.company_id:
            raise ValueError("Document does not belong to this repository company")
        payload = document.model_dump(mode="json", exclude={"company_id"})
        payload["company_id"] = self.company_id
        return await self._run(lambda client: self._one(
            client.table("knowledge_documents").insert(payload).execute(), required=True,
        ))

    async def retrieve_by_company(self, *, limit: int = 50, offset: int = 0) -> list[Record]:
        """Return a bounded page without transferring high-dimensional embeddings."""
        start, end = pagination(limit, offset)
        return await self._run(lambda client: self._rows(
            client.table("knowledge_documents").select("id,company_id,title,content,created_at,updated_at")
            .eq("company_id", self.company_id).order("created_at", desc=True).order("id")
            .range(start, end).execute(),
        ))

    async def search_documents(
        self, *, query: str, query_embedding: list[float] | None = None,
        embedding_model: str | None = None, limit: int = 5, similarity_threshold: float = 0.70,
    ) -> list[Record]:
        """Use vector similarity when supplied, otherwise database full-text search."""
        if not query.strip():
            raise ValueError("Search query must not be empty")
        if type(limit) is not int or not 1 <= limit <= 20:
            raise ValueError("limit must be an integer between 1 and 20")
        if not -1 <= similarity_threshold <= 1:
            raise ValueError("similarity_threshold must be between -1 and 1")
        if query_embedding is not None:
            if not embedding_model or not embedding_model.strip():
                raise ValueError("embedding_model is required for semantic search")
            vector = validate_embedding(query_embedding)
            function = "search_knowledge_documents_vector"
            parameters = {
                "p_company_id": self.company_id,
                "p_query_embedding": vector,
                "p_embedding_model": embedding_model.strip(),
                "p_match_threshold": similarity_threshold,
                "p_limit": limit,
            }
        else:
            if embedding_model is not None:
                raise ValueError("embedding_model requires a query embedding")
            function = "search_knowledge_documents_text"
            parameters = {"p_company_id": self.company_id, "p_query": query.strip(), "p_limit": limit}
        return await self._run(lambda client: self._rows(client.rpc(function, parameters).execute()))
