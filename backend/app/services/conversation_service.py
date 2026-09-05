"""Normalize structured facts and deterministically parse explicitly labeled text."""

import re
from app.schemas.conversation import (
    ConversationInput, CustomerRequirements, ExtractedConversation, ProcessConversationRequest,
)
from app.schemas.customer import CustomerCreate


class ConversationService:
    """Return validated facts without guessing missing requirements."""

    def extract_requirements(self, conversation: ConversationInput) -> CustomerRequirements:
        """Normalize the supplied facts; raw conversation text is not analyzed."""
        return CustomerRequirements.model_validate(conversation.extracted_information.model_dump())

    def extract_from_transcript(self, transcript: str) -> ExtractedConversation:
        """Parse labeled facts separated by semicolons/newlines; never guess prose.

        Supported labels are customer/name, email, phone, business name, industry,
        product category, service type, product count, image count, deadline, and
        purpose (underscores also accepted). Conflicting duplicates are rejected.
        Unrecognized text remains available in the stored original transcript.
        """
        transcript = ProcessConversationRequest(transcript=transcript).transcript
        fields: dict[str, str] = {}
        supported = {
            "name", "customer_name", "email", "phone", "business_name", "industry",
            "product_category", "service_type", "product_count", "image_count", "deadline", "purpose",
        }
        for part in re.split(r"[;\n]", transcript):
            label, separator, value = part.partition(":")
            key = label.strip().lower().replace(" ", "_")
            if not separator or key not in supported:
                continue
            key = "name" if key == "customer_name" else key
            value = value.strip()
            if not value:
                continue
            if key in fields and fields[key] != value:
                raise ValueError("Conflicting labeled conversation facts")
            fields[key] = value
        requirements: dict[str, object] = {
            key: fields[key] for key in CustomerRequirements.model_fields if key in fields
        }
        for key in ("product_count", "image_count"):
            if key in requirements:
                raw = str(requirements[key])
                if not re.fullmatch(r"[0-9]{1,10}", raw) or int(raw) > 2147483647:
                    raise ValueError("Labeled counts must be nonnegative PostgreSQL integers")
                requirements[key] = int(raw)
        customer = {key: fields[key] for key in CustomerCreate.model_fields if key in fields}
        customer.setdefault("name", "Unidentified customer")
        normalized = self.extract_requirements(ConversationInput(extracted_information=requirements))
        return ExtractedConversation(customer=CustomerCreate(**customer), requirements=normalized)
