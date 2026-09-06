"""Tolerant Retell webhook inputs and stable internal event contracts."""

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator


class TranscriptInformation(BaseModel):
    """One transcript utterance; unknown provider fields remain available."""

    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    role: str = Field(min_length=1, max_length=50)
    content: str = Field(default="", max_length=100_000)


class CallInformation(BaseModel):
    """Retell call fields used by LensCraft; the provider may add more fields."""

    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    call_id: str = Field(min_length=1, max_length=200)
    agent_id: str | None = Field(default=None, max_length=200)
    transcript: str | None = Field(default=None, max_length=1_000_000)
    transcript_object: list[TranscriptInformation] = Field(default_factory=list, max_length=10_000)
    metadata: dict[str, JsonValue] = Field(default_factory=dict)
    start_timestamp: int | None = Field(default=None, ge=0)
    end_timestamp: int | None = Field(default=None, ge=0)
    call_analysis: dict[str, JsonValue] | None = None

    @field_validator("metadata", "call_analysis")
    @classmethod
    def bound_mapping(cls, value: dict[str, JsonValue] | None) -> dict[str, JsonValue] | None:
        if value is not None and len(value) > 500:
            raise ValueError("Retell mapping contains too many fields")
        return value


class RetellWebhookRequest(BaseModel):
    """Voice webhook envelope. Extra top-level transfer fields are tolerated."""

    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    event: str = Field(min_length=1, max_length=100)
    call: CallInformation


class NormalizedRetellCall(BaseModel):
    """Stable representation consumed by LensCraft services."""

    model_config = ConfigDict(frozen=True)

    call_id: str
    event_type: str
    transcript: str
    transcript_items: tuple[TranscriptInformation, ...]
    metadata: dict[str, JsonValue]
    duration_seconds: int | None = None


class RetellProcessingResult(BaseModel):
    """Internal processing result with no transcript or metadata disclosure."""

    call: NormalizedRetellCall
    status: Literal["processed", "ignored"]
    requirements: dict[str, Any] = Field(default_factory=dict)


class RetellWebhookResponse(BaseModel):
    """Compact acknowledgement returned to Retell within its webhook timeout."""

    received: Literal[True] = True
    call_id: str
    event_type: str
    status: Literal["processed", "ignored"]
    message: str
    company_id: UUID
