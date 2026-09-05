"""Coordinate the first persisted workflow without issuing database queries."""

import logging
from datetime import datetime
from uuid import UUID, uuid4

from app.repositories.call_repository import CallRepository
from app.repositories.customer_repository import CustomerRepository
from app.repositories.lead_repository import LeadRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.call import CallCreate
from app.schemas.conversation import ProcessConversationResponse
from app.schemas.lead import LeadCreate
from app.schemas.project import ProjectCreate
from app.services.conversation_service import ConversationService

logger = logging.getLogger(__name__)


class LeadProcessingError(RuntimeError):
    """A write failed; preceding writes remain committed and retries are unsafe."""

    def __init__(self, operation_id: UUID, stage: str, completed: dict[str, str]) -> None:
        super().__init__('Lead processing did not complete')
        self.operation_id = operation_id
        self.stage = stage
        self.completed = dict(completed)


class LeadProcessingService:
    """Execute customer → lead → project → call through injectable repositories."""

    def __init__(
        self, company_id: UUID, *,
        customers: CustomerRepository | None = None,
        leads: LeadRepository | None = None,
        projects: ProjectRepository | None = None,
        calls: CallRepository | None = None,
        conversation: ConversationService | None = None,
    ) -> None:
        self.company_id = UUID(str(company_id))
        self.customers = customers if customers is not None else CustomerRepository(company_id)
        self.leads = leads if leads is not None else LeadRepository(company_id)
        self.projects = projects if projects is not None else ProjectRepository(company_id)
        self.calls = calls if calls is not None else CallRepository(company_id)
        for repository in (self.customers, self.leads, self.projects, self.calls):
            if str(repository.company_id) != str(self.company_id):
                raise ValueError('All workflow repositories must belong to the same company')
        self.conversation = conversation if conversation is not None else ConversationService()

    async def process(self, transcript: str) -> ProcessConversationResponse:
        """Validate extracted facts before writes and surface partial failures explicitly."""
        extracted = self.conversation.extract_from_transcript(transcript)
        requirements = extracted.requirements
        deadline = None
        if requirements.deadline:
            try:
                parsed = datetime.fromisoformat(requirements.deadline.replace('Z', '+00:00'))
                if parsed.tzinfo is not None and parsed.utcoffset() is not None:
                    deadline = parsed
            except ValueError:
                pass  # Keep unresolved deadline text in the original call transcript.

        # Validate all payload shapes before the first write. The real customer ID
        # replaces this placeholder once its insert has completed.
        placeholder = uuid4()
        lead_data = LeadCreate(customer_id=placeholder, source='transcript', intent=requirements.purpose or None)
        project_data = ProjectCreate(
            customer_id=placeholder, service_type=requirements.service_type or None,
            product_category=requirements.product_category or None,
            product_count=requirements.product_count, image_count=requirements.image_count,
            deadline=deadline,
        )
        call_data = CallCreate(customer_id=placeholder, transcript=transcript, intent=requirements.purpose or None)
        operation_id = uuid4()
        completed: dict[str, str] = {}
        stage = 'customer'
        logger.info('Lead processing started operation=%s', operation_id)
        try:
            customer = await self.customers.create_customer(extracted.customer)
            customer_id = UUID(customer['id'])
            completed['customer_id'] = str(customer_id)
            stage = 'lead'
            lead = await self.leads.create_lead(lead_data.model_copy(update={'customer_id': customer_id}))
            lead_id = UUID(lead['id'])
            completed['lead_id'] = str(lead_id)
            stage = 'project'
            project = await self.projects.create_project(project_data.model_copy(update={'customer_id': customer_id}))
            project_id = UUID(project['id'])
            completed['project_id'] = str(project_id)
            stage = 'call'
            call = await self.calls.save_call_record(call_data.model_copy(update={'customer_id': customer_id}))
            completed['call_id'] = str(UUID(call['id']))
        except Exception as exc:
            # Do not log transcripts, contact details, credentials, or provider bodies.
            logger.error('Lead processing failed operation=%s stage=%s completed=%s error=%s',
                         operation_id, stage, completed, type(exc).__name__)
            raise LeadProcessingError(operation_id, stage, completed) from None
        logger.info('Lead processing completed operation=%s records=%s', operation_id, completed)
        return ProcessConversationResponse(customer_id=customer_id, lead_id=lead_id, project_id=project_id)
