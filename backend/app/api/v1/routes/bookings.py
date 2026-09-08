"""Authenticated internal booking administration routes."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.security import require_admin_auth
from app.repositories.booking_repository import BookingRepository
from app.repositories.errors import RecordNotFoundError, RepositoryError
from app.schemas.booking import UpdateBookingStatusRequest, UpdateBookingStatusResponse
from app.services.booking_service import (
    BookingService,
    BookingSlotConflictError,
    BookingStatusTransitionError,
)


router = APIRouter(prefix="/bookings", tags=["bookings"])
logger = logging.getLogger(__name__)


def get_booking_service(request: Request) -> BookingService:
    """Resolve booking administration to the configured development tenant."""
    settings = request.app.state.settings
    if settings.agent_company_id is None:
        raise HTTPException(503, "Set AGENT_COMPANY_ID before using booking endpoints.")
    if settings.supabase_url is None or not settings.supabase_key.get_secret_value().strip():
        raise HTTPException(503, "Set SUPABASE_URL and SUPABASE_KEY before using booking endpoints.")
    return BookingService(settings.agent_company_id)


BookingDependency = Annotated[BookingService, Depends(get_booking_service)]
AdminAuthDependency = Annotated[None, Depends(require_admin_auth)]


@router.patch(
    "/{booking_id}/status",
    response_model=UpdateBookingStatusResponse,
    responses={409: {"description": "A confirmed booking already owns the slot."}},
)
async def update_booking_status(
    booking_id: UUID,
    payload: UpdateBookingStatusRequest,
    response: Response,
    _admin_auth: AdminAuthDependency,
    service: BookingDependency,
) -> UpdateBookingStatusResponse:
    """Apply one allowed status transition for the configured tenant."""
    response.headers["Cache-Control"] = "no-store"
    if payload.company_id != service.company_id:
        raise HTTPException(403, "Company is not enabled for this admin endpoint.")

    try:
        return await service.update_status(booking_id, payload.status)
    except RecordNotFoundError:
        raise HTTPException(404, "Booking not found.") from None
    except BookingSlotConflictError:
        raise HTTPException(409, "That time is already booked.") from None
    except BookingStatusTransitionError as exc:
        raise HTTPException(409, str(exc)) from None
    except ValueError:
        raise HTTPException(422, "Booking status update is invalid.") from None
    except RepositoryError:
        logger.warning("Booking status update failed")
        raise HTTPException(503, "Booking status is temporarily unavailable.") from None
