"""Conversation and lead-processing API contracts."""

from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.customer import CustomerCreate


class CustomerRequirements(BaseModel):
    """Known customer needs; blanks and None mean information is not yet known."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, frozen=True)

    product_category: str = ""
    service_type: str = ""
    product_count: int | None = Field(default=None, ge=0, strict=True)
    image_count: int | None = Field(default=None, ge=0, strict=True)
    deadline: str = ""
    purpose: str = ""


class ConversationInput(BaseModel):
    """Adapter input; extracted_information must already contain structured facts.

    Transcript and messages are accepted for future processors, but this initial
    layer does not extract facts from them. Deadline remains customer-provided
    text until a future workflow resolves its date and time zone.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    transcript: str = ""
    customer_messages: tuple[str, ...] = ()
    extracted_information: CustomerRequirements = Field(default_factory=CustomerRequirements)


class ProcessConversationRequest(BaseModel):
    """Bound transcript size and reject tenant IDs or unrelated caller fields."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    transcript: str = Field(min_length=1, max_length=100_000)


class ExtractedConversation(BaseModel):
    """Customer details and requirements explicitly supplied in labeled text."""

    customer: CustomerCreate
    requirements: CustomerRequirements


class ProcessConversationResponse(BaseModel):
    """IDs returned only after all four database operations report success."""

    success: Literal[True] = True
    customer_id: UUID
    lead_id: UUID
    project_id: UUID
    message: str = "Lead processed successfully"
