"""Tenant-scoped read queries for the internal administration surface."""

from typing import Any
from uuid import UUID

from app.repositories.base import BaseRepository, Record, pagination
from app.repositories.errors import RepositoryError
from app.schemas.booking import BookingStatus


class AdminRepository(BaseRepository):
    """Read operational data for one trusted company without exposing Supabase."""

    @staticmethod
    def _exact_count(response: Any) -> int:
        count = getattr(response, "count", None)
        if type(count) is not int or count < 0:
            raise RepositoryError("Database returned an invalid count")
        return count

    @staticmethod
    def _customer_map(rows: list[Record]) -> dict[str, Record]:
        return {
            str(row["id"]): row
            for row in rows
            if row.get("id") is not None
        }

    async def list_bookings(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        status: BookingStatus | None = None,
    ) -> tuple[list[Record], int]:
        """Return a bounded booking page with tenant-owned customer contacts."""
        first, last = pagination(limit, offset)

        def execute(client) -> tuple[list[Record], int]:
            query = (
                client.table("bookings")
                .select(
                    "id,customer_id,service_type,date_time,status,notes,created_at",
                    count="exact",
                )
                .eq("company_id", self.company_id)
            )
            if status is not None:
                query = query.eq("status", status.value)
            response = query.order("date_time", desc=True).range(first, last).execute()
            bookings = self._rows(response)
            total = self._exact_count(response)

            customer_ids = sorted({
                str(row["customer_id"])
                for row in bookings
                if row.get("customer_id") is not None
            })
            customers: list[Record] = []
            if customer_ids:
                customers = self._rows(
                    client.table("customers")
                    .select("id,name,email,phone")
                    .eq("company_id", self.company_id)
                    .in_("id", customer_ids)
                    .limit(100)
                    .execute()
                )
            customer_by_id = self._customer_map(customers)

            results = []
            for booking in bookings:
                customer = customer_by_id.get(str(booking.get("customer_id")), {})
                results.append({
                    "id": booking.get("id"),
                    "customer_name": customer.get("name"),
                    "email": customer.get("email"),
                    "phone": customer.get("phone"),
                    "service": booking.get("service_type"),
                    "date_time": booking.get("date_time"),
                    "status": booking.get("status"),
                    "notes": booking.get("notes"),
                    "created_at": booking.get("created_at"),
                })
            return results, total

        return await self._run(execute)

    async def booking_counts(self) -> dict[str, int]:
        """Return exact total, pending, and confirmed booking counts."""

        def execute(client) -> dict[str, int]:
            def count(status: BookingStatus | None = None) -> int:
                query = (
                    client.table("bookings")
                    .select("id", count="exact", head=True)
                    .eq("company_id", self.company_id)
                )
                if status is not None:
                    query = query.eq("status", status.value)
                return self._exact_count(query.execute())

            return {
                "total": count(),
                "pending": count(BookingStatus.PENDING),
                "confirmed": count(BookingStatus.CONFIRMED),
            }

        return await self._run(execute)

    async def recent_leads(self, *, limit: int = 6) -> list[Record]:
        """Return recent leads and their tenant-owned customer identity fields."""
        if type(limit) is not int or not 1 <= limit <= 20:
            raise ValueError("limit must be an integer between 1 and 20")

        def execute(client) -> list[Record]:
            leads = self._rows(
                client.table("leads")
                .select("id,customer_id,status,intent,estimated_value,created_at")
                .eq("company_id", self.company_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            customer_ids = sorted({
                str(row["customer_id"])
                for row in leads
                if row.get("customer_id") is not None
            })
            customers: list[Record] = []
            if customer_ids:
                customers = self._rows(
                    client.table("customers")
                    .select("id,name,email")
                    .eq("company_id", self.company_id)
                    .in_("id", customer_ids)
                    .limit(100)
                    .execute()
                )
            customer_by_id = self._customer_map(customers)

            return [
                {
                    "id": lead.get("id"),
                    "customer_name": customer_by_id.get(
                        str(lead.get("customer_id")), {}
                    ).get("name"),
                    "email": customer_by_id.get(
                        str(lead.get("customer_id")), {}
                    ).get("email"),
                    "status": lead.get("status"),
                    "intent": lead.get("intent"),
                    "estimated_value": lead.get("estimated_value"),
                    "created_at": lead.get("created_at"),
                }
                for lead in leads
            ]

        return await self._run(execute)
