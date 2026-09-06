"""Validated contracts exposed to Retell custom functions."""

from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.schemas.base import Count, Money, WriteData
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
