"""Authenticated HTTP boundary for Retell custom functions."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.security import verify_retell_request_signature
from app.repositories.errors import (
    RecordNotFoundError,
    RepositoryConflictError,
    RepositoryError,
    RepositoryIntegrityError,
)
from app.schemas.tools import (
    CalculateQuoteRequest,
    CalculateQuoteResponse,
    CreateLeadRequest,
    CreateLeadResponse,
    SearchKnowledgeRequest,
    SearchKnowledgeResponse,
    SearchServiceRequest,
    SearchServiceResponse,
)
from app.services.embedding_service import EmbeddingProviderUnavailableError
from app.services.knowledge_service import KnowledgeDataError
from app.services.pricing_engine import PricingConfigurationError, UnknownAddonError
from app.services.tool_service import ToolDataError, ToolService

router = APIRouter(prefix="/tools", tags=["retell-tools"])
development_router = APIRouter(prefix="/tools", tags=["development-tools"])
logger = logging.getLogger(__name__)
MAX_TOOL_BODY_BYTES = 256_000


async def get_authenticated_tool_service(request: Request) -> ToolService:
    """Verify Retell's signature over the exact body and bind a trusted tenant."""
    settings = request.app.state.settings
    api_key = settings.retell_api_key.get_secret_value().strip()
    if (
        not api_key
        or settings.agent_company_id is None
        or settings.supabase_url is None
        or not settings.supabase_key.get_secret_value().strip()
    ):
        logger.error("Retell tool configuration is incomplete")
        raise HTTPException(503, "Retell tools are not configured.")

    content_type = request.headers.get("content-type", "").partition(";")[0].strip().lower()
    if content_type != "application/json":
        raise HTTPException(415, "Retell tools require application/json.")
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > MAX_TOOL_BODY_BYTES:
                raise HTTPException(413, "Retell tool request is too large.")
        except ValueError:
            raise HTTPException(400, "Invalid Content-Length header.") from None

    raw_body = await request.body()
    if not raw_body or len(raw_body) > MAX_TOOL_BODY_BYTES:
        raise HTTPException(413, "Retell tool request is empty or too large.")
    if not verify_retell_request_signature(
        raw_body,
        request.headers.get("x-retell-signature"),
        api_key,
        tolerance_seconds=settings.retell_webhook_tolerance_seconds,
    ):
        logger.warning("Rejected Retell tool request with invalid signature")
        raise HTTPException(401, "Invalid Retell signature.")
    return ToolService(settings.agent_company_id)


ToolDependency = Annotated[ToolService, Depends(get_authenticated_tool_service)]


def get_development_tool_service(request: Request) -> ToolService:
    """Bind the local test route to configured resources without Retell authentication."""
    settings = request.app.state.settings
    if (
        settings.agent_company_id is None
        or settings.supabase_url is None
        or not settings.supabase_key.get_secret_value().strip()
    ):
        raise HTTPException(503, "Set Supabase credentials and AGENT_COMPANY_ID before testing tools.")
    return ToolService(settings.agent_company_id)


DevelopmentToolDependency = Annotated[ToolService, Depends(get_development_tool_service)]


def no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


@router.post("/search-service", response_model=SearchServiceResponse)
async def search_service(
    payload: SearchServiceRequest, response: Response, service: ToolDependency,
) -> SearchServiceResponse:
    """Return relevant active services from the configured company's catalog."""
    no_store(response)
    try:
        result = await service.search_service(payload)
    except PermissionError:
        raise HTTPException(403, "Company is not authorized for this agent.") from None
    except ValueError:
        raise HTTPException(422, "Service search input is invalid.") from None
    except ToolDataError:
        logger.warning("Retell service search returned incompatible data")
        raise HTTPException(502, "Service catalog returned invalid data.") from None
    except RepositoryError:
        logger.warning("Retell service search database operation failed")
        raise HTTPException(503, "Service search is temporarily unavailable.") from None
    logger.info("Retell service search completed company_id=%s matches=%s", service.company_id, len(result.services))
    return result


