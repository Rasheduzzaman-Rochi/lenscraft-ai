"""Development knowledge ingestion and retrieval endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.repositories.errors import RepositoryError
from app.schemas.knowledge import (
    KnowledgeDocument,
    KnowledgeDocumentCreate,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)
from app.services.embedding_service import EmbeddingProviderUnavailableError
from app.services.knowledge_service import KnowledgeDataError, KnowledgeService

router = APIRouter(prefix="/knowledge", tags=["knowledge"])
logger = logging.getLogger(__name__)


def get_knowledge_service(request: Request) -> KnowledgeService:
    """Resolve tenant from trusted development configuration."""
    settings = request.app.state.settings
    if settings.agent_company_id is None:
        raise HTTPException(503, "Set AGENT_COMPANY_ID before using knowledge endpoints.")
    if settings.supabase_url is None or not settings.supabase_key.get_secret_value().strip():
        raise HTTPException(503, "Set SUPABASE_URL and SUPABASE_KEY before using knowledge endpoints.")
    return KnowledgeService(settings.agent_company_id)


def verify_company(request_company_id: object, service: KnowledgeService) -> None:
    """Reject caller-selected tenants until authenticated tenant routing exists."""
    if str(request_company_id) != str(service.company_id):
        raise HTTPException(403, "Company is not enabled for this development endpoint.")


@router.post("", response_model=KnowledgeDocument, status_code=201)
async def add_knowledge_document(
    payload: KnowledgeDocumentCreate,
    response: Response,
    service: Annotated[KnowledgeService, Depends(get_knowledge_service)],
) -> KnowledgeDocument:
    """Store knowledge; an embedding is optional until a provider is configured."""
    verify_company(payload.company_id, service)
    response.headers["Cache-Control"] = "no-store"
    try:
        return await service.add_document(payload)
    except EmbeddingProviderUnavailableError:
        raise HTTPException(503, "Embedding provider is not configured.") from None
    except (KnowledgeDataError, ValueError):
        raise HTTPException(422, "Knowledge document or embedding is invalid.") from None
    except RepositoryError:
        logger.warning("Knowledge document persistence failed")
        raise HTTPException(503, "Knowledge storage is temporarily unavailable.") from None


@router.post("/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(
    payload: KnowledgeSearchRequest,
    response: Response,
    service: Annotated[KnowledgeService, Depends(get_knowledge_service)],
) -> KnowledgeSearchResponse:
    """Retrieve semantic or full-text sources and prepare bounded agent context."""
    verify_company(payload.company_id, service)
    response.headers["Cache-Control"] = "no-store"
    try:
        return await service.retrieve_relevant_knowledge(payload)
    except EmbeddingProviderUnavailableError:
        raise HTTPException(503, "Embedding provider is not configured.") from None
    except KnowledgeDataError:
        logger.warning("Knowledge search returned incompatible stored data")
        raise HTTPException(409, "Knowledge search data is invalid or incompatible.") from None
    except ValueError:
        raise HTTPException(422, "Knowledge search input is invalid.") from None
    except RepositoryError:
        logger.warning("Knowledge retrieval failed")
        raise HTTPException(503, "Knowledge search is temporarily unavailable.") from None
