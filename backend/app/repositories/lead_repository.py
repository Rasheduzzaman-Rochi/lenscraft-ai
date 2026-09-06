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

    async def create_tool_workflow(
        self, *, request_id: str, request_hash: str,
        customer: Mapping[str, Any], lead: Mapping[str, Any], project: Mapping[str, Any],
    ) -> Record:
        """Create customer, lead, and project in one idempotent database transaction."""
        request_id = request_id.strip()
        if not request_id or len(request_id) > 200:
            raise ValueError('request_id must contain 1 to 200 characters')
        if len(request_hash) != 64 or any(character not in '0123456789abcdef' for character in request_hash):
            raise ValueError('request_hash must be a lowercase SHA-256 digest')
        parameters = {
            'p_company_id': self.company_id,
            'p_request_id': request_id,
            'p_request_hash': request_hash,
            'p_customer': dict(customer),
            'p_lead': dict(lead),
            'p_project': dict(project),
        }
        return await self._run(lambda client: self._one(
            client.rpc('create_lead_tool_workflow', parameters).execute(), required=True,
        ))
