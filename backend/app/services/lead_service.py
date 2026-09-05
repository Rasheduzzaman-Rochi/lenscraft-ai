"""Pure lead preparation; no persistence or Supabase client dependencies."""

from decimal import Decimal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class LeadData(BaseModel):
    """Editable lead fields aligned with the leads SQL table."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, frozen=True)

    customer_id: UUID | None = None
    source: str | None = None
    intent: str | None = None
    status: str = Field(default="new", min_length=1)
    estimated_value: Decimal | None = Field(
        default=None, ge=0, allow_inf_nan=False, max_digits=18, decimal_places=4,
    )


class LeadPatch(LeadData):
    """Only explicitly supplied fields are changed, including explicit nulls.

    Inherited defaults are ignored by update_lead via exclude_unset=True.
    Identity and company_id are deliberately not editable fields.
    """


class LeadDraft(LeadData):
    """An in-memory lead draft; possession of an ID does not imply persistence."""

    id: UUID = Field(default_factory=uuid4)
    company_id: UUID


class LeadService:
    """Prepare tenant-scoped lead drafts for a future repository adapter."""

    def create_lead(self, *, company_id: UUID, data: LeadData) -> LeadDraft:
        """Create a draft without saving it or checking customer ownership."""
        return LeadDraft(company_id=company_id, **data.model_dump())

    def update_lead(self, *, company_id: UUID, lead: LeadDraft, patch: LeadPatch) -> LeadDraft:
        """Validate a partial update, preserve omitted fields, and return a new draft."""
        if lead.company_id != company_id:
            raise ValueError("Lead does not belong to the supplied company")
        return LeadDraft.model_validate({
            **lead.model_dump(),
            **patch.model_dump(exclude_unset=True),
        })

    def prepare_lead_data(self, *, company_id: UUID, lead: LeadDraft) -> dict[str, object]:
        """Return JSON-compatible SQL column values without performing a write.

        Decimal values serialize as strings to preserve precision. Database
        timestamps are left to their defaults/triggers. A future repository must
        verify customer ownership; requirements belong in a separate workflow,
        not arbitrary columns on the leads table.
        """
        if lead.company_id != company_id:
            raise ValueError("Lead does not belong to the supplied company")
        return lead.model_dump(mode="json")
