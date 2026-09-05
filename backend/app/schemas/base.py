"""Shared validation primitives for persistence inputs."""

from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

Money = Annotated[Decimal, Field(ge=0, allow_inf_nan=False, max_digits=18, decimal_places=4)]
Count = Annotated[int, Field(ge=0, le=2147483647, strict=True)]


class WriteData(BaseModel):
    """Reject unknown fields and normalize surrounding string whitespace."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, revalidate_instances="always")
