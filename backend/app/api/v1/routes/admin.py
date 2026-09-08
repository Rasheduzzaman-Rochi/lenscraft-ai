"""Authenticated internal administration read routes."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from app.core.security import require_admin_auth
from app.repositories.errors import RepositoryError
from app.schemas.admin import AdminBooking, AdminBookingList, AdminDashboard, AdminLead, AdminLeadList
from app.schemas.booking import BookingStatus
from app.services.admin_service import AdminDataError, AdminService


router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)
AdminAuthDependency = Annotated[None, Depends(require_admin_auth)]


def get_admin_service(request: Request) -> AdminService:
    settings = request.app.state.settings
    if settings.agent_company_id is None:
        raise HTTPException(503, "Admin company is not configured.")
    if settings.supabase_url is None or not settings.supabase_key.get_secret_value().strip():
        raise HTTPException(503, "Admin database is not configured.")
    return AdminService(settings.agent_company_id)


AdminServiceDependency = Annotated[AdminService, Depends(get_admin_service)]


@router.get("/dashboard", response_model=AdminDashboard)
async def dashboard(
    response: Response,
    _admin_auth: AdminAuthDependency,
    service: AdminServiceDependency,
) -> AdminDashboard:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await service.dashboard()
    except AdminDataError:
        logger.warning("Admin dashboard received invalid stored data")
        raise HTTPException(409, "Dashboard data is unavailable.") from None
    except RepositoryError:
        logger.warning("Admin dashboard query failed")
        raise HTTPException(503, "Dashboard data is temporarily unavailable.") from None


@router.get("/bookings", response_model=AdminBookingList)
async def list_bookings(
    response: Response,
    _admin_auth: AdminAuthDependency,
    service: AdminServiceDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    status: BookingStatus | None = None,
) -> AdminBookingList:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await service.list_bookings(limit=limit, offset=offset, status=status)
    except AdminDataError:
        logger.warning("Admin booking list received invalid stored data")
        raise HTTPException(409, "Booking data is unavailable.") from None
    except RepositoryError:
        logger.warning("Admin booking list query failed")
        raise HTTPException(503, "Booking data is temporarily unavailable.") from None


@router.get("/bookings/{booking_id}", response_model=AdminBooking)
async def get_booking(
    booking_id: UUID,
    response: Response,
    _admin_auth: AdminAuthDependency,
    service: AdminServiceDependency,
) -> AdminBooking:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await service.get_booking(booking_id)
    except KeyError:
        raise HTTPException(404, "Booking not found.") from None
    except AdminDataError:
        raise HTTPException(409, "Booking data is unavailable.") from None
    except RepositoryError:
        logger.warning("Admin booking query failed")
        raise HTTPException(503, "Booking data is temporarily unavailable.") from None


@router.get("/leads", response_model=AdminLeadList)
async def list_leads(
    response: Response,
    _admin_auth: AdminAuthDependency,
    service: AdminServiceDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminLeadList:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await service.list_leads(limit=limit, offset=offset)
    except AdminDataError:
        raise HTTPException(409, "Lead data is unavailable.") from None
    except RepositoryError:
        logger.warning("Admin lead list query failed")
        raise HTTPException(503, "Lead data is temporarily unavailable.") from None


@router.get("/leads/{lead_id}", response_model=AdminLead)
async def get_lead(
    lead_id: UUID,
    response: Response,
    _admin_auth: AdminAuthDependency,
    service: AdminServiceDependency,
) -> AdminLead:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await service.get_lead(lead_id)
    except KeyError:
        raise HTTPException(404, "Lead not found.") from None
    except AdminDataError:
        raise HTTPException(409, "Lead data is unavailable.") from None
    except RepositoryError:
        logger.warning("Admin lead query failed")
        raise HTTPException(503, "Lead data is temporarily unavailable.") from None
