"""Development-only quote calculation; authenticated tenant routing is pending."""

import logging
from fastapi import APIRouter, HTTPException, Request, Response
from app.repositories.errors import RecordNotFoundError, RepositoryConflictError, RepositoryError
from app.schemas.quote import QuoteCalculateRequest, QuoteCalculation
from app.services.pricing_engine import PricingConfigurationError, UnknownAddonError
from app.services.quote_service import QuoteService

router = APIRouter(prefix='/quotes', tags=['quotes'])
logger = logging.getLogger(__name__)


@router.post('/calculate', response_model=QuoteCalculation)
async def calculate_quote(payload: QuoteCalculateRequest, request: Request, response: Response) -> QuoteCalculation:
    """Calculate using server pricing only; the result does not save a quote."""
    response.headers['Cache-Control'] = 'no-store'
    settings = request.app.state.settings
    if settings.agent_company_id is None:
        raise HTTPException(503, 'Set AGENT_COMPANY_ID before calculating quotes.')
    if payload.company_id != settings.agent_company_id:
        raise HTTPException(403, 'Company is not enabled for this development endpoint.')
    try:
        return await QuoteService().calculate_quote(payload)
    except RecordNotFoundError:
        raise HTTPException(404, 'Active service not found.') from None
    except UnknownAddonError:
        raise HTTPException(422, 'An add-on is unavailable for this service.') from None
    except (PricingConfigurationError, RepositoryConflictError):
        logger.warning('Quote calculation rejected invalid pricing configuration')
        raise HTTPException(409, 'Service pricing configuration is missing, invalid, or ambiguous.') from None
    except RepositoryError:
        logger.warning('Quote calculation database operation failed')
        raise HTTPException(503, 'Pricing data is temporarily unavailable.') from None
