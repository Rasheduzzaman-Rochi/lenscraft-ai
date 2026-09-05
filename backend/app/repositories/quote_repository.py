"""Quote persistence scoped through a company-owned project."""

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from supabase import Client

from app.repositories.base import BaseRepository, Record, identifier, pagination
from app.repositories.schemas import QuoteCreate, StatusUpdate


class QuoteRepository(BaseRepository):
    """Verify the parent project before every quote operation.

    Ownership verification and the quote query are separate HTTP requests, not a
    transaction. Tenant transfers must not race these operations; implement an
    atomic database RPC before supporting project company transfers.
    """

    async def create_quote(self, project_id: UUID, data: QuoteCreate | Mapping[str, Any]) -> Record:
        """Save amounts calculated elsewhere; do not calculate or invent a total."""
        project_id = identifier(project_id)
        payload = QuoteCreate.model_validate(data).model_dump(mode='json')
        payload['project_id'] = project_id
        def query(client: Client) -> Record:
            self._require_project(client, project_id)
            return self._one(client.table('quotes').insert(payload).execute(), required=True)
        return await self._run(query)

    async def update_quote_status(self, project_id: UUID, quote_id: UUID, status: str) -> Record:
        """Update only a quote attached to the verified project in this company."""
        project_id, quote_id = identifier(project_id), identifier(quote_id)
        payload = StatusUpdate(status=status).model_dump()
        def query(client: Client) -> Record:
            self._require_project(client, project_id)
            return self._one(client.table('quotes').update(payload).eq('project_id', project_id)
                             .eq('id', quote_id).execute(), required=True)
        return await self._run(query)

    async def get_quotes_by_project(
        self, project_id: UUID, *, limit: int = 50, offset: int = 0,
    ) -> list[Record]:
        """Return a page of quotes newest first; one project can have multiple quotes."""
        project_id = identifier(project_id)
        start, end = pagination(limit, offset)
        def query(client: Client) -> list[Record]:
            self._require_project(client, project_id)
            return self._rows(client.table('quotes').select('*').eq('project_id', project_id)
                              .order('created_at', desc=True).order('id', desc=True)
                              .range(start, end).execute())
        return await self._run(query)
