"""Company-scoped lead persistence."""

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from app.repositories.base import BaseRepository, Record, identifier
from app.repositories.schemas import LeadCreate, StatusUpdate


class LeadRepository(BaseRepository):
    """Persist leads; customer tenant integrity is enforced by the composite FK."""

    async def create_lead(self, data: LeadCreate | Mapping[str, Any]) -> Record:
        """Insert a lead; the company is supplied by this repository, not the payload."""
        payload = LeadCreate.model_validate(data).model_dump(mode='json')
        if payload['id'] is None:
            del payload['id']
        payload['company_id'] = self.company_id
        return await self._run(lambda client: self._one(
            client.table('leads').insert(payload).execute(), required=True,
        ))

    async def update_lead_status(self, lead_id: UUID, status: str) -> Record:
        """Persist a status selected by the service; no transition rules are imposed."""
        lead_id = identifier(lead_id)
        payload = StatusUpdate(status=status).model_dump()
        return await self._run(lambda client: self._one(
            client.table('leads').update(payload).eq('company_id', self.company_id)
            .eq('id', lead_id).execute(), required=True,
        ))

    async def get_lead_by_id(self, lead_id: UUID) -> Record | None:
        """Return this company's lead, or None when it does not exist here."""
        lead_id = identifier(lead_id)
        return await self._run(lambda client: self._one(
            client.table('leads').select('*').eq('company_id', self.company_id)
            .eq('id', lead_id).limit(1).execute(),
        ))
