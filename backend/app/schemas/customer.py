"""Validated customer creation data."""

from pydantic import Field, field_validator, model_validator
from app.schemas.base import WriteData


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
