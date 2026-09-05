"""Validated inputs, database pricing contracts, and calculated quote output."""

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator
from app.schemas.base import Count, Money


class QuoteCalculateRequest(BaseModel):
    """Client selects add-on codes, never prices or rule values."""

    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    company_id: UUID
    service_name: str = Field(min_length=1, max_length=200)
    image_count: Count
    addons: list[str] = Field(default_factory=list, max_length=100)

    @field_validator('addons')
    @classmethod
    def validate_addons(cls, codes: list[str]) -> list[str]:
        if any(not code or len(code) > 100 for code in codes) or len(set(codes)) != len(codes):
            raise ValueError('Add-on codes must be nonblank, unique, and at most 100 characters')
        return codes


class PricingRule(BaseModel):
    """Validate database records; metadata from the tenant join is ignored."""

    id: UUID
    service_id: UUID
    rule_type: Literal['base', 'per_image', 'addon']
    value: Money
    condition: dict = Field(default_factory=dict)


class AddonCondition(BaseModel):
    """Supported add-on condition; additional keys cannot be silently ignored."""

    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    code: str = Field(min_length=1, max_length=100)
    pricing_type: Literal['fixed', 'per_image']


class QuoteCalculation(BaseModel):
    """Subtotal in company currency; no quote is persisted by this operation."""

    service: str
    base_price: Money
    addons: Money
    total_price: Money

    @field_serializer('base_price', 'addons', 'total_price', when_used='json')
    def numeric_amount(self, amount: Decimal) -> float:
        """Expose JSON numbers; internal calculations retain Decimal precision."""
        return float(amount)
