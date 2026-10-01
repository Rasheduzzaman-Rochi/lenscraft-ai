"""Tenant-scoped management queries for the internal administration surface.

The shared server key bypasses RLS, so every statement filters on this
repository's company or on a parent record already verified to belong to it.
"""

import re
from datetime import datetime
from typing import Any
from uuid import UUID

from supabase import Client

from app.repositories.base import BaseRepository, Record, identifier, pagination
from app.repositories.errors import RecordChangedError, RecordNotFoundError, RepositoryError

_SEARCH_UNSAFE = re.compile(r"[^\w\s@.+'\-]", re.UNICODE)
_SERVICE_COLUMNS = "id,name,category,description,pricing_type,is_active,created_at,updated_at"
_RULE_COLUMNS = (
    "id,service_id,rule_type,value,condition,created_at,updated_at,"
    "services!inner(name,is_active,company_id)"
)
_CUSTOMER_COLUMNS = "id,name,email,phone,business_name,industry,created_at,updated_at"
_PROJECT_COLUMNS = (
    "id,customer_id,service_type,product_category,product_count,image_count,"
    "deadline,status,created_at,updated_at"
)
_LEAD_COLUMNS = "id,customer_id,status,source,intent,estimated_value,created_at"
_KNOWLEDGE_COLUMNS = "id,title,content,embedding_model,created_at,updated_at"
_SETTINGS_COLUMNS = "currency,timezone,tax_rate,business_hours,settings,updated_at"


def search_term(value: str | None) -> str | None:
    """Reduce free text to characters that cannot alter PostgREST filter syntax."""
    if value is None:
        return None
    cleaned = " ".join(_SEARCH_UNSAFE.sub(" ", value).split())[:100]
    return cleaned or None


def _ilike_any(columns: tuple[str, ...], term: str) -> list[str]:
    return [f"{column}.ilike.*{term}*" for column in columns]


def _exact_count(response: Any) -> int:
    count = getattr(response, "count", None)
    if type(count) is not int or count < 0:
        raise RepositoryError("Database returned an invalid count")
    return count


