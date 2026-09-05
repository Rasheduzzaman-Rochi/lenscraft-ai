"""Company-scoped call persistence and bounded history queries."""

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from supabase import Client

from app.repositories.base import BaseRepository, Record, identifier, pagination
from app.repositories.schemas import CallCreate


class CallRepository(BaseRepository):
    """Store call records without interpreting transcripts or handling webhooks."""

    async def save_call_record(self, data: CallCreate | Mapping[str, Any]) -> Record:
        """Insert once; duplicate Retell IDs raise a conflict rather than overwrite."""
        payload = CallCreate.model_validate(data).model_dump(mode='json')
        payload['company_id'] = self.company_id
        return await self._run(lambda client: self._one(
            client.table('calls').insert(payload).execute(), required=True,
        ))

    async def get_call_history(
        self, *, customer_id: UUID | None = None, limit: int = 50, offset: int = 0,
    ) -> list[Record]:
        """Return a page newest first, optionally filtered by customer UUID."""
        start, end = pagination(limit, offset)
        customer = identifier(customer_id) if customer_id is not None else None
        def query(client: Client) -> list[Record]:
            builder = client.table('calls').select('*').eq('company_id', self.company_id)
            if customer is not None:
                builder = builder.eq('customer_id', customer)
            return self._rows(builder.order('created_at', desc=True).order('id', desc=True)
                              .range(start, end).execute())
        return await self._run(query)
