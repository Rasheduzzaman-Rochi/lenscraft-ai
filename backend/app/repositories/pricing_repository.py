"""Tenant-scoped pricing rule/configuration retrieval; no price calculations."""

from uuid import UUID
from supabase import Client

from app.repositories.base import BaseRepository, Record, identifier
from app.repositories.errors import RepositoryError


class PricingRepository(BaseRepository):
    """Scope rule access through an inner join to the owning service."""

    async def get_pricing_rules(self, service_id: UUID) -> list[Record]:
        """Fetch a complete bounded rule set or fail rather than calculate a partial price."""
        service_id = identifier(service_id)
        def query(client: Client) -> list[Record]:
            response = (client.table('pricing_rules')
                        .select('id,service_id,rule_type,value,condition,services!inner(company_id)', count='exact')
                        .eq('service_id', service_id).eq('services.company_id', self.company_id)
                        .order('id').limit(1000).execute())
            rows = self._rows(response)
            if response.count is None or response.count != len(rows):
                raise RepositoryError('Pricing rule set is incomplete or exceeds the supported limit')
            return rows
        return await self._run(query)

    async def get_pricing_configuration(self, service_id: UUID) -> list[Record]:
        """Return rule values and JSON conditions that configure this service's pricing."""
        return await self.get_pricing_rules(service_id)
