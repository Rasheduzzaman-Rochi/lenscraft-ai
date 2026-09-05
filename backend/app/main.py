"""ASGI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response

from app.api.v1.router import create_api_router
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.database.supabase import close_supabase_client


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else get_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        configure_logging(settings.log_level)
        logger = logging.getLogger(__name__)
        logger.info("Backend started", extra={"environment": settings.environment})
        try:
            yield
        finally:
            close_supabase_client()
            logger.info("Backend stopped")

    application = FastAPI(title=settings.app_name, lifespan=lifespan)
    application.state.settings = settings
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    application.include_router(
        create_api_router(include_development_routes=settings.environment in {"development", "testing"}),
        prefix="/api/v1",
    )

    @application.get("/", include_in_schema=False)
    async def root() -> RedirectResponse:
        return RedirectResponse(url="docs")

    @application.get("/favicon.ico", include_in_schema=False, status_code=204)
    async def favicon() -> Response:
        return Response(status_code=204)

    return application


app = create_app()
