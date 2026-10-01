"""Authenticated admin management routes for catalog, CRM, knowledge, and settings records."""

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from app.core.security import require_admin_auth
from app.repositories.errors import (
    RecordChangedError,
    RecordNotFoundError,
    RepositoryConflictError,
    RepositoryError,
    RepositoryIntegrityError,
)
from app.schemas.admin import AdminDeleteResponse
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
from app.services.admin_records_service import (
    AdminRecordConflictError,
    AdminRecordDataError,
    AdminRecordsService,
)

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)
AdminAuthDependency = Annotated[None, Depends(require_admin_auth)]
STALE_RECORD_MESSAGE = "This record changed since you opened it. Reload the page and try again."
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
Search = Annotated[str | None, Query(max_length=100)]


def get_records_service(request: Request) -> AdminRecordsService:
    settings = request.app.state.settings
    if settings.agent_company_id is None:
        raise HTTPException(503, "Admin company is not configured.")
    if settings.supabase_url is None or not settings.supabase_key.get_secret_value().strip():
        raise HTTPException(503, "Admin database is not configured.")
    return AdminRecordsService(settings.agent_company_id)


RecordsDependency = Annotated[AdminRecordsService, Depends(get_records_service)]


@contextmanager
def handled(resource: str, response: Response, *, referenced_on_integrity: bool = False) -> Iterator[None]:
    """Map storage and business-rule failures to sanitized, uncached HTTP errors."""
    response.headers["Cache-Control"] = "no-store"

    def error(status: int, message: str) -> HTTPException:
        return HTTPException(status, message, headers={"Cache-Control": "no-store"})

    try:
        yield
    except RecordNotFoundError:
        raise error(404, f"{resource} not found.") from None
    except RecordChangedError:
        raise error(409, STALE_RECORD_MESSAGE) from None
    except AdminRecordConflictError as exc:
        raise error(409, str(exc)) from None
    except RepositoryIntegrityError:
        if referenced_on_integrity:
            raise error(409, f"{resource} is still referenced by other records.") from None
        raise error(422, f"{resource} details were rejected by a data rule.") from None
    except RepositoryConflictError:
        raise error(409, f"{resource} conflicts with an existing record.") from None
    except AdminRecordDataError:
        logger.warning("Admin %s data failed validation", resource.lower())
        raise error(409, f"{resource} data is unavailable.") from None
    except RepositoryError:
        logger.warning("Admin %s operation failed", resource.lower())
        raise error(503, f"{resource} data is temporarily unavailable.") from None


# Services ------------------------------------------------------------------


@router.get("/services", response_model=AdminServiceList)
async def list_services(
    response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
    search: Search = None, active: bool | None = None, limit: Limit = 50, offset: Offset = 0,
) -> AdminServiceList:
    with handled("Service", response):
        return await records.list_services(search=search, active=active, limit=limit, offset=offset)


