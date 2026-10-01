"""Business rules for admin management of catalog, CRM, knowledge, and settings records."""

from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from app.repositories.admin_records_repository import AdminRecordsRepository
from app.repositories.errors import RecordNotFoundError
from app.schemas.admin_records import (
    AdminCompanySettings,
    AdminCompanySettingsUpdate,
    AdminCustomer,
    AdminCustomerDetail,
    AdminCustomerList,
    AdminCustomerUpdate,
    AdminKnowledgeCreate,
    AdminKnowledgeDocument,
    AdminKnowledgeList,
    AdminKnowledgeUpdate,
    AdminLeadUpdate,
    AdminPricingRule,
    AdminPricingRuleCreate,
    AdminPricingRuleList,
    AdminPricingRuleUpdate,
    AdminProject,
    AdminProjectDetail,
    AdminProjectList,
    AdminProjectUpdate,
    AdminService,
    AdminServiceCreate,
    AdminServiceList,
    AdminServiceUpdate,
)
from app.schemas.knowledge import KnowledgeDocumentCreate
from app.schemas.quote import AddonCondition
from app.services.embedding_service import EmbeddingService
from app.services.knowledge_service import KnowledgeService

# Rule types whose contract is defined by the quote engine (app/services/pricing_engine.py).
_RATE_RULE_TYPES = {"base", "per_image"}
_ADDON_RULE_TYPE = "addon"


class AdminRecordConflictError(ValueError):
    """The change is valid input but would leave business data in an unsafe state."""


class AdminRecordDataError(ValueError):
    """Stored data does not satisfy the admin response contract."""


def _validated(model: type, value: Any):
    try:
        return model.model_validate(value)
    except ValidationError:
        raise AdminRecordDataError(f"Stored {model.__name__} data is invalid") from None


def _changes(payload: Any) -> dict[str, Any]:
    """Return only explicitly supplied columns, excluding the concurrency token."""
    return payload.model_dump(mode="json", exclude_unset=True, exclude={"expected_updated_at"})


