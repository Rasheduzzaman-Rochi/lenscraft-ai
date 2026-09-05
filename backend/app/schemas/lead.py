"""Validated lead creation data."""

from uuid import UUID
from pydantic import Field
from app.schemas.base import Money, WriteData


class LeadCreate(WriteData):
    """Lead columns; optional ID allows callers to preserve an existing draft ID."""

    id: UUID | None = None
    customer_id: UUID | None = None
    source: str | None = None
    intent: str | None = None
    status: str = Field(default="new", min_length=1)
    estimated_value: Money | None = None
