"""Company-scoped photography service lookup."""

from app.repositories.base import BaseRepository, Record, pagination


class ServiceRepository(BaseRepository):
    """Read catalog entries without embedding pricing decisions in queries."""

    async def get_service_by_name(self, name: str) -> Record | None:
        """Use an exact trimmed name; duplicate names are an explicit conflict."""
        name = name.strip()
        if not name:
            raise ValueError('Service name must not be empty')
        return await self._run(lambda client: self._one(
            client.table('services').select('*').eq('company_id', self.company_id)
            .eq('name', name).limit(2).execute(),
        ))

    async def get_active_services(self, *, limit: int = 50, offset: int = 0) -> list[Record]:
        """Return a bounded, consistently ordered page of this company's active catalog."""
        start, end = pagination(limit, offset)
        return await self._run(lambda client: self._rows(
            client.table('services').select('*').eq('company_id', self.company_id)
            .eq('is_active', True).order('name').order('id').range(start, end).execute(),
        ))

    async def search_active_services(self, query: str, *, limit: int = 5) -> list[Record]:
        """Search this company's active catalog through the indexed database function."""
        query = query.strip()
        if not query:
            raise ValueError('Service search query must not be empty')
        if type(limit) is not int or not 1 <= limit <= 10:
            raise ValueError('limit must be an integer between 1 and 10')
        parameters = {'p_company_id': self.company_id, 'p_query': query, 'p_limit': limit}
        return await self._run(lambda client: self._rows(
            client.rpc('search_active_services', parameters).execute(),
        ))