@router.post("/services", response_model=AdminService, status_code=201)
async def create_service(
    payload: AdminServiceCreate, response: Response,
    _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminService:
    with handled("Service", response):
        return await records.create_service(payload)


@router.get("/services/{service_id}", response_model=AdminService)
async def get_service(
    service_id: UUID, response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminService:
    with handled("Service", response):
        return await records.get_service(service_id)


@router.patch("/services/{service_id}", response_model=AdminService)
async def update_service(
    service_id: UUID, payload: AdminServiceUpdate, response: Response,
    _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminService:
    with handled("Service", response):
        return await records.update_service(service_id, payload)


@router.delete("/services/{service_id}", response_model=AdminDeleteResponse)
async def delete_service(
    service_id: UUID, response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminDeleteResponse:
    with handled("Service", response, referenced_on_integrity=True):
        return AdminDeleteResponse(id=await records.delete_service(service_id))


# Pricing rules -------------------------------------------------------------


@router.get("/pricing-rules", response_model=AdminPricingRuleList)
async def list_pricing_rules(
    response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
    service_id: UUID | None = None,
) -> AdminPricingRuleList:
    with handled("Pricing rule", response):
        return await records.list_pricing_rules(service_id=service_id)


@router.post("/pricing-rules", response_model=AdminPricingRule, status_code=201)
async def create_pricing_rule(
    payload: AdminPricingRuleCreate, response: Response,
    _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminPricingRule:
    with handled("Pricing rule", response):
        return await records.create_pricing_rule(payload)


@router.patch("/pricing-rules/{rule_id}", response_model=AdminPricingRule)
async def update_pricing_rule(
    rule_id: UUID, payload: AdminPricingRuleUpdate, response: Response,
    _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminPricingRule:
    with handled("Pricing rule", response):
        return await records.update_pricing_rule(rule_id, payload)


@router.delete("/pricing-rules/{rule_id}", response_model=AdminDeleteResponse)
async def delete_pricing_rule(
    rule_id: UUID, response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminDeleteResponse:
    with handled("Pricing rule", response, referenced_on_integrity=True):
        return AdminDeleteResponse(id=await records.delete_pricing_rule(rule_id))


# Customers -----------------------------------------------------------------


@router.get("/customers", response_model=AdminCustomerList)
async def list_customers(
    response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
    search: Search = None, limit: Limit = 50, offset: Offset = 0,
) -> AdminCustomerList:
    with handled("Customer", response):
        return await records.list_customers(search=search, limit=limit, offset=offset)


@router.get("/customers/{customer_id}", response_model=AdminCustomerDetail)
async def get_customer(
    customer_id: UUID, response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminCustomerDetail:
    with handled("Customer", response):
        return await records.get_customer(customer_id)


@router.patch("/customers/{customer_id}", response_model=AdminCustomer)
async def update_customer(
    customer_id: UUID, payload: AdminCustomerUpdate, response: Response,
    _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminCustomer:
    with handled("Customer", response):
        return await records.update_customer(customer_id, payload)


# Projects ------------------------------------------------------------------


@router.get("/projects", response_model=AdminProjectList)
async def list_projects(
    response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
    search: Search = None, status: Annotated[str | None, Query(max_length=100)] = None,
    limit: Limit = 50, offset: Offset = 0,
) -> AdminProjectList:
    with handled("Project", response):
        return await records.list_projects(search=search, status=status, limit=limit, offset=offset)


@router.get("/projects/{project_id}", response_model=AdminProjectDetail)
async def get_project(
    project_id: UUID, response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminProjectDetail:
    with handled("Project", response):
        return await records.get_project(project_id)


@router.patch("/projects/{project_id}", response_model=AdminProject)
async def update_project(
    project_id: UUID, payload: AdminProjectUpdate, response: Response,
    _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminProject:
    with handled("Project", response):
        return await records.update_project(project_id, payload)


# Knowledge -----------------------------------------------------------------


@router.get("/knowledge", response_model=AdminKnowledgeList)
async def list_knowledge(
    response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
    search: Search = None, limit: Limit = 50, offset: Offset = 0,
) -> AdminKnowledgeList:
    with handled("Knowledge document", response):
        return await records.list_knowledge(search=search, limit=limit, offset=offset)


@router.post("/knowledge", response_model=AdminKnowledgeDocument, status_code=201)
async def create_knowledge(
    payload: AdminKnowledgeCreate, response: Response,
    _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminKnowledgeDocument:
    with handled("Knowledge document", response):
        return await records.create_knowledge(payload)


@router.get("/knowledge/{document_id}", response_model=AdminKnowledgeDocument)
async def get_knowledge(
    document_id: UUID, response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminKnowledgeDocument:
    with handled("Knowledge document", response):
        return await records.get_knowledge(document_id)


@router.patch("/knowledge/{document_id}", response_model=AdminKnowledgeDocument)
async def update_knowledge(
    document_id: UUID, payload: AdminKnowledgeUpdate, response: Response,
    _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminKnowledgeDocument:
    with handled("Knowledge document", response):
        return await records.update_knowledge(document_id, payload)


@router.delete("/knowledge/{document_id}", response_model=AdminDeleteResponse)
async def delete_knowledge(
    document_id: UUID, response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminDeleteResponse:
    with handled("Knowledge document", response, referenced_on_integrity=True):
        return AdminDeleteResponse(id=await records.delete_knowledge(document_id))


# Company settings ----------------------------------------------------------


@router.get("/settings", response_model=AdminCompanySettings)
async def get_settings(
    response: Response, _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminCompanySettings:
    with handled("Company settings", response):
        return await records.get_settings()


@router.patch("/settings", response_model=AdminCompanySettings)
async def update_settings(
    payload: AdminCompanySettingsUpdate, response: Response,
    _admin_auth: AdminAuthDependency, records: RecordsDependency,
) -> AdminCompanySettings:
    with handled("Company settings", response):
        return await records.update_settings(payload)
