"""Authenticated Retell webhook boundary using raw-body signature verification."""

import json
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from app.core.security import verify_retell_webhook_signature
from app.schemas.retell import RetellWebhookRequest, RetellWebhookResponse
from app.services.retell_service import RetellService

router = APIRouter(prefix="/retell", tags=["retell"])
logger = logging.getLogger(__name__)
MAX_WEBHOOK_BYTES = 2_000_000


@router.post("/webhook", response_model=RetellWebhookResponse)
async def receive_retell_webhook(request: Request) -> RetellWebhookResponse:
    """Authenticate, validate, normalize, and acknowledge a Retell call event."""
    settings = request.app.state.settings
    api_key = settings.retell_api_key.get_secret_value().strip()
    if not api_key or settings.agent_company_id is None:
        logger.error("Retell webhook configuration is incomplete")
        raise HTTPException(503, "Retell webhook is not configured.")

    content_type = request.headers.get("content-type", "").partition(";")[0].strip().lower()
    if content_type != "application/json":
        raise HTTPException(415, "Retell webhook must use application/json.")
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > MAX_WEBHOOK_BYTES:
                raise HTTPException(413, "Retell webhook body is too large.")
        except ValueError:
            raise HTTPException(400, "Invalid Content-Length header.") from None

    raw_body = await request.body()
    if not raw_body or len(raw_body) > MAX_WEBHOOK_BYTES:
        raise HTTPException(413, "Retell webhook body is empty or too large.")
    signature = request.headers.get("x-retell-signature")
    if not verify_retell_webhook_signature(
        raw_body,
        signature,
        api_key,
        tolerance_seconds=settings.retell_webhook_tolerance_seconds,
    ):
        logger.warning("Rejected Retell webhook with invalid signature")
        raise HTTPException(401, "Invalid Retell webhook signature.")

    try:
        payload = RetellWebhookRequest.model_validate(json.loads(raw_body))
    except (json.JSONDecodeError, UnicodeDecodeError, ValidationError):
        logger.warning("Rejected malformed Retell webhook payload")
        raise HTTPException(400, "Invalid Retell webhook payload.") from None

    try:
        result = RetellService(settings.agent_company_id).process_event(payload)
    except (ValidationError, ValueError):
        logger.warning(
            "Retell event normalization failed call_id=%s event=%s",
            payload.call.call_id,
            payload.event,
        )
        raise HTTPException(422, "Retell call data could not be processed.") from None
    except Exception as exc:
        logger.error(
            "Retell event processing failed call_id=%s event=%s error=%s",
            payload.call.call_id,
            payload.event,
            type(exc).__name__,
        )
        raise HTTPException(503, "Retell event processing is temporarily unavailable.") from None

    logger.info(
        "Retell event accepted call_id=%s event=%s status=%s",
        result.call.call_id,
        result.call.event_type,
        result.status,
    )
    return RetellWebhookResponse(
        call_id=result.call.call_id,
        event_type=result.call.event_type,
        status=result.status,
        message="Retell event processed" if result.status == "processed" else "Retell event acknowledged",
        company_id=settings.agent_company_id,
    )
