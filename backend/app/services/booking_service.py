"""Company-scoped booking workflows."""

from datetime import datetime
from uuid import UUID

from pydantic import AwareDatetime, TypeAdapter, ValidationError

from app.repositories.booking_repository import BookingRepository
from app.repositories.errors import RecordNotFoundError, RepositoryConflictError
from app.schemas.booking import (
    BookingAvailability,
    BookingStatus,
    UpdateBookingStatusResponse,
)


_AWARE_DATETIME = TypeAdapter(AwareDatetime)


class BookingStatusTransitionError(ValueError):
    """The requested status is not valid for the booking's current state."""


class BookingSlotConflictError(RuntimeError):
    """A confirmed booking already owns the requested exact time slot."""


class BookingService:
    """Apply booking business rules before delegating persistence."""

    def __init__(self, company_id: UUID, *, bookings: BookingRepository | None = None) -> None:
        self.company_id = company_id
        self.bookings = bookings or BookingRepository(company_id)

        if self.bookings.company_id != str(company_id):
            raise ValueError("Booking repository must belong to configured company")

    async def update_status(
        self, booking_id: UUID, status: BookingStatus,
    ) -> UpdateBookingStatusResponse:
        if status is BookingStatus.PENDING:
            raise BookingStatusTransitionError(
                "A booking status update must confirm, reject, or cancel a booking"
            )

        if status is BookingStatus.CONFIRMED:
            booking = await self.bookings.get_booking_by_id(booking_id)
            if booking is None or booking.get("status") != BookingStatus.PENDING.value:
                raise RecordNotFoundError("Pending booking not found in this company")
            if "date_time" not in booking:
                raise ValueError("Booking date_time is missing")
            availability = await self.check_availability(
                booking["date_time"],
                exclude_booking_id=booking_id,
            )
            if not availability.available:
                raise BookingSlotConflictError("That time is already booked")

        try:
            row = await self.bookings.update_booking_status(booking_id, status)
        except RepositoryConflictError:
            if status is BookingStatus.CONFIRMED:
                raise BookingSlotConflictError("That time is already booked") from None
            raise
        return UpdateBookingStatusResponse(
            booking_id=row["id"],
            status=row["status"],
            message=f"Booking {status.value} successfully",
        )

    async def check_availability(
        self,
        date_time: datetime,
        *,
        exclude_booking_id: UUID | None = None,
    ) -> BookingAvailability:
        """Classify confirmed blockers and informational pending collisions."""
        try:
            normalized_time = _AWARE_DATETIME.validate_python(date_time)
        except ValidationError:
            raise ValueError("Booking date_time is invalid") from None
        conflicts = await self.bookings.find_booking_conflicts(
            normalized_time,
            exclude_booking_id=exclude_booking_id,
        )
        try:
            statuses = {BookingStatus(row["status"]) for row in conflicts}
        except (KeyError, TypeError, ValueError):
            raise ValueError("Booking conflict data is invalid") from None
        if BookingStatus.CONFIRMED in statuses:
            return BookingAvailability(
                available=False,
                reason="confirmed_booking_exists",
                message="That time is already booked.",
            )
        if BookingStatus.PENDING in statuses:
            return BookingAvailability(
                available=True,
                pending_conflict=True,
                message="That time has another pending booking request.",
            )
        return BookingAvailability(available=True)
