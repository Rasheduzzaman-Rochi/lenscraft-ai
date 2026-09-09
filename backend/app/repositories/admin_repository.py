"""Tenant-scoped read queries for the internal administration surface."""

from decimal import Decimal
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
                    .select("id,name,email,phone,business_name,industry")
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
                    "business_name": customer.get("business_name"),
                    "industry": customer.get("industry"),
                })
            return results, total

        return await self._run(execute)

    async def get_booking(self, booking_id: UUID) -> Record | None:
        """Return one tenant booking with its complete customer details."""
        booking_id = str(booking_id)

        def execute(client) -> Record | None:
            booking = self._one(
                client.table("bookings")
                .select("id,customer_id,service_type,date_time,status,notes,created_at")
                .eq("company_id", self.company_id)
                .eq("id", booking_id)
                .limit(1)
                .execute(),
            )
            if booking is None:
                return None
            customer = self._one(
                client.table("customers")
                .select("id,name,email,phone,business_name,industry")
                .eq("company_id", self.company_id)
                .eq("id", booking["customer_id"])
                .limit(1)
                .execute(),
                required=True,
            )
            return {
                "id": booking.get("id"),
                "customer_name": customer.get("name"),
                "email": customer.get("email"),
                "phone": customer.get("phone"),
                "business_name": customer.get("business_name"),
                "industry": customer.get("industry"),
                "service": booking.get("service_type"),
                "date_time": booking.get("date_time"),
                "status": booking.get("status"),
                "notes": booking.get("notes"),
                "created_at": booking.get("created_at"),
            }

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
                "rejected": count(BookingStatus.REJECTED),
                "cancelled": count(BookingStatus.CANCELLED),
            }

        return await self._run(execute)

    async def lead_stats(self) -> dict[str, int | Decimal | float]:
        """Return tenant-scoped lead volume, value, and conversion metrics."""
        def execute(client) -> dict[str, int | Decimal | float]:
            rows = self._rows(
                client.table("leads")
                .select("status,estimated_value")
                .eq("company_id", self.company_id)
                .limit(10000)
                .execute()
            )
            total = len(rows)
            converted = sum(1 for row in rows if str(row.get("status", "")).lower() == "converted")
            revenue = sum(
                (Decimal(str(row["estimated_value"])) for row in rows if row.get("estimated_value") is not None),
                Decimal("0"),
            )
            return {
                "total": total,
                "estimated_revenue": revenue,
                "converted": converted,
                "conversion_rate": (converted / total * 100) if total else 0,
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
                    .select("id,name,email,phone")
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
                    "phone": customer_by_id.get(
                        str(lead.get("customer_id")), {}
                    ).get("phone"),
                    "status": lead.get("status"),
                    "intent": lead.get("intent"),
                    "estimated_value": lead.get("estimated_value"),
                    "created_at": lead.get("created_at"),
                }
                for lead in leads
            ]

        return await self._run(execute)

    async def list_leads(self, *, limit: int = 50, offset: int = 0) -> tuple[list[Record], int]:
        """Return bounded tenant-scoped leads with customer and project details."""
        first, last = pagination(limit, offset)

        def execute(client) -> tuple[list[Record], int]:
            response = (
                client.table("leads")
                .select("id,customer_id,status,source,intent,estimated_value,created_at", count="exact")
                .eq("company_id", self.company_id)
                .order("created_at", desc=True)
                .range(first, last)
                .execute()
            )
            leads = self._rows(response)
            total = self._exact_count(response)
            customer_ids = sorted({str(row["customer_id"]) for row in leads if row.get("customer_id")})
            customers = self._rows(
                client.table("customers")
                .select("id,name,email,phone")
                .eq("company_id", self.company_id)
                .in_("id", customer_ids)
                .limit(100)
                .execute()
            ) if customer_ids else []
            customer_by_id = self._customer_map(customers)
            projects = self._rows(
                client.table("projects")
                .select("id,customer_id,service_type,product_category,product_count,image_count,deadline,status")
                .eq("company_id", self.company_id)
                .in_("customer_id", customer_ids)
                .order("created_at", desc=True)
                .limit(100)
                .execute()
            ) if customer_ids else []
            project_by_customer: dict[str, Record] = {}
            for project in projects:
                project_by_customer.setdefault(str(project.get("customer_id")), project)

            items = []
            for lead in leads:
                customer = customer_by_id.get(str(lead.get("customer_id")), {})
                project = project_by_customer.get(str(lead.get("customer_id")), {})
                items.append({
                    "id": lead.get("id"),
                    "customer_name": customer.get("name"),
                    "email": customer.get("email"),
                    "phone": customer.get("phone"),
                    "status": lead.get("status"),
                    "source": lead.get("source"),
                    "intent": lead.get("intent"),
                    "estimated_value": lead.get("estimated_value"),
                    "created_at": lead.get("created_at"),
                    "service": project.get("service_type"),
                    "project_details": project,
                })
            return items, total

        return await self._run(execute)

    async def get_lead(self, lead_id: UUID) -> Record | None:
        """Return one tenant lead with its customer and project details."""
        lead_id = str(lead_id)

        def execute(client) -> Record | None:
            lead = self._one(
                client.table("leads")
                .select("id,customer_id,status,source,intent,estimated_value,created_at")
                .eq("company_id", self.company_id)
                .eq("id", lead_id)
                .limit(1)
                .execute(),
            )
            if lead is None:
                return None
            customer = self._one(
                client.table("customers")
                .select("id,name,email,phone,business_name,industry")
                .eq("company_id", self.company_id)
                .eq("id", lead["customer_id"])
                .limit(1)
                .execute(),
                required=True,
            )
            project = self._one(
                client.table("projects")
                .select("id,service_type,product_category,product_count,image_count,deadline,status")
                .eq("company_id", self.company_id)
                .eq("customer_id", lead["customer_id"])
                .order("created_at", desc=True)
                .limit(1)
                .execute(),
            ) or {}
            return {
                "id": lead.get("id"),
                "customer_id": lead.get("customer_id"),
                "customer_name": customer.get("name"),
                "email": customer.get("email"),
                "phone": customer.get("phone"),
                "business_name": customer.get("business_name"),
                "industry": customer.get("industry"),
                "status": lead.get("status"),
                "source": lead.get("source"),
                "intent": lead.get("intent"),
                "estimated_value": lead.get("estimated_value"),
                "created_at": lead.get("created_at"),
                "service": project.get("service_type"),
                "project_details": project,
            }

        return await self._run(execute)

    async def update_lead_status(self, lead_id: UUID, status: str) -> Record:
        """Update one tenant lead status and return the changed record."""
        return await self._run(lambda client: self._one(
            client.table("leads").update({"status": status})
            .eq("company_id", self.company_id)
            .eq("id", str(lead_id))
            .execute(),
            required=True,
        ))

    async def delete_booking(self, booking_id: UUID) -> Record:
        """Delete exactly one booking owned by this repository's company."""
        return await self._run(lambda client: self._one(
            client.table("bookings").delete()
            .eq("company_id", self.company_id)
            .eq("id", str(booking_id))
            .execute(),
            required=True,
        ))

    async def delete_lead(self, lead_id: UUID) -> Record:
        """Delete exactly one lead owned by this repository's company."""
        return await self._run(lambda client: self._one(
            client.table("leads").delete()
            .eq("company_id", self.company_id)
            .eq("id", str(lead_id))
            .execute(),
            required=True,
        ))
