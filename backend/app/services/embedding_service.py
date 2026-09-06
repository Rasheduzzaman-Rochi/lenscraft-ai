"""Provider-neutral embedding interface; no external API is configured here."""

from collections.abc import Sequence
from typing import Protocol, runtime_checkable

from app.schemas.knowledge import validate_embedding


class EmbeddingProviderUnavailableError(RuntimeError):
    """Semantic embedding was requested without a configured provider."""


@runtime_checkable
class EmbeddingProvider(Protocol):
    """Contract implemented later by an OpenAI, local, or other provider adapter."""

    @property
    def model_name(self) -> str:
        """Stable model identifier used to track embedding compatibility."""
        ...

    @property
    def dimensions(self) -> int:
        """Number of vector dimensions produced by this provider."""
        ...

    async def embed(self, text: str) -> Sequence[float]:
        """Return one embedding for nonblank input text."""
        ...


class EmbeddingService:
    """Validate provider output while keeping provider selection outside business logic."""

    def __init__(self, provider: EmbeddingProvider | None = None) -> None:
        self._provider = provider

    @property
    def configured(self) -> bool:
        return self._provider is not None

    @property
    def model_name(self) -> str | None:
        """Return the configured compatibility identifier without exposing a provider."""
        return self._provider.model_name if self._provider is not None else None

    async def create_embedding(self, text: str) -> list[float]:
        """Create and validate one embedding, or fail explicitly when unavailable."""
        text = text.strip()
        if not text:
            raise ValueError("Embedding input must not be empty")
        if self._provider is None:
            raise EmbeddingProviderUnavailableError("No embedding provider is configured")
        if not self._provider.model_name.strip() or len(self._provider.model_name) > 200:
            raise ValueError("Embedding provider model name is invalid")
        if not 1 <= self._provider.dimensions <= 16000:
            raise ValueError("Embedding provider dimensions are invalid")
        vector = validate_embedding(list(await self._provider.embed(text)))
        if len(vector) != self._provider.dimensions:
            raise ValueError("Embedding provider returned an unexpected vector dimension")
        return vector
