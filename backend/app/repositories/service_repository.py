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
