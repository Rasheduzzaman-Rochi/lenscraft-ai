"""Validated call creation data."""

from uuid import UUID
from pydantic import Field
from app.schemas.base import Count, WriteData


class CallCreate(WriteData):
    """A call record; saving is an insert, not an implicit overwrite/upsert."""

    customer_id: UUID | None = None
    retell_call_id: str | None = Field(default=None, min_length=1)
    duration: Count | None = None
    transcript: str | None = None
    summary: str | None = None
    intent: str | None = None
    outcome: str | None = None
