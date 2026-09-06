"""Knowledge ingestion, retrieval, and context contracts."""

from math import isfinite
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

EmbeddingVector = Annotated[list[float], Field(min_length=1, max_length=16000)]


def validate_embedding(values: list[object]) -> list[float]:
    """Reject non-finite vectors and normalize numeric values to floats."""
    if any(isinstance(value, bool) or not isinstance(value, (int, float)) for value in values):
        raise ValueError("Embedding values must be numbers, not booleans or strings")
    normalized = [float(value) for value in values]
    if not all(isfinite(value) for value in normalized):
        raise ValueError("Embedding values must be finite")
    return normalized


class KnowledgeDocumentCreate(BaseModel):
    """A tenant document; embedding may be supplied by a trusted caller."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    company_id: UUID
    title: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1, max_length=1_000_000)
    embedding: EmbeddingVector | None = None
    embedding_model: str | None = Field(default=None, min_length=1, max_length=200)

    @field_validator("embedding", mode="before")
    @classmethod
    def finite_embedding(cls, values: list[float] | None) -> list[float] | None:
        return validate_embedding(values) if values is not None else None

    @model_validator(mode="after")
    def embedding_requires_model(self) -> "KnowledgeDocumentCreate":
        if (self.embedding is None) != (self.embedding_model is None):
            raise ValueError("embedding and embedding_model must be supplied together")
        return self


class KnowledgeDocument(BaseModel):
    """Saved knowledge document metadata returned by the API."""

    id: UUID
    company_id: UUID
    title: str
    content: str
    has_embedding: bool
    embedding_model: str | None = None


class KnowledgeSearchRequest(BaseModel):
    """Search input; query_embedding enables semantic retrieval without a provider."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    company_id: UUID
    query: str = Field(min_length=1, max_length=10_000)
    query_embedding: EmbeddingVector | None = None
    embedding_model: str | None = Field(default=None, min_length=1, max_length=200)
    limit: int = Field(default=5, ge=1, le=20, strict=True)
    similarity_threshold: float = Field(default=0.70, ge=-1, le=1, allow_inf_nan=False)
    max_context_characters: int = Field(default=12_000, ge=500, le=50_000, strict=True)

    @field_validator("query_embedding", mode="before")
    @classmethod
    def finite_query_embedding(cls, values: list[float] | None) -> list[float] | None:
        return validate_embedding(values) if values is not None else None

    @model_validator(mode="after")
    def query_embedding_requires_model(self) -> "KnowledgeSearchRequest":
        if (self.query_embedding is None) != (self.embedding_model is None):
            raise ValueError("query_embedding and embedding_model must be supplied together")
        return self


class KnowledgeSearchResult(BaseModel):
    """One relevant source and its normalized relevance score."""

    id: UUID
    title: str
    content: str = Field(max_length=50_000)
    relevance: float = Field(ge=-1, allow_inf_nan=False)


class KnowledgeSearchResponse(BaseModel):
    """Retrieved sources plus bounded context ready for an agent prompt."""

    company_id: UUID
    retrieval_mode: Literal["semantic", "full_text"]
    documents: list[KnowledgeSearchResult]
    context: str
