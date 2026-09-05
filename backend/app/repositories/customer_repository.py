"""Company-scoped customer persistence."""

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from app.repositories.base import BaseRepository, Record, identifier
from app.repositories.schemas import CustomerCreate, CustomerUpdate


class CustomerRepository(BaseRepository):
    """Create and update customers without business logic or implicit deduplication."""

    async def create_customer(self, data: CustomerCreate | Mapping[str, Any]) -> Record:
        """Insert a validated customer in this company and return the saved row."""
        payload = CustomerCreate.model_validate(data).model_dump(mode='json')
        payload['company_id'] = self.company_id
        return await self._run(lambda client: self._one(
            client.table('customers').insert(payload).execute(), required=True,
        ))

    async def get_customer_by_email(self, email: str) -> Record | None:
        """Find a canonical email; raise a conflict if shared contacts are ambiguous.

        New writes normalize email to lowercase. Legacy external rows must follow
        that convention as well. The schema intentionally does not make it unique.
        """
        email = email.strip().lower()
        if not email:
            raise ValueError('email must not be empty')
        return await self._run(lambda client: self._one(
            client.table('customers').select('*').eq('company_id', self.company_id)
            .eq('email', email).limit(2).execute(),
        ))

    async def update_customer(self, customer_id: UUID, data: CustomerUpdate | Mapping[str, Any]) -> Record:
        """Update only explicitly supplied fields; identity and tenant cannot change."""
        customer_id = identifier(customer_id)
        payload = CustomerUpdate.model_validate(data).model_dump(mode='json', exclude_unset=True)
        if not payload:
            raise ValueError('Customer update must contain at least one field')
        return await self._run(lambda client: self._one(
            client.table('customers').update(payload).eq('company_id', self.company_id)
            .eq('id', customer_id).execute(), required=True,
        ))
