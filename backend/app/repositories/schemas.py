"""Validated write contracts; caller payloads cannot change tenant ownership."""

from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, JsonValue, field_validator, model_validator

Money = Annotated[Decimal, Field(ge=0, allow_inf_nan=False, max_digits=18, decimal_places=4)]
Count = Annotated[int, Field(ge=0, le=2147483647, strict=True)]


class WriteData(BaseModel):
    """Reject unknown fields and normalize surrounding string whitespace."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, revalidate_instances="always")


class CustomerCreate(WriteData):
    """Customer columns accepted for insertion."""

    name: str = Field(min_length=1)
    email: str | None = None
    phone: str | None = None
    business_name: str | None = None
    industry: str | None = None

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        """Store canonical email strings; an empty value means no known email."""
        return value.lower() if value else None


class CustomerUpdate(CustomerCreate):
    """Partial customer changes; omitted fields are preserved, nulls clear contacts."""

    name: str | None = Field(default=None, min_length=1)

    @model_validator(mode='after')
    def name_cannot_be_cleared(self) -> 'CustomerUpdate':
        """Omission is allowed, but an explicit null violates the table contract."""
        if 'name' in self.model_fields_set and self.name is None:
            raise ValueError('Customer name cannot be null')
        return self


class LeadCreate(WriteData):
    """Lead columns; optional ID allows callers to preserve an existing draft ID."""

    id: UUID | None = None
    customer_id: UUID | None = None
    source: str | None = None
    intent: str | None = None
    status: str = Field(default="new", min_length=1)
    estimated_value: Money | None = None


class StatusUpdate(WriteData):
    """Validate status text without prescribing a business state machine."""

    status: str = Field(min_length=1)


class CallCreate(WriteData):
    """A call record; saving is an insert, not an implicit overwrite/upsert."""

    customer_id: UUID | None = None
    retell_call_id: str | None = Field(default=None, min_length=1)
    duration: Count | None = None
    transcript: str | None = None
    summary: str | None = None
    intent: str | None = None
    outcome: str | None = None


class ProjectCreate(WriteData):
    """Project columns; a deadline must identify an absolute instant."""

    customer_id: UUID
    service_type: str | None = None
    product_category: str | None = None
    product_count: Count | None = None
    image_count: Count | None = None
    deadline: AwareDatetime | None = None
    status: str = Field(default="draft", min_length=1)


class QuoteCreate(WriteData):
    """Already calculated quote amounts; this adapter performs no pricing logic."""

    base_price: Money = Decimal(0)
    addons: list[dict[str, JsonValue]] = Field(default_factory=list)
    discount: Money = Decimal(0)
    tax: Money = Decimal(0)
    total_price: Money
    status: str = Field(default="draft", min_length=1)
