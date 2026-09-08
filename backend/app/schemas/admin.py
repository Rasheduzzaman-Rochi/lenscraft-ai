"""Validated read models for the internal studio administration API."""

from decimal import Decimal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field

from app.schemas.booking import BookingStatus


class AdminBooking(BaseModel):
    """A booking with the minimum customer details needed by studio staff."""

    id: UUID
    customer_name: str = Field(min_length=1, max_length=500)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=50)
    service: str | None = Field(default=None, max_length=500)
    date_time: AwareDatetime
    status: BookingStatus
    notes: str | None = Field(default=None, max_length=5_000)
    created_at: AwareDatetime
    business_name: str | None = Field(default=None, max_length=500)
    industry: str | None = Field(default=None, max_length=200)


class AdminBookingList(BaseModel):
    """Bounded page of company bookings."""

    items: list[AdminBooking]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


class AdminLead(BaseModel):
    """Recent lead information suitable for the dashboard."""

    id: UUID
    customer_name: str | None = Field(default=None, max_length=500)
    email: str | None = Field(default=None, max_length=320)
    status: str = Field(min_length=1, max_length=100)
    intent: str | None = Field(default=None, max_length=1_000)
    estimated_value: Decimal | None = Field(default=None, ge=0)
    created_at: AwareDatetime
    phone: str | None = Field(default=None, max_length=50)
    service: str | None = Field(default=None, max_length=500)
    project_details: dict[str, object] = Field(default_factory=dict)


class AdminLeadList(BaseModel):
    items: list[AdminLead]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


class AdminBookingStats(BaseModel):
    total: int = Field(ge=0)
    pending: int = Field(ge=0)
    confirmed: int = Field(ge=0)
    rejected: int = Field(default=0, ge=0)
    cancelled: int = Field(default=0, ge=0)


class AdminDashboard(BaseModel):
    """Summary data for the internal studio dashboard."""

    bookings: AdminBookingStats
    recent_leads: list[AdminLead]
