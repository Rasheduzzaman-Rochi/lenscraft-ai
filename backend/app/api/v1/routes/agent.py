"""Development-only transcript processing adapter; no Retell or authentication yet."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.schemas.conversation import ProcessConversationRequest, ProcessConversationResponse
from app.services.lead_processing_service import LeadProcessingError, LeadProcessingService

router = APIRouter(prefix='/agent', tags=['agent'])


def get_lead_processing_service(request: Request) -> LeadProcessingService:
    """Resolve company from server configuration, never from transcript content."""
    settings = request.app.state.settings
    if settings.agent_company_id is None:
        raise HTTPException(503, 'Set AGENT_COMPANY_ID to an existing company UUID.')
    if settings.supabase_url is None or not settings.supabase_key.get_secret_value().strip():
        raise HTTPException(503, 'Set SUPABASE_URL and SUPABASE_KEY before processing leads.')
    return LeadProcessingService(settings.agent_company_id)


@router.post('/process', response_model=ProcessConversationResponse, status_code=201)
async def process_conversation(
    payload: ProcessConversationRequest,
    response: Response,
    service: Annotated[LeadProcessingService, Depends(get_lead_processing_service)],
) -> ProcessConversationResponse:
    """Persist one new lead workflow; a repeated request creates new records."""
    response.headers['Cache-Control'] = 'no-store'
    try:
        return await service.process(payload.transcript)
    except LeadProcessingError as exc:
        raise HTTPException(503, detail={
            'code': 'lead_processing_incomplete',
            'message': 'Processing failed. Some writes may have committed; do not automatically retry.',
            'operation_id': str(exc.operation_id), 'failed_stage': exc.stage,
            'confirmed_records': exc.completed, 'retry_safe': False,
        }, headers={'Cache-Control': 'no-store'}) from None
    except ValueError:
        raise HTTPException(422, 'Labeled conversation facts are invalid or conflicting.') from None
