"""Normalize supplied conversation requirements without interpreting speech or text."""

from pydantic import BaseModel, ConfigDict, Field


class CustomerRequirements(BaseModel):
    """Known customer needs; blanks and None mean information is not yet known."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, frozen=True)

    product_category: str = ""
    service_type: str = ""
    product_count: int | None = Field(default=None, ge=0, strict=True)
    image_count: int | None = Field(default=None, ge=0, strict=True)
    deadline: str = ""
    purpose: str = ""


class ConversationInput(BaseModel):
    """Adapter input; extracted_information must already contain structured facts.

    Transcript and messages are accepted for future processors, but this initial
    layer does not extract facts from them. Deadline remains customer-provided
    text until a future workflow resolves its date and time zone.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    transcript: str = ""
    customer_messages: tuple[str, ...] = ()
    extracted_information: CustomerRequirements = Field(default_factory=CustomerRequirements)


class ConversationService:
    """Return validated facts without guessing missing requirements."""

    def extract_requirements(self, conversation: ConversationInput) -> CustomerRequirements:
        """Normalize the supplied facts; raw conversation text is not analyzed."""
        return CustomerRequirements.model_validate(conversation.extracted_information.model_dump())
