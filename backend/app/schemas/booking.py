"""Validated booking status contracts."""

from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BookingStatus(StrEnum):
    """Statuses supported by the booking workflow."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class UpdateBookingStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    company_id: UUID
    status: BookingStatus


class UpdateBookingStatusResponse(BaseModel):
    booking_id: UUID
    status: BookingStatus
    message: str


class BookingAvailability(BaseModel):
    """Service-layer decision for one exact appointment instant."""

    available: bool
    pending_conflict: bool = False
    reason: Literal["confirmed_booking_exists"] | None = None
    message: str | None = Field(default=None, max_length=200)
