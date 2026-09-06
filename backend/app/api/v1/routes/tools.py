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
    CreateBookingRequest,
    CreateBookingResponse,
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
    """Verify Retell signature and bind trusted company."""

    settings = request.app.state.settings

    api_key = settings.retell_api_key.get_secret_value().strip()

    if (
        not api_key
        or settings.agent_company_id is None
        or settings.supabase_url is None
        or not settings.supabase_key.get_secret_value().strip()
    ):
        raise HTTPException(
            503,
            "Retell tools are not configured."
        )


    content_type = request.headers.get(
        "content-type",
        ""
    ).partition(";")[0].strip().lower()


    if content_type != "application/json":
        raise HTTPException(
            415,
            "Retell tools require application/json."
        )


    raw_body = await request.body()


    if (
        not raw_body
        or len(raw_body) > MAX_TOOL_BODY_BYTES
    ):
        raise HTTPException(
            413,
            "Retell tool request is empty or too large."
        )


    if not verify_retell_request_signature(
        raw_body,
        request.headers.get("x-retell-signature"),
        api_key,
        tolerance_seconds=settings.retell_webhook_tolerance_seconds,
    ):
        raise HTTPException(
            401,
            "Invalid Retell signature."
        )


    return ToolService(
        settings.agent_company_id
    )



ToolDependency = Annotated[
    ToolService,
    Depends(get_authenticated_tool_service)
]



def get_development_tool_service(
    request: Request
) -> ToolService:
    """Bind unsigned local testing to explicitly configured database resources."""

    settings = request.app.state.settings

    if (
        settings.agent_company_id is None
        or settings.supabase_url is None
        or not settings.supabase_key.get_secret_value().strip()
    ):
        raise HTTPException(
            503,
            "Set Supabase credentials and AGENT_COMPANY_ID before testing tools.",
        )

    return ToolService(
        settings.agent_company_id
    )



DevelopmentToolDependency = Annotated[
    ToolService,
    Depends(get_development_tool_service)
]



def no_store(response: Response):

    response.headers["Cache-Control"] = "no-store"



@router.post(
    "/search-service",
    response_model=SearchServiceResponse
)
async def search_service(
    payload: SearchServiceRequest,
    response: Response,
    service: ToolDependency,
):

    no_store(response)

    try:

        return await service.search_service(
            payload
        )

    except PermissionError:

        raise HTTPException(
            403,
            "Company is not authorized for this agent."
        ) from None



@router.post(
    "/calculate-quote",
    response_model=CalculateQuoteResponse
)
async def calculate_quote(
    payload: CalculateQuoteRequest,
    response: Response,
    service: ToolDependency,
):

    no_store(response)

    return await service.calculate_quote(
        payload
    )



@router.post(
    "/create-lead",
    response_model=CreateLeadResponse,
    status_code=201,
)
async def create_lead(
    payload: CreateLeadRequest,
    response: Response,
    service: ToolDependency,
):

    no_store(response)

    return await service.create_lead(
        payload
    )



@router.post(
    "/create-booking",
    response_model=CreateBookingResponse,
    status_code=201,
)
async def create_booking(
    payload: CreateBookingRequest,
    response: Response,
    service: ToolDependency,
) -> CreateBookingResponse:
    """Create a customer and pending booking through the booking service workflow."""

    no_store(response)

    try:

        return await service.create_booking(payload)


    except PermissionError:

        raise HTTPException(
            403,
            "Company is not authorized for this agent."
        ) from None


    except RepositoryIntegrityError:

        raise HTTPException(
            422,
            "Booking data violates database constraints."
        ) from None


    except RepositoryConflictError:

        raise HTTPException(
            409,
            "Booking conflicts with an existing record."
        ) from None


    except ValueError:

        raise HTTPException(
            422,
            "Booking input is invalid."
        ) from None


    except RepositoryError:

        raise HTTPException(
            503,
            "Booking creation temporarily unavailable."
        ) from None


    except ToolDataError:

        logger.warning("Booking workflow returned incompatible data")

        raise HTTPException(
            502,
            "Booking workflow returned invalid data."
        ) from None



async def execute_knowledge_search(
    payload: SearchKnowledgeRequest,
    service: ToolService,
) -> SearchKnowledgeResponse:
    """Run the shared knowledge tool and map failures to safe HTTP responses."""

    try:

        result = await service.search_knowledge(
            payload
        )

    except PermissionError:

        raise HTTPException(
            403,
            "Company is not authorized for this agent."
        ) from None


    except EmbeddingProviderUnavailableError:

        raise HTTPException(
            503,
            "Embedding provider is not configured."
        ) from None


    except (KnowledgeDataError, ToolDataError):

        logger.warning("Knowledge tool returned incompatible data")

        raise HTTPException(
            409,
            "Knowledge search data is invalid or incompatible."
        ) from None


    except ValueError:

        raise HTTPException(
            422,
            "Knowledge search input is invalid."
        ) from None


    except RepositoryError:

        logger.warning("Knowledge tool database operation failed")

        raise HTTPException(
            503,
            "Knowledge search unavailable."
        ) from None


    logger.info(
        "Knowledge tool search completed company_id=%s sources=%s",
        service.company_id,
        len(result.sources),
    )

    return result



@router.post(
    "/search-knowledge",
    response_model=SearchKnowledgeResponse
)
async def search_knowledge(
    payload: SearchKnowledgeRequest,
    response: Response,
    service: ToolDependency,
) -> SearchKnowledgeResponse:
    """Return bounded tenant knowledge context for a signed Retell request."""

    no_store(response)

    return await execute_knowledge_search(
        payload,
        service
    )



@development_router.post(
    "/search-knowledge-test",
    response_model=SearchKnowledgeResponse
)
async def search_knowledge_test(
    payload: SearchKnowledgeRequest,
    response: Response,
    service: DevelopmentToolDependency,
) -> SearchKnowledgeResponse:
    """Exercise production knowledge search without Retell authentication."""

    no_store(response)

    return await execute_knowledge_search(
        payload,
        service
    )
