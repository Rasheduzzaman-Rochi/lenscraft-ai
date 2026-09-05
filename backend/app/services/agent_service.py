"""Deterministic orchestration of structured actions; no voice or LLM processing."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.services.conversation_service import (
    ConversationInput, ConversationService, CustomerRequirements,
)
from app.services.lead_service import LeadData, LeadDraft, LeadPatch, LeadService
from app.services.quote_service import QuoteRequest, QuoteResult, QuoteService


class AgentRequest(BaseModel):
    """Trusted adapter command; company identity must come from verified context.

    Action is supplied explicitly by the future conversation adapter. It is never
    inferred from customer text. Existing leads must be loaded by a trusted
    repository, not accepted as authoritative records from a caller.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    company_id: UUID
    action: Literal["extract_requirements", "create_lead", "update_lead", "request_quote"]
    conversation: ConversationInput = Field(default_factory=ConversationInput)
    lead_data: LeadData | None = None
    existing_lead: LeadDraft | None = None
    lead_patch: LeadPatch | None = None
    customer_id: UUID | None = None
    project_id: UUID | None = None
    service_id: UUID | None = None

    @model_validator(mode="after")
    def validate_action_input(self) -> "AgentRequest":
        """Reject missing or unrelated action inputs instead of ignoring them."""
        if self.action == "create_lead":
            if self.lead_data is None:
                raise ValueError("create_lead requires lead_data")
        elif self.lead_data is not None:
            raise ValueError("lead_data is only valid for create_lead")
        if self.action == "update_lead":
            if self.existing_lead is None or self.lead_patch is None:
                raise ValueError("update_lead requires existing_lead and lead_patch")
            if self.existing_lead.company_id != self.company_id:
                raise ValueError("Lead does not belong to the supplied company")
        elif self.existing_lead is not None or self.lead_patch is not None:
            raise ValueError("existing_lead and lead_patch are only valid for update_lead")
        if self.action != "request_quote" and any(
            item is not None for item in (self.customer_id, self.project_id, self.service_id)
        ):
            raise ValueError("Top-level customer/project/service IDs are only valid for request_quote")
        return self


class AgentResult(BaseModel):
    """Structured requirements plus the selected service's in-memory result."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    action: Literal["extract_requirements", "create_lead", "update_lead", "request_quote"]
    requirements: CustomerRequirements
    lead: LeadDraft | None = None
    quote: QuoteResult | None = None


class AgentService:
    """Coordinate independently replaceable conversation, lead, and quote services."""

    def __init__(
        self,
        conversation_service: ConversationService | None = None,
        lead_service: LeadService | None = None,
        quote_service: QuoteService | None = None,
    ) -> None:
        self._conversation = conversation_service if conversation_service is not None else ConversationService()
        self._leads = lead_service if lead_service is not None else LeadService()
        self._quotes = quote_service if quote_service is not None else QuoteService()

    def handle_conversation(self, request: AgentRequest) -> AgentResult:
        """Normalize requirements and execute only the explicitly selected action."""
        requirements = self._conversation.extract_requirements(request.conversation)
        lead = None
        quote = None
        if request.action == "create_lead":
            # AgentRequest validation guarantees the action's required inputs.
            assert request.lead_data is not None
            lead = self._leads.create_lead(company_id=request.company_id, data=request.lead_data)
        elif request.action == "update_lead":
            assert request.existing_lead is not None and request.lead_patch is not None
            lead = self._leads.update_lead(
                company_id=request.company_id, lead=request.existing_lead, patch=request.lead_patch,
            )
        elif request.action == "request_quote":
            quote = self._quotes.handle_quote_request(QuoteRequest(
                company_id=request.company_id,
                customer_id=request.customer_id,
                project_id=request.project_id,
                service_id=request.service_id,
                requirements=requirements,
            ))
        return AgentResult(action=request.action, requirements=requirements, lead=lead, quote=quote)
