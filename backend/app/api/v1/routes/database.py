"""Development database diagnostic; never mount on a public production API."""

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.database.supabase import SupabaseConfigurationError, get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/test", tags=["diagnostics"])


class DatabaseTestResponse(BaseModel):
    database: Literal["connected"] = "connected"
    companies_count: int = Field(ge=0)


@router.get("/database", response_model=DatabaseTestResponse)
def test_database(request: Request, response: Response) -> DatabaseTestResponse:
    # A synchronous endpoint runs the synchronous SDK in FastAPI's thread pool.
    try:
        client = get_supabase_client(request.app.state.settings)
        result = client.table("companies").select("id", count="exact", head=True).execute()
    except SupabaseConfigurationError:
        raise HTTPException(
            status_code=503,
            detail="Database is not configured. Set SUPABASE_URL and SUPABASE_KEY.",
            headers={"Cache-Control": "no-store"},
        ) from None
    except Exception as exc:
        # Provider errors can contain request details. Log only the error class,
        # never credentials, response bodies, SQL details, or raw exception text.
        logger.warning("Database connectivity check failed (%s)", type(exc).__name__)
        raise HTTPException(
            status_code=503,
            detail="Database connection or query failed. Check configuration, permissions, and migrations.",
            headers={"Cache-Control": "no-store"},
        ) from None

    if result.count is None or result.count < 0:
        logger.warning("Database count response was missing or invalid")
        raise HTTPException(
            status_code=502,
            detail="Database returned an invalid count response.",
            headers={"Cache-Control": "no-store"},
        )
    response.headers["Cache-Control"] = "no-store"
    return DatabaseTestResponse(companies_count=result.count)
