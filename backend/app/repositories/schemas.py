"""Compatibility exports for repository write contracts."""

from decimal import Decimal
from pydantic import Field, JsonValue
from app.schemas.base import Money, WriteData
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.schemas.lead import LeadCreate
from app.schemas.call import CallCreate
from app.schemas.project import ProjectCreate

__all__ = ["CustomerCreate", "CustomerUpdate", "LeadCreate", "CallCreate", "ProjectCreate", "StatusUpdate", "QuoteCreate"]


class StatusUpdate(WriteData):
    """Validate status text without prescribing a business state machine."""

    status: str = Field(min_length=1)


class QuoteCreate(WriteData):
    """Already calculated quote amounts; this adapter performs no pricing logic."""

    base_price: Money = Decimal(0)
    addons: list[dict[str, JsonValue]] = Field(default_factory=list)
    discount: Money = Decimal(0)
    tax: Money = Decimal(0)
    total_price: Money
    status: str = Field(default="draft", min_length=1)
