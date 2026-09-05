"""Validated project creation data."""

from uuid import UUID
from pydantic import AwareDatetime, Field
from app.schemas.base import Count, WriteData


class ProjectCreate(WriteData):
    """Project columns; a deadline must identify an absolute instant."""

    customer_id: UUID
    service_type: str | None = None
    product_category: str | None = None
    product_count: Count | None = None
    image_count: Count | None = None
    deadline: AwareDatetime | None = None
    status: str = Field(default="draft", min_length=1)
