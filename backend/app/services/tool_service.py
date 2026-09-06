"""Application facade for Retell custom-function operations."""

import hashlib
import json
import logging
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from app.repositories.lead_repository import LeadRepository
from app.repositories.service_repository import ServiceRepository
from app.repositories.booking_repository import BookingRepository

from app.schemas.knowledge import KnowledgeSearchRequest
from app.schemas.tools import (
    CalculateQuoteRequest,
    CalculateQuoteResponse,
    CreateBookingRequest,
    CreateBookingResponse,
    CreateLeadRequest,
    CreateLeadResponse,
    KnowledgeSource,
    SearchKnowledgeRequest,
    SearchKnowledgeResponse,
    SearchServiceRequest,
    SearchServiceResponse,
    ServiceMatch,
)

from app.services.knowledge_service import KnowledgeService
from app.services.quote_service import QuoteService


logger = logging.getLogger(__name__)


class ToolDataError(RuntimeError):
    """The database returned a shape that violates a tool response contract."""


class ToolService:
    """Authorize one tenant context and coordinate tool-specific services."""

    def __init__(
        self,
        company_id: UUID,
        *,
        services: ServiceRepository | None = None,
        leads: LeadRepository | None = None,
        bookings: BookingRepository | None = None,
        quotes: QuoteService | None = None,
        knowledge: KnowledgeService | None = None,
    ) -> None:

        self.company_id = UUID(str(company_id))

        self.services = services or ServiceRepository(self.company_id)
        self.leads = leads or LeadRepository(self.company_id)
        self.bookings = bookings or BookingRepository(self.company_id)

        self.quotes = quotes or QuoteService()
        self.knowledge = knowledge or KnowledgeService(self.company_id)

        for repository in (
            self.services,
            self.leads,
            self.bookings,
        ):
            if repository.company_id != str(self.company_id):
                raise ValueError(
                    "Tool repositories must belong to configured company"
                )

        if self.knowledge.company_id != self.company_id:
            raise ValueError(
                "Knowledge service must belong to configured company"
            )


    async def search_service(
        self,
        request: SearchServiceRequest,
    ) -> SearchServiceResponse:

        self._require_company(request.company_id)

        rows = await self.services.search_active_services(
            request.query,
            limit=request.limit,
        )

        try:
            matches = [
                ServiceMatch.model_validate({
                    "id": row["id"],
                    "name": row["name"],
                    "category": row.get("category"),
                    "description": self._bounded_description(
                        row.get("description")
                    ),
                    "pricing_type": row["pricing_type"],
                    "relevance": row["relevance"],
                })
                for row in rows
            ]

        except (KeyError, TypeError, ValidationError):
            raise ToolDataError(
                "Service search returned invalid data"
            ) from None


        return SearchServiceResponse(
            services=matches
        )


    async def calculate_quote(
        self,
        request: CalculateQuoteRequest,
    ) -> CalculateQuoteResponse:

        self._require_company(request.company_id)

        result = await self.quotes.calculate_quote(request)

        try:
            return CalculateQuoteResponse.model_validate(
                result.model_dump()
            )

        except ValidationError:
            raise ToolDataError(
                "Quote calculation returned invalid data"
            ) from None



    async def create_booking(
        self,
        request: CreateBookingRequest,
    ) -> CreateBookingResponse:
        """Validate tenant ownership and prepare the repository result for Retell."""
        self._require_company(request.company_id)
        row = await self.bookings.create_booking(request)
        try:
            result = CreateBookingResponse(
                customer_id=row["customer_id"],
                booking_id=row["booking_id"],
                status=row["status"],
            )
        except (KeyError, TypeError, ValidationError):
            raise ToolDataError("Booking workflow returned invalid data") from None
        logger.info(
            "Booking tool completed company_id=%s booking_id=%s",
            self.company_id,
            result.booking_id,
        )
        return result



    async def create_lead(
        self,
        request: CreateLeadRequest,
    ) -> CreateLeadResponse:

        self._require_company(request.company_id)


        payload = request.model_dump(
            mode="json",
            exclude={"request_id"},
        )


        request_hash = hashlib.sha256(
            json.dumps(
                payload,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()


        row = await self.leads.create_tool_workflow(

            request_id=request.request_id,

            request_hash=request_hash,

            customer=request.customer.model_dump(
                mode="json"
            ),

            lead=request.lead.model_dump(
                mode="json"
            ),

            project=request.project.model_dump(
                mode="json"
            ),

        )


        try:

            return CreateLeadResponse(

                customer_id=row["customer_id"],

                lead_id=row["lead_id"],

                project_id=row["project_id"],

                replayed=row.get(
                    "replayed",
                    False,
                ),

            )

        except (
            KeyError,
            TypeError,
            ValidationError,
        ):

            raise ToolDataError(
                "Lead workflow returned invalid data"
            ) from None



    async def search_knowledge(
        self,
        request: SearchKnowledgeRequest,
    ) -> SearchKnowledgeResponse:


        self._require_company(
            request.company_id
        )


        result = await self.knowledge.retrieve_relevant_knowledge(

            KnowledgeSearchRequest(

                company_id=request.company_id,

                query=request.question,

                limit=request.limit,

                max_context_characters=6000,

            )

        )


        try:

            return SearchKnowledgeResponse(

                context=result.context,

                sources=[

                    KnowledgeSource(

                        id=item.id,

                        title=item.title,

                        relevance=item.relevance,

                    )

                    for item in result.documents

                ],

                retrieval_mode=result.retrieval_mode,

            )


        except ValidationError:

            raise ToolDataError(
                "Knowledge search returned invalid data"
            ) from None



    def _require_company(
        self,
        company_id: UUID,
    ) -> None:

        if company_id != self.company_id:

            raise PermissionError(
                "Tool request belongs to another company"
            )



    @staticmethod
    def _bounded_description(
        value: Any,
    ) -> str | None:

        if value is None:

            return None


        if not isinstance(value, str):

            raise TypeError(
                "Service description must be text"
            )


        return value[:1000]
