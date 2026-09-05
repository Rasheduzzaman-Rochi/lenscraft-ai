"""Compose version-one route groups."""

from fastapi import APIRouter

from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.database import router as database_router

router = APIRouter()
router.include_router(health_router)


def create_api_router(*, include_diagnostics: bool = False) -> APIRouter:
    api_router = APIRouter()
    api_router.include_router(router)
    if include_diagnostics:
        api_router.include_router(database_router)
    return api_router