class AdminRecordsService:
    """Validate admin changes before delegating tenant-scoped persistence."""

    def __init__(
        self,
        company_id: UUID,
        *,
        repository: AdminRecordsRepository | None = None,
        embeddings: EmbeddingService | None = None,
        knowledge: KnowledgeService | None = None,
    ) -> None:
        self.company_id = company_id
        self.repository = repository or AdminRecordsRepository(company_id)
        if self.repository.company_id != str(company_id):
            raise ValueError("Admin records repository must belong to configured company")
        self.embeddings = embeddings if embeddings is not None else EmbeddingService()
        self.knowledge = knowledge

    # Services ------------------------------------------------------------

    async def list_services(
        self, *, search: str | None, active: bool | None, limit: int, offset: int,
    ) -> AdminServiceList:
        rows, total, pricing_types = await self.repository.list_services(
            search=search, active=active, limit=limit, offset=offset,
        )
        return _validated(AdminServiceList, {
            "items": rows, "total": total, "limit": limit, "offset": offset,
            "pricing_types": pricing_types,
        })

    async def get_service(self, service_id: UUID) -> AdminService:
        row = await self.repository.get_service(service_id)
        if row is None:
            raise RecordNotFoundError("Service not found")
        return _validated(AdminService, row)

    async def _require_unique_name(self, name: str, *, exclude_id: UUID | None = None) -> None:
        wanted = name.strip().casefold()
        for row in await self.repository.service_names():
            if str(row.get("id")) != str(exclude_id) and str(row.get("name", "")).strip().casefold() == wanted:
                raise AdminRecordConflictError(
                    "Another service already uses this name. The voice agent looks services up by "
                    "exact name, so names must be unique."
                )

    async def create_service(self, payload: AdminServiceCreate) -> AdminService:
        await self._require_unique_name(payload.name)
        row = await self.repository.create_service(payload.model_dump(mode="json"))
        return _validated(AdminService, row)

    async def update_service(self, service_id: UUID, payload: AdminServiceUpdate) -> AdminService:
        current = await self.get_service(service_id)
        changes = _changes(payload)
        if "name" in changes:
            await self._require_unique_name(changes["name"], exclude_id=service_id)
        if "pricing_type" in changes and changes["pricing_type"] != current.pricing_type:
            rules = await self.repository.list_pricing_rules(service_id=service_id)
            if any(rule["rule_type"] != _ADDON_RULE_TYPE for rule in rules):
                raise AdminRecordConflictError(
                    "Delete or replace this service's rate rules before changing its pricing type."
                )
        if not changes:
            return current
        row = await self.repository.update_service(service_id, changes, payload.expected_updated_at)
        return _validated(AdminService, row)

    async def delete_service(self, service_id: UUID) -> UUID:
        await self.get_service(service_id)
        if await self.repository.list_pricing_rules(service_id=service_id):
            raise AdminRecordConflictError(
                "This service still has pricing rules. Deactivate it instead, or delete its rules first."
            )
        row = await self.repository.delete_service(service_id)
        return UUID(str(row["id"]))

    # Pricing rules -------------------------------------------------------

    async def list_pricing_rules(self, *, service_id: UUID | None) -> AdminPricingRuleList:
        rows = await self.repository.list_pricing_rules(service_id=service_id)
        return _validated(AdminPricingRuleList, {
            "items": rows,
            "rule_types": sorted({*_RATE_RULE_TYPES, _ADDON_RULE_TYPE, *(row["rule_type"] for row in rows)}),
        })

    async def get_pricing_rule(self, rule_id: UUID) -> AdminPricingRule:
        row = await self.repository.get_pricing_rule(rule_id)
        if row is None:
            raise RecordNotFoundError("Pricing rule not found")
        return _validated(AdminPricingRule, row)

    @staticmethod
    def _check_rule(
        rule_type: str,
        value: Decimal,
        condition: dict[str, Any],
        siblings: list[dict[str, Any]],
    ) -> None:
        """Apply the quote engine's rule contract without rejecting unknown live rule types."""
        if rule_type in _RATE_RULE_TYPES:
            if value < 0:
                raise AdminRecordConflictError("Rates cannot be negative.")
            if condition:
                raise AdminRecordConflictError(f"A {rule_type} rule must not have a condition.")
        if rule_type == _ADDON_RULE_TYPE:
            try:
                addon = AddonCondition.model_validate(condition)
            except ValidationError:
                raise AdminRecordConflictError(
                    "An add-on needs a condition with a code and a pricing_type of fixed or per_image."
                ) from None
            if value < 0:
                raise AdminRecordConflictError("Add-on prices cannot be negative.")
            if any(
                sibling["rule_type"] == _ADDON_RULE_TYPE
                and (sibling.get("condition") or {}).get("code") == addon.code
                for sibling in siblings
            ):
                raise AdminRecordConflictError(f"This service already has an add-on with code {addon.code}.")
        elif any(sibling["rule_type"] == rule_type for sibling in siblings):
            raise AdminRecordConflictError(
                f"This service already has a {rule_type} rule. Edit the existing rule instead."
            )

    async def create_pricing_rule(self, payload: AdminPricingRuleCreate) -> AdminPricingRule:
        await self.get_service(payload.service_id)
        siblings = await self.repository.list_pricing_rules(service_id=payload.service_id)
        self._check_rule(payload.rule_type, payload.value, payload.condition, siblings)
        row = await self.repository.create_pricing_rule(payload.model_dump(mode="json"))
        return await self.get_pricing_rule(row["id"])

    async def update_pricing_rule(self, rule_id: UUID, payload: AdminPricingRuleUpdate) -> AdminPricingRule:
        current = await self.get_pricing_rule(rule_id)
        changes = _changes(payload)
        if not changes:
            return current
        siblings = [
            rule for rule in await self.repository.list_pricing_rules(service_id=current.service_id)
            if str(rule["id"]) != str(rule_id)
        ]
        self._check_rule(
            payload.rule_type if payload.rule_type is not None else current.rule_type,
            payload.value if payload.value is not None else current.value,
            payload.condition if payload.condition is not None else current.condition,
            siblings,
        )
        await self.repository.update_pricing_rule(rule_id, changes, payload.expected_updated_at)
        return await self.get_pricing_rule(rule_id)

    async def delete_pricing_rule(self, rule_id: UUID) -> UUID:
        current = await self.get_pricing_rule(rule_id)
        if current.rule_type != _ADDON_RULE_TYPE and current.service_is_active:
            siblings = await self.repository.list_pricing_rules(service_id=current.service_id)
            remaining_rates = [
                rule for rule in siblings
                if str(rule["id"]) != str(rule_id) and rule["rule_type"] != _ADDON_RULE_TYPE
            ]
            if not remaining_rates:
                raise AdminRecordConflictError(
                    f"{current.service_name} is active and this is its only rate. Deactivate the "
                    "service first, or edit this rule instead, so the voice agent never quotes without a rate."
                )
        row = await self.repository.delete_pricing_rule(rule_id)
        return UUID(str(row["id"]))

    # Customers -----------------------------------------------------------

    async def list_customers(self, *, search: str | None, limit: int, offset: int) -> AdminCustomerList:
        rows, total = await self.repository.list_customers(search=search, limit=limit, offset=offset)
        return _validated(AdminCustomerList, {"items": rows, "total": total, "limit": limit, "offset": offset})

    async def get_customer(self, customer_id: UUID) -> AdminCustomerDetail:
        row = await self.repository.get_customer(customer_id)
        if row is None:
            raise RecordNotFoundError("Customer not found")
        return _validated(AdminCustomerDetail, row)

    async def update_customer(self, customer_id: UUID, payload: AdminCustomerUpdate) -> AdminCustomer:
        changes = _changes(payload)
        if not changes:
            return await self.get_customer(customer_id)
        row = await self.repository.update_customer(customer_id, changes, payload.expected_updated_at)
        return _validated(AdminCustomer, row)

    # Projects ------------------------------------------------------------

    async def list_projects(
        self, *, search: str | None, status: str | None, limit: int, offset: int,
    ) -> AdminProjectList:
        rows, total, statuses = await self.repository.list_projects(
            search=search, status=status, limit=limit, offset=offset,
        )
        return _validated(AdminProjectList, {
            "items": rows, "total": total, "limit": limit, "offset": offset, "statuses": statuses,
        })

    async def get_project(self, project_id: UUID) -> AdminProjectDetail:
        row = await self.repository.get_project(project_id)
        if row is None:
            raise RecordNotFoundError("Project not found")
        return _validated(AdminProjectDetail, row)

    async def update_project(self, project_id: UUID, payload: AdminProjectUpdate) -> AdminProject:
        changes = _changes(payload)
        if not changes:
            return await self.get_project(project_id)
        await self.repository.update_project(project_id, changes, payload.expected_updated_at)
        return await self.get_project(project_id)

    # Knowledge -----------------------------------------------------------

    @staticmethod
    def _knowledge(row: dict[str, Any]) -> AdminKnowledgeDocument:
        return _validated(AdminKnowledgeDocument, {**row, "has_embedding": row.get("embedding_model") is not None})

    async def list_knowledge(self, *, search: str | None, limit: int, offset: int) -> AdminKnowledgeList:
        rows, total = await self.repository.list_knowledge(search=search, limit=limit, offset=offset)
        return _validated(AdminKnowledgeList, {
            "items": [self._knowledge(row) for row in rows],
            "total": total, "limit": limit, "offset": offset,
        })

    async def get_knowledge(self, document_id: UUID) -> AdminKnowledgeDocument:
        row = await self.repository.get_knowledge(document_id)
        if row is None:
            raise RecordNotFoundError("Knowledge document not found")
        return self._knowledge(row)

    async def create_knowledge(self, payload: AdminKnowledgeCreate) -> AdminKnowledgeDocument:
        """Reuse the existing ingestion path, which embeds only when a provider is configured."""
        knowledge = self.knowledge or KnowledgeService(self.company_id, embeddings=self.embeddings)
        saved = await knowledge.add_document(KnowledgeDocumentCreate(
            company_id=self.company_id, title=payload.title, content=payload.content,
        ))
        return await self.get_knowledge(saved.id)

    async def update_knowledge(self, document_id: UUID, payload: AdminKnowledgeUpdate) -> AdminKnowledgeDocument:
        changes = _changes(payload)
        if not changes:
            return await self.get_knowledge(document_id)
        if "content" in changes:
            # A stored vector describes the old text. Mirror ingestion: re-embed when a provider is
            # configured, otherwise clear it so retrieval falls back to current full text.
            if self.embeddings.configured:
                changes["embedding"] = await self.embeddings.create_embedding(changes["content"])
                changes["embedding_model"] = self.embeddings.model_name
            else:
                changes["embedding"] = None
                changes["embedding_model"] = None
        row = await self.repository.update_knowledge(document_id, changes, payload.expected_updated_at)
        return self._knowledge(row)

    async def delete_knowledge(self, document_id: UUID) -> UUID:
        row = await self.repository.delete_knowledge(document_id)
        return UUID(str(row["id"]))

    # Company settings ----------------------------------------------------

    async def get_settings(self) -> AdminCompanySettings:
        row = await self.repository.get_settings()
        if row is None:
            raise RecordNotFoundError("Company settings are not configured")
        return _validated(AdminCompanySettings, row)

    async def update_settings(self, payload: AdminCompanySettingsUpdate) -> AdminCompanySettings:
        changes = _changes(payload)
        if not changes:
            return await self.get_settings()
        row = await self.repository.update_settings(changes, payload.expected_updated_at)
        return _validated(AdminCompanySettings, row)

    # Leads ---------------------------------------------------------------

    async def update_lead(self, lead_id: UUID, payload: AdminLeadUpdate) -> None:
        changes = _changes(payload)
        if changes:
            await self.repository.update_lead(lead_id, changes, payload.expected_updated_at)
