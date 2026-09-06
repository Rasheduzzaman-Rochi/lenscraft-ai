"""Atomic company-scoped booking persistence."""

from collections.abc import Mapping
from typing import Any

from app.repositories.base import BaseRepository, Record
from app.schemas.tools import CreateBookingRequest


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
