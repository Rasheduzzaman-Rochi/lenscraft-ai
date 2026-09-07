"""Atomic company-scoped booking persistence."""

from collections.abc import Mapping
from datetime import datetime
from typing import Any
from uuid import UUID

from app.repositories.base import BaseRepository, Record, identifier
from app.schemas.booking import BookingStatus
from app.schemas.tools import CreateBookingRequest


_STATUS_COLUMNS = "id,service_type,date_time,status"


class BookingRepository(BaseRepository):
    """Persist a customer and booking together through a transactional RPC."""

    async def create_booking(
        self, data: CreateBookingRequest | Mapping[str, Any],
    ) -> Record:
        """Create both records atomically and return their identifiers."""
        request = CreateBookingRequest.model_validate(data)
        if str(request.company_id) != self.company_id:
            raise ValueError("Booking does not belong to this repository company")
        parameters = {
            "p_company_id": self.company_id,
            "p_customer": request.customer.model_dump(mode="json"),
            "p_date_time": request.date_time.isoformat(),
            "p_service_type": request.service_type,
            "p_notes": request.notes,
        }
        return await self._run(lambda client: self._one(
            client.rpc("create_booking_tool_workflow", parameters).execute(),
            required=True,
        ))

    async def update_booking_status(
        self, booking_id: str, status: BookingStatus,
    ) -> Record:
        """Update one booking status within this repository's company."""
        booking_id = identifier(booking_id)
        return await self._run(lambda client: self._one(
            client.table("bookings").update({"status": status.value})
            .eq("company_id", self.company_id)
            .eq("id", booking_id)
            .eq("status", BookingStatus.PENDING.value)
            .execute(),
            required=True,
        ))

    async def find_booking_conflicts(
        self,
        date_time: datetime,
        *,
        exclude_booking_id: UUID | None = None,
    ) -> list[Record]:
        """Return only confirmed and pending bookings at one tenant-scoped instant."""
        if date_time.tzinfo is None or date_time.utcoffset() is None:
            raise ValueError("date_time must include a timezone")
        excluded_id = (
            identifier(exclude_booking_id) if exclude_booking_id is not None else None
        )

        def execute(client) -> list[Record]:
            query = (
                client.table("bookings")
                .select("id,date_time,status")
                .eq("company_id", self.company_id)
                .eq("date_time", date_time.isoformat())
                .in_("status", [
                    BookingStatus.CONFIRMED.value,
                    BookingStatus.PENDING.value,
                ])
            )
            if excluded_id is not None:
                query = query.neq("id", excluded_id)
            return self._rows(query.limit(10).execute())

        return await self._run(execute)

    async def get_booking_by_id(
        self,
        booking_id: UUID,
        *,
        email: str | None = None,
        phone: str | None = None,
    ) -> Record | None:
        """Find one tenant booking and optionally verify its customer's contacts."""
        booking_id = identifier(booking_id)
        normalized_email = self._normalize_email(email)
        normalized_phone = self._normalize_phone(phone)

        def execute(client) -> Record | None:
            booking = self._one(
                client.table("bookings")
                .select(f"{_STATUS_COLUMNS},customer_id")
                .eq("company_id", self.company_id)
                .eq("id", booking_id)
                .limit(1)
                .execute(),
            )
            if booking is None:
                return None

            if normalized_email is not None or normalized_phone is not None:
                customer_query = (
                    client.table("customers")
                    .select("id")
                    .eq("company_id", self.company_id)
                    .eq("id", booking["customer_id"])
                )
                if normalized_email is not None:
                    customer_query = customer_query.eq("email", normalized_email)
                if normalized_phone is not None:
                    customer_query = customer_query.eq("phone", normalized_phone)
                if self._one(customer_query.limit(1).execute()) is None:
                    return None

            return {key: booking.get(key) for key in _STATUS_COLUMNS.split(",")}

        return await self._run(execute)

    async def find_customer_bookings(
        self,
        *,
        email: str | None,
        phone: str | None,
        reference_time: datetime,
        limit: int = 3,
    ) -> list[Record]:
        """Return bounded upcoming then recent candidates for matching contacts."""
        normalized_email = self._normalize_email(email)
        normalized_phone = self._normalize_phone(phone)
        if normalized_email is None and normalized_phone is None:
            raise ValueError("email or phone is required")
        if type(limit) is not int or not 1 <= limit <= 3:
            raise ValueError("limit must be an integer between 1 and 3")
        if reference_time.tzinfo is None or reference_time.utcoffset() is None:
            raise ValueError("reference_time must include a timezone")
        reference = reference_time.isoformat()

        def execute(client) -> list[Record]:
            customer_query = (
                client.table("customers")
                .select("id")
                .eq("company_id", self.company_id)
            )
            if normalized_email is not None:
                customer_query = customer_query.eq("email", normalized_email)
            if normalized_phone is not None:
                customer_query = customer_query.eq("phone", normalized_phone)
            customers = self._rows(customer_query.limit(100).execute())
            customer_ids = [row.get("id") for row in customers if row.get("id")]
            if not customer_ids:
                return []

            def booking_query():
                return (
                    client.table("bookings")
                    .select(_STATUS_COLUMNS)
                    .eq("company_id", self.company_id)
                    .in_("customer_id", customer_ids)
                )

            upcoming = self._rows(
                booking_query().gte("date_time", reference)
                .order("date_time", desc=False)
                .limit(limit)
                .execute()
            )
            recent = self._rows(
                booking_query().lt("date_time", reference)
                .order("date_time", desc=True)
                .limit(limit)
                .execute()
            )
            return upcoming + recent

        return await self._run(execute)

    @staticmethod
    def _normalize_email(value: str | None) -> str | None:
        normalized = value.strip().lower() if value else ""
        return normalized or None

    @staticmethod
    def _normalize_phone(value: str | None) -> str | None:
        normalized = value.strip() if value else ""
        return normalized or None
