"""Shared query execution for the existing synchronous Supabase SDK."""

import logging
from collections.abc import Callable
from typing import Any, Literal, TypeVar, overload
from uuid import UUID

from anyio import to_thread
from postgrest.exceptions import APIError
from supabase import Client

from app.database.supabase import get_supabase_client
from app.repositories.errors import (
    RecordNotFoundError, RepositoryConflictError, RepositoryError, RepositoryIntegrityError,
)

Record = dict[str, Any]
T = TypeVar('T')
logger = logging.getLogger(__name__)


def identifier(value: UUID) -> str:
    """Validate UUID identifiers even when called directly from untyped code."""
    return str(UUID(str(value)))


def pagination(limit: int, offset: int) -> tuple[int, int]:
    """Bound result size and reject invalid offsets before making requests."""
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError('limit must be an integer between 1 and 100')
    if type(offset) is not int or offset < 0:
        raise ValueError('offset must be a nonnegative integer')
    return offset, offset + limit - 1


class BaseRepository:
    """Bind every adapter to a trusted company UUID, with an injectable SDK client.

    Tenant IDs must come from verified context. The shared server key bypasses
    RLS, so every query must explicitly scope its company or validated parent.
    """

    def __init__(self, company_id: UUID, *, client: Client | None = None) -> None:
        self.company_id = identifier(company_id)
        self._client = client

    async def _run(self, operation: Callable[[Client], T]) -> T:
        """Offload initialization and all SDK I/O; do not retry ambiguous writes."""
        def execute() -> T:
            try:
                client = self._client if self._client is not None else get_supabase_client()
                return operation(client)
            except RepositoryError:
                raise
            except APIError as exc:
                logger.warning('Repository query rejected (%s)', type(exc).__name__)
                if exc.code == '23505':
                    raise RepositoryConflictError('Record conflicts with an existing record') from None
                if exc.code in {'23503', '23514', '23502', '23001'}:
                    raise RepositoryIntegrityError('Record violates a database constraint') from None
                raise RepositoryError('Database operation failed') from None
            except Exception as exc:
                logger.warning('Repository operation failed (%s)', type(exc).__name__)
                raise RepositoryError('Database operation failed') from None
        return await to_thread.run_sync(execute)

    @staticmethod
    def _rows(response: Any) -> list[Record]:
        """Validate the SDK result shape instead of reporting malformed data as empty."""
        if not isinstance(response.data, list) or not all(isinstance(row, dict) for row in response.data):
            raise RepositoryError('Database returned an invalid record response')
        return response.data

    @classmethod
    @overload
    def _one(cls, response: Any, *, required: Literal[True]) -> Record: ...

    @classmethod
    @overload
    def _one(cls, response: Any, *, required: Literal[False] = False) -> Record | None: ...

    @classmethod
    def _one(cls, response: Any, *, required: bool = False) -> Record | None:
        rows = cls._rows(response)
        if len(rows) > 1:
            raise RepositoryConflictError('Lookup matched multiple records')
        if not rows:
            if required:
                raise RecordNotFoundError('Record not found in this company')
            return None
        return rows[0]

    def _require_project(self, client: Client, project_id: str) -> None:
        """Validate quote tenancy through its project; never query an unscoped quote."""
        self._one(client.table('projects').select('id').eq('company_id', self.company_id)
                  .eq('id', project_id).limit(1).execute(), required=True)