class AdminRecordsRepository(BaseRepository):
    """CRUD for services, pricing, customers, leads, projects, knowledge, and settings."""

    # Shared helpers -------------------------------------------------------

    def _matching_customer_ids(self, client: Client, term: str) -> list[str]:
        rows = self._rows(
            client.table("customers").select("id")
            .eq("company_id", self.company_id)
            .or_(",".join(_ilike_any(("name", "email", "phone", "business_name"), term)))
            .limit(100)
            .execute()
        )
        return [str(row["id"]) for row in rows if row.get("id")]

    def _customers_by_id(self, client: Client, ids: set[str], columns: str = "id,name") -> dict[str, Record]:
        if not ids:
            return {}
        rows = self._rows(
            client.table("customers").select(columns)
            .eq("company_id", self.company_id)
            .in_("id", sorted(ids))
            .limit(100)
            .execute()
        )
        return {str(row["id"]): row for row in rows}

    def _update_company_record(
        self,
        client: Client,
        table: str,
        record_id: str,
        payload: Record,
        expected_updated_at: datetime,
        columns: str,
    ) -> Record:
        """Apply a compare-and-set update so concurrent edits are never silently lost."""
        row = self._one(
            client.table(table).update(payload)
            .eq("company_id", self.company_id)
            .eq("id", record_id)
            .eq("updated_at", expected_updated_at.isoformat())
            .execute()
        )
        if row is not None:
            return {key: row.get(key) for key in columns.split(",")}
        exists = self._one(
            client.table(table).select("id")
            .eq("company_id", self.company_id).eq("id", record_id).limit(1).execute()
        )
        if exists is None:
            raise RecordNotFoundError("Record not found in this company")
        raise RecordChangedError("Record changed after it was loaded")

    def _distinct(self, client: Client, table: str, column: str) -> list[str]:
        rows = self._rows(
            client.table(table).select(column)
            .eq("company_id", self.company_id)
            .limit(1000)
            .execute()
        )
        return sorted({str(row[column]) for row in rows if row.get(column)})

    # Services ------------------------------------------------------------

    async def list_services(
        self, *, search: str | None, active: bool | None, limit: int, offset: int,
    ) -> tuple[list[Record], int, list[str]]:
        first, last = pagination(limit, offset)
        term = search_term(search)

        def execute(client: Client) -> tuple[list[Record], int, list[str]]:
            query = client.table("services").select(_SERVICE_COLUMNS, count="exact").eq(
                "company_id", self.company_id,
            )
            if active is not None:
                query = query.eq("is_active", active)
            if term:
                query = query.or_(",".join(_ilike_any(("name", "category", "description"), term)))
            response = query.order("name").order("id").range(first, last).execute()
            return (
                self._rows(response),
                _exact_count(response),
                self._distinct(client, "services", "pricing_type"),
            )

        return await self._run(execute)

    async def get_service(self, service_id: UUID) -> Record | None:
        service_id = identifier(service_id)
        return await self._run(lambda client: self._one(
            client.table("services").select(_SERVICE_COLUMNS)
            .eq("company_id", self.company_id).eq("id", service_id).limit(1).execute()
        ))

    async def service_names(self) -> list[Record]:
        return await self._run(lambda client: self._rows(
            client.table("services").select("id,name")
            .eq("company_id", self.company_id).limit(1000).execute()
        ))

    async def create_service(self, payload: Record) -> Record:
        return await self._run(lambda client: self._one(
            client.table("services").insert({**payload, "company_id": self.company_id}).execute(),
            required=True,
        ))

    async def update_service(self, service_id: UUID, payload: Record, expected_updated_at: datetime) -> Record:
        service_id = identifier(service_id)
        return await self._run(lambda client: self._update_company_record(
            client, "services", service_id, payload, expected_updated_at, _SERVICE_COLUMNS,
        ))

    async def delete_service(self, service_id: UUID) -> Record:
        service_id = identifier(service_id)
        return await self._run(lambda client: self._one(
            client.table("services").delete()
            .eq("company_id", self.company_id).eq("id", service_id).execute(),
            required=True,
        ))

    # Pricing rules -------------------------------------------------------

    @staticmethod
    def _flatten_rule(row: Record) -> Record:
        service = row.get("services") or {}
        return {
            "id": row.get("id"),
            "service_id": row.get("service_id"),
            "service_name": service.get("name"),
            "service_is_active": service.get("is_active"),
            "rule_type": row.get("rule_type"),
            "value": row.get("value"),
            "condition": row.get("condition") or {},
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }

    async def list_pricing_rules(self, *, service_id: UUID | None = None) -> list[Record]:
        def execute(client: Client) -> list[Record]:
            query = client.table("pricing_rules").select(_RULE_COLUMNS, count="exact").eq(
                "services.company_id", self.company_id,
            )
            if service_id is not None:
                query = query.eq("service_id", identifier(service_id))
            response = query.order("service_id").order("rule_type").order("id").limit(1000).execute()
            rows = self._rows(response)
            if _exact_count(response) != len(rows):
                raise RepositoryError("Pricing rule list is incomplete")
            return [self._flatten_rule(row) for row in rows]

        return await self._run(execute)

    async def get_pricing_rule(self, rule_id: UUID) -> Record | None:
        rule_id = identifier(rule_id)

        def execute(client: Client) -> Record | None:
            row = self._one(
                client.table("pricing_rules").select(_RULE_COLUMNS)
                .eq("services.company_id", self.company_id)
                .eq("id", rule_id).limit(1).execute()
            )
            return self._flatten_rule(row) if row is not None else None

        return await self._run(execute)

    async def create_pricing_rule(self, payload: Record) -> Record:
        """Insert only after the caller verified the service belongs to this company."""
        return await self._run(lambda client: self._one(
            client.table("pricing_rules").insert(payload).execute(), required=True,
        ))

    async def update_pricing_rule(self, rule_id: UUID, payload: Record, expected_updated_at: datetime) -> Record:
        """Update a rule whose service ownership the caller verified; service_id never changes."""
        rule_id = identifier(rule_id)

        def execute(client: Client) -> Record:
            row = self._one(
                client.table("pricing_rules").update(payload)
                .eq("id", rule_id)
                .eq("updated_at", expected_updated_at.isoformat())
                .execute()
            )
            if row is None:
                raise RecordChangedError("Pricing rule changed after it was loaded")
            return row

        return await self._run(execute)

    async def delete_pricing_rule(self, rule_id: UUID) -> Record:
        """Delete a rule whose service ownership the caller verified."""
        rule_id = identifier(rule_id)
        return await self._run(lambda client: self._one(
            client.table("pricing_rules").delete().eq("id", rule_id).execute(), required=True,
        ))

    # Customers -----------------------------------------------------------

    async def list_customers(self, *, search: str | None, limit: int, offset: int) -> tuple[list[Record], int]:
        first, last = pagination(limit, offset)
        term = search_term(search)

        def execute(client: Client) -> tuple[list[Record], int]:
            query = client.table("customers").select(_CUSTOMER_COLUMNS, count="exact").eq(
                "company_id", self.company_id,
            )
            if term:
                query = query.or_(",".join(_ilike_any(
                    ("name", "email", "phone", "business_name", "industry"), term,
                )))
            response = query.order("created_at", desc=True).order("id").range(first, last).execute()
            return self._rows(response), _exact_count(response)

        return await self._run(execute)

    async def get_customer(self, customer_id: UUID) -> Record | None:
        customer_id = identifier(customer_id)

        def execute(client: Client) -> Record | None:
            customer = self._one(
                client.table("customers").select(_CUSTOMER_COLUMNS)
                .eq("company_id", self.company_id).eq("id", customer_id).limit(1).execute()
            )
            if customer is None:
                return None

            def related(table: str, columns: str) -> list[Record]:
                return self._rows(
                    client.table(table).select(columns)
                    .eq("company_id", self.company_id).eq("customer_id", customer_id)
                    .order("created_at", desc=True).limit(50).execute()
                )

            bookings = related("bookings", "id,service_type,date_time,status,created_at")
            return {
                **customer,
                "leads": related("leads", _LEAD_COLUMNS),
                "projects": related("projects", _PROJECT_COLUMNS),
                "bookings": [{**row, "service": row.get("service_type")} for row in bookings],
            }

        return await self._run(execute)

    async def update_customer(self, customer_id: UUID, payload: Record, expected_updated_at: datetime) -> Record:
        customer_id = identifier(customer_id)
        return await self._run(lambda client: self._update_company_record(
            client, "customers", customer_id, payload, expected_updated_at, _CUSTOMER_COLUMNS,
        ))

    # Leads ---------------------------------------------------------------

    async def update_lead(self, lead_id: UUID, payload: Record, expected_updated_at: datetime) -> Record:
        lead_id = identifier(lead_id)
        return await self._run(lambda client: self._update_company_record(
            client, "leads", lead_id, payload, expected_updated_at, _LEAD_COLUMNS + ",updated_at",
        ))

    # Projects ------------------------------------------------------------

    async def list_projects(
        self, *, search: str | None, status: str | None, limit: int, offset: int,
    ) -> tuple[list[Record], int, list[str]]:
        first, last = pagination(limit, offset)
        term = search_term(search)

        def execute(client: Client) -> tuple[list[Record], int, list[str]]:
            query = client.table("projects").select(_PROJECT_COLUMNS, count="exact").eq(
                "company_id", self.company_id,
            )
            if status:
                query = query.eq("status", status)
            if term:
                clauses = _ilike_any(("service_type", "product_category"), term)
                customer_ids = self._matching_customer_ids(client, term)
                if customer_ids:
                    clauses.append(f"customer_id.in.({','.join(customer_ids)})")
                query = query.or_(",".join(clauses))
            response = query.order("created_at", desc=True).order("id").range(first, last).execute()
            projects = self._rows(response)
            customers = self._customers_by_id(
                client, {str(row["customer_id"]) for row in projects if row.get("customer_id")},
            )
            items = [
                {**row, "customer_name": customers.get(str(row.get("customer_id")), {}).get("name")}
                for row in projects
            ]
            return items, _exact_count(response), self._distinct(client, "projects", "status")

        return await self._run(execute)

    async def get_project(self, project_id: UUID) -> Record | None:
        project_id = identifier(project_id)

        def execute(client: Client) -> Record | None:
            project = self._one(
                client.table("projects").select(_PROJECT_COLUMNS)
                .eq("company_id", self.company_id).eq("id", project_id).limit(1).execute()
            )
            if project is None:
                return None
            customer_id = str(project["customer_id"])
            customer = self._customers_by_id(client, {customer_id}, "id,name,email,phone").get(customer_id, {})
            leads = self._rows(
                client.table("leads").select(_LEAD_COLUMNS)
                .eq("company_id", self.company_id).eq("customer_id", customer_id)
                .order("created_at", desc=True).limit(20).execute()
            )
            return {
                **project,
                "customer_name": customer.get("name"),
                "customer_email": customer.get("email"),
                "customer_phone": customer.get("phone"),
                "leads": leads,
            }

        return await self._run(execute)

    async def update_project(self, project_id: UUID, payload: Record, expected_updated_at: datetime) -> Record:
        project_id = identifier(project_id)
        return await self._run(lambda client: self._update_company_record(
            client, "projects", project_id, payload, expected_updated_at, _PROJECT_COLUMNS,
        ))

    # Knowledge -----------------------------------------------------------

    async def list_knowledge(self, *, search: str | None, limit: int, offset: int) -> tuple[list[Record], int]:
        first, last = pagination(limit, offset)
        term = search_term(search)

        def execute(client: Client) -> tuple[list[Record], int]:
            query = client.table("knowledge_documents").select(_KNOWLEDGE_COLUMNS, count="exact").eq(
                "company_id", self.company_id,
            )
            if term:
                query = query.or_(",".join(_ilike_any(("title", "content"), term)))
            response = query.order("title").order("id").range(first, last).execute()
            return self._rows(response), _exact_count(response)

        return await self._run(execute)

    async def get_knowledge(self, document_id: UUID) -> Record | None:
        document_id = identifier(document_id)
        return await self._run(lambda client: self._one(
            client.table("knowledge_documents").select(_KNOWLEDGE_COLUMNS)
            .eq("company_id", self.company_id).eq("id", document_id).limit(1).execute()
        ))

    async def update_knowledge(self, document_id: UUID, payload: Record, expected_updated_at: datetime) -> Record:
        document_id = identifier(document_id)
        return await self._run(lambda client: self._update_company_record(
            client, "knowledge_documents", document_id, payload, expected_updated_at, _KNOWLEDGE_COLUMNS,
        ))

    async def delete_knowledge(self, document_id: UUID) -> Record:
        document_id = identifier(document_id)
        return await self._run(lambda client: self._one(
            client.table("knowledge_documents").delete()
            .eq("company_id", self.company_id).eq("id", document_id).execute(),
            required=True,
        ))

    # Company settings ----------------------------------------------------

    async def get_settings(self) -> Record | None:
        return await self._run(lambda client: self._one(
            client.table("company_settings").select(_SETTINGS_COLUMNS)
            .eq("company_id", self.company_id).limit(1).execute()
        ))

    async def update_settings(self, payload: Record, expected_updated_at: datetime) -> Record:
        def execute(client: Client) -> Record:
            row = self._one(
                client.table("company_settings").update(payload)
                .eq("company_id", self.company_id)
                .eq("updated_at", expected_updated_at.isoformat())
                .execute()
            )
            if row is not None:
                return {key: row.get(key) for key in _SETTINGS_COLUMNS.split(",")}
            exists = self._one(
                client.table("company_settings").select("company_id")
                .eq("company_id", self.company_id).limit(1).execute()
            )
            if exists is None:
                raise RecordNotFoundError("Company settings are not configured")
            raise RecordChangedError("Company settings changed after they were loaded")

        return await self._run(execute)