@router.post("/calculate-quote", response_model=CalculateQuoteResponse)
async def calculate_quote(
    payload: CalculateQuoteRequest, response: Response, service: ToolDependency,
) -> CalculateQuoteResponse:
    """Calculate an estimate from the tenant's current service and pricing rules."""
    no_store(response)
    try:
        result = await service.calculate_quote(payload)
    except PermissionError:
        raise HTTPException(403, "Company is not authorized for this agent.") from None
    except RecordNotFoundError:
        raise HTTPException(404, "Active service not found.") from None
    except UnknownAddonError:
        raise HTTPException(422, "An add-on is unavailable for this service.") from None
    except (PricingConfigurationError, RepositoryConflictError, ToolDataError):
        logger.warning("Retell quote tool rejected pricing configuration")
        raise HTTPException(409, "Service pricing configuration is missing, invalid, or ambiguous.") from None
    except RepositoryError:
        logger.warning("Retell quote tool database operation failed")
        raise HTTPException(503, "Quote calculation is temporarily unavailable.") from None
    logger.info("Retell quote calculation completed company_id=%s service=%s", service.company_id, result.service)
    return result


@router.post("/create-lead", response_model=CreateLeadResponse, status_code=201)
async def create_lead(
    payload: CreateLeadRequest, response: Response, service: ToolDependency,
) -> CreateLeadResponse:
    """Create customer, lead, and project records as one retry-safe command."""
    no_store(response)
    try:
        return await service.create_lead(payload)
    except PermissionError:
        raise HTTPException(403, "Company is not authorized for this agent.") from None
    except RepositoryConflictError:
        raise HTTPException(409, "request_id was already used with different input.") from None
    except RepositoryIntegrityError:
        raise HTTPException(422, "Lead data violates a database constraint.") from None
    except ToolDataError:
        logger.warning("Retell lead tool returned incompatible data")
        raise HTTPException(502, "Lead workflow returned invalid data.") from None
    except RepositoryError:
        logger.warning("Retell lead tool database operation failed request_id=%s", payload.request_id)
        raise HTTPException(503, "Lead creation is temporarily unavailable.") from None


async def execute_knowledge_search(
    payload: SearchKnowledgeRequest, service: ToolService,
) -> SearchKnowledgeResponse:
    """Run the shared knowledge tool and map domain failures to safe API errors."""
    try:
        result = await service.search_knowledge(payload)
    except PermissionError:
        raise HTTPException(403, "Company is not authorized for this agent.") from None
    except EmbeddingProviderUnavailableError:
        raise HTTPException(503, "Embedding provider is not configured.") from None
    except (KnowledgeDataError, ToolDataError):
        logger.warning("Retell knowledge tool returned incompatible data")
        raise HTTPException(409, "Knowledge search data is invalid or incompatible.") from None
    except ValueError:
        raise HTTPException(422, "Knowledge search input is invalid.") from None
    except RepositoryError:
        logger.warning("Retell knowledge search database operation failed")
        raise HTTPException(503, "Knowledge search is temporarily unavailable.") from None
    logger.info("Retell knowledge search completed company_id=%s sources=%s", service.company_id, len(result.sources))
    return result


@router.post("/search-knowledge", response_model=SearchKnowledgeResponse)
async def search_knowledge(
    payload: SearchKnowledgeRequest, response: Response, service: ToolDependency,
) -> SearchKnowledgeResponse:
    """Return bounded tenant knowledge context for a signed Retell request."""
    no_store(response)
    return await execute_knowledge_search(payload, service)


@development_router.post("/search-knowledge-test", response_model=SearchKnowledgeResponse)
async def search_knowledge_test(
    payload: SearchKnowledgeRequest,
    response: Response,
    service: DevelopmentToolDependency,
) -> SearchKnowledgeResponse:
    """Exercise the production knowledge service without a Retell signature."""
    no_store(response)
    return await execute_knowledge_search(payload, service)
