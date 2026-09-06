"""Normalize Retell lifecycle events and hand structured data to agent services."""

from uuid import UUID

from app.schemas.retell import (
    NormalizedRetellCall,
    RetellProcessingResult,
    RetellWebhookRequest,
)
from app.services.agent_service import AgentRequest, AgentService
from app.services.conversation_service import ConversationInput, ConversationService


class RetellService:
    """Provider adapter with no outbound Retell requests or database queries."""

    PROCESSABLE_EVENTS = frozenset({"call_ended", "call_analyzed"})

    def __init__(
        self,
        company_id: UUID,
        *,
        agent_service: AgentService | None = None,
        conversation_service: ConversationService | None = None,
    ) -> None:
        self.company_id = UUID(str(company_id))
        self.conversation = (
            conversation_service if conversation_service is not None else ConversationService()
        )
        self.agent = agent_service if agent_service is not None else AgentService(
            conversation_service=self.conversation,
        )

    def normalize_call(self, webhook: RetellWebhookRequest) -> NormalizedRetellCall:
        """Extract call ID, event, transcript, metadata, and bounded duration."""
        call = webhook.call
        transcript = (call.transcript or "").strip()
        if not transcript and call.transcript_object:
            transcript = "\n".join(
                f"{item.role}: {item.content}" for item in call.transcript_object if item.content
            )
        duration = None
        if call.start_timestamp is not None and call.end_timestamp is not None:
            duration = max(0, (call.end_timestamp - call.start_timestamp) // 1000)
        return NormalizedRetellCall(
            call_id=call.call_id,
            event_type=webhook.event,
            transcript=transcript,
            transcript_items=tuple(call.transcript_object),
            metadata=dict(call.metadata),
            duration_seconds=duration,
        )

    def process_event(self, webhook: RetellWebhookRequest) -> RetellProcessingResult:
        """Normalize every event and process final call transcripts through AgentService.

        Started, transcript update, and transfer events are acknowledged but not
        persisted. Final processing is side-effect free until durable webhook
        idempotency and transactional persistence are implemented.
        """
        normalized = self.normalize_call(webhook)
        if webhook.event not in self.PROCESSABLE_EVENTS or not normalized.transcript:
            return RetellProcessingResult(call=normalized, status="ignored")

        extracted = self.conversation.extract_from_transcript(normalized.transcript)
        result = self.agent.handle_conversation(AgentRequest(
            company_id=self.company_id,
            action="extract_requirements",
            conversation=ConversationInput(
                transcript=normalized.transcript,
                customer_messages=tuple(
                    item.content for item in normalized.transcript_items if item.role == "user"
                ),
                extracted_information=extracted.requirements,
            ),
        ))
        return RetellProcessingResult(
            call=normalized,
            status="processed",
            requirements=result.requirements.model_dump(mode="json"),
        )
