"""Internal administration orchestration."""

from uuid import UUID

from pydantic import ValidationError

from app.repositories.admin_repository import AdminRepository
from app.schemas.admin import (
    AdminBooking,
    AdminBookingList,
    AdminBookingStats,
    AdminDashboard,
    AdminLead,
)
from app.schemas.booking import BookingStatus


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
        leads = await self.repository.recent_leads()
        try:
            return AdminDashboard(
                bookings=AdminBookingStats.model_validate(counts),
                recent_leads=[AdminLead.model_validate(row) for row in leads],
            )
        except ValidationError:
            raise AdminDataError("Stored dashboard data is invalid") from None
