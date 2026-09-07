"""Compose version-one route groups."""

from fastapi import APIRouter

from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.database import router as database_router
from app.api.v1.routes.agent import router as agent_router
from app.api.v1.routes.bookings import router as bookings_router
from app.api.v1.routes.quotes import router as quotes_router
from app.api.v1.routes.knowledge import router as knowledge_router
from app.api.v1.routes.retell import router as retell_router
from app.api.v1.routes.tools import development_router as development_tools_router
from app.api.v1.routes.tools import router as tools_router

router = APIRouter()
router.include_router(health_router)
router.include_router(retell_router)
router.include_router(tools_router)
router.include_router(bookings_router)


def create_api_router(*, include_development_routes: bool = False) -> APIRouter:
    api_router = APIRouter()
    api_router.include_router(router)
    if include_development_routes:
        api_router.include_router(database_router)
        api_router.include_router(agent_router)
        api_router.include_router(quotes_router)
        api_router.include_router(knowledge_router)
        api_router.include_router(development_tools_router)
    return api_router
