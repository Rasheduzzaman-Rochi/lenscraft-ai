"""Validated contracts exposed to Retell custom functions."""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.schemas.base import Count, Money, WriteData
from app.schemas.booking import BookingAvailability, BookingStatus
from app.schemas.customer import CustomerCreate
from app.schemas.quote import QuoteCalculateRequest, QuoteCalculation


class ToolRequest(BaseModel):
    """Reject model-generated fields that are outside a tool's contract."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SearchServiceRequest(ToolRequest):
    company_id: UUID
    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=5, ge=1, le=10, strict=True)


class ServiceMatch(BaseModel):
    id: UUID
    name: str
    category: str | None = None
    description: str | None = Field(default=None, max_length=1_000)
    pricing_type: str
    relevance: float = Field(ge=0, allow_inf_nan=False)


class SearchServiceResponse(BaseModel):
    services: list[ServiceMatch]


class CalculateQuoteRequest(QuoteCalculateRequest):
    """Retell-facing alias for the existing validated pricing contract."""


class CalculateQuoteResponse(QuoteCalculation):
    """Retell-facing alias for the existing quote calculation."""


class LeadDetails(WriteData):
    source: str = Field(default="retell", min_length=1, max_length=100)
    intent: str | None = Field(default=None, max_length=1_000)
    status: str = Field(default="new", min_length=1, max_length=100)
    estimated_value: Money | None = None


class ProjectRequirements(WriteData):
    service_type: str | None = Field(default=None, max_length=500)
    product_category: str | None = Field(default=None, max_length=500)
    product_count: Count | None = None
    image_count: Count | None = None
    deadline: AwareDatetime | None = None
    status: str = Field(default="draft", min_length=1, max_length=100)


class CreateLeadRequest(ToolRequest):
    """One idempotent customer, lead, and project command."""

    company_id: UUID
    request_id: str = Field(min_length=1, max_length=200, pattern=r"^[A-Za-z0-9_.:-]+$")
    customer: CustomerCreate
    lead: LeadDetails = Field(default_factory=LeadDetails)
    project: ProjectRequirements


class CreateLeadResponse(BaseModel):
    success: bool = True
    customer_id: UUID
    lead_id: UUID
    project_id: UUID
    replayed: bool = False
    message: str = "Lead created successfully"


class SearchKnowledgeRequest(ToolRequest):
    company_id: UUID
    question: str = Field(min_length=1, max_length=10_000)
    limit: int = Field(default=5, ge=1, le=10, strict=True)


class KnowledgeSource(BaseModel):
    id: UUID
    title: str
    relevance: float = Field(ge=-1, allow_inf_nan=False)


class SearchKnowledgeResponse(BaseModel):
    context: str = Field(max_length=6_000)
    sources: list[KnowledgeSource]
    retrieval_mode: Literal["semantic", "full_text"]


class CreateBookingRequest(ToolRequest):
    """Validated customer and appointment data for one booking command."""

    company_id: UUID
    customer: CustomerCreate
    date_time: AwareDatetime
    service_type: str = Field(min_length=1, max_length=500)
    notes: str | None = Field(default=None, max_length=5_000)

    @field_validator("date_time")
    @classmethod
    def booking_must_be_in_future(cls, value: datetime) -> datetime:
        """Reject appointments that have already passed."""
        if value <= datetime.now(UTC):
            raise ValueError("date_time must be in the future")
        return value

    @field_validator("notes")
    @classmethod
    def empty_notes_are_absent(cls, value: str | None) -> str | None:
        return value or None


class CreateBookingResponse(BaseModel):
    success: bool = True
    customer_id: UUID
    booking_id: UUID
    status: Literal["pending"] = "pending"
    pending_conflict: Literal[True] | None = None
    message: str = "Booking created successfully"


class CreateBookingConflictResponse(BaseModel):
    success: Literal[False] = False
    conflict: Literal[True] = True
    message: str = "That time is not available."


CreateBookingResult = CreateBookingResponse | CreateBookingConflictResponse


class CheckBookingAvailabilityRequest(ToolRequest):
    company_id: UUID
    date_time: AwareDatetime


class CheckBookingAvailabilityResponse(BookingAvailability):
    """Retell-facing exact-slot availability result."""


class GetBookingStatusRequest(ToolRequest):
    """Strong identifiers accepted for a customer-facing booking lookup."""

    company_id: UUID
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=50)
    booking_id: UUID | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        return value.lower() if value else None

    @field_validator("phone")
    @classmethod
    def empty_phone_is_absent(cls, value: str | None) -> str | None:
        return value or None

    @model_validator(mode="after")
    def require_strong_identifier(self) -> "GetBookingStatusRequest":
        if self.booking_id is None and self.email is None and self.phone is None:
            raise ValueError("Provide booking_id, email, or phone")
        return self


class GetBookingStatusResponse(BaseModel):
    """Minimal booking information safe to return to a voice agent."""

    found: bool
    booking_id: UUID | None = None
    service_type: str | None = Field(default=None, max_length=500)
    date_time: AwareDatetime | None = None
    status: BookingStatus | None = None
    message: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def validate_result_shape(self) -> "GetBookingStatusResponse":
        if self.found and (
            self.booking_id is None or self.date_time is None or self.status is None
        ):
            raise ValueError("A found booking requires booking_id, date_time, and status")
        if not self.found and not self.message:
            raise ValueError("A missing booking requires a neutral message")
        return self
