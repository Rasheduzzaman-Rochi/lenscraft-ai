"""Internal administration orchestration."""

from uuid import UUID

from pydantic import ValidationError

from app.repositories.admin_repository import AdminRepository
from app.schemas.admin import (
    AdminBookingCreate,
    AdminBooking,
    AdminBookingList,
    AdminBookingStats,
    AdminDashboard,
    AdminLead,
    AdminLeadList,
    AdminLeadStats,
    AdminLeadStatusUpdate,
)
from app.schemas.booking import BookingStatus
from app.schemas.tools import CreateBookingResponse


class AdminDataError(ValueError):
    """Stored administration data does not satisfy the public response contract."""


class AdminService:
    """Prepare tenant-scoped operational data for authenticated staff."""

    def __init__(self, company_id: UUID, *, repository: AdminRepository | None = None) -> None:
        self.company_id = company_id
        self.repository = repository or AdminRepository(company_id)
        if self.repository.company_id != str(company_id):
            raise ValueError("Admin repository must belong to configured company")

    async def list_bookings(
        self,
        *,
        limit: int,
        offset: int,
        status: BookingStatus | None,
    ) -> AdminBookingList:
        rows, total = await self.repository.list_bookings(
            limit=limit,
            offset=offset,
            status=status,
        )
        try:
            return AdminBookingList(
                items=[AdminBooking.model_validate(row) for row in rows],
                total=total,
                limit=limit,
                offset=offset,
            )
        except ValidationError:
            raise AdminDataError("Stored booking data is invalid") from None

    async def dashboard(self) -> AdminDashboard:
        counts = await self.repository.booking_counts()
        lead_stats = await self.repository.lead_stats()
        leads = await self.repository.recent_leads()
        try:
            return AdminDashboard(
                bookings=AdminBookingStats.model_validate(counts),
            leads=AdminLeadStats.model_validate(lead_stats),
                recent_leads=[AdminLead.model_validate(row) for row in leads],
            )
        except ValidationError:
            raise AdminDataError("Stored dashboard data is invalid") from None

    async def get_booking(self, booking_id: UUID) -> AdminBooking:
        row = await self.repository.get_booking(booking_id)
        if row is None:
            raise KeyError("booking not found")
        try:
            return AdminBooking.model_validate(row)
        except ValidationError:
            raise AdminDataError("Stored booking data is invalid") from None

    async def list_leads(self, *, limit: int, offset: int) -> AdminLeadList:
        rows, total = await self.repository.list_leads(limit=limit, offset=offset)
        try:
            return AdminLeadList(
                items=[AdminLead.model_validate(row) for row in rows],
                total=total,
                limit=limit,
                offset=offset,
            )
        except ValidationError:
            raise AdminDataError("Stored lead data is invalid") from None

    async def get_lead(self, lead_id: UUID) -> AdminLead:
        row = await self.repository.get_lead(lead_id)
        if row is None:
            raise KeyError("lead not found")
        try:
            return AdminLead.model_validate(row)
        except ValidationError:
            raise AdminDataError("Stored lead data is invalid") from None

    async def update_lead_status(self, lead_id: UUID, status: AdminLeadStatusUpdate) -> AdminLead:
        row = await self.repository.update_lead_status(lead_id, status.status)
        lead = await self.get_lead(lead_id)
        return lead
