"""Compose version-one route groups."""

from fastapi import APIRouter

from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.database import router as database_router
from app.api.v1.routes.agent import router as agent_router
from app.api.v1.routes.quotes import router as quotes_router

router = APIRouter()
router.include_router(health_router)


def create_api_router(*, include_development_routes: bool = False) -> APIRouter:
    api_router = APIRouter()
    api_router.include_router(router)
    if include_development_routes:
        api_router.include_router(database_router)
        api_router.include_router(agent_router)
        api_router.include_router(quotes_router)
    return api_router
