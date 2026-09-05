"""Company-scoped project persistence."""

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from app.repositories.base import BaseRepository, Record, identifier
from app.repositories.schemas import ProjectCreate, StatusUpdate


class ProjectRepository(BaseRepository):
    """Store project requirements; the database enforces same-company customers."""

    async def create_project(self, data: ProjectCreate | Mapping[str, Any]) -> Record:
        """Insert structured requirements; resolving natural-language deadlines is external."""
        payload = ProjectCreate.model_validate(data).model_dump(mode='json')
        payload['company_id'] = self.company_id
        return await self._run(lambda client: self._one(
            client.table('projects').insert(payload).execute(), required=True,
        ))

    async def update_project_status(self, project_id: UUID, status: str) -> Record:
        """Update a project belonging to this company or raise not-found."""
        project_id = identifier(project_id)
        payload = StatusUpdate(status=status).model_dump()
        return await self._run(lambda client: self._one(
            client.table('projects').update(payload).eq('company_id', self.company_id)
            .eq('id', project_id).execute(), required=True,
        ))
