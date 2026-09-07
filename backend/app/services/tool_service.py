"""Application facade for Retell custom-function operations."""

import hashlib
import json
import logging
from datetime import UTC, datetime
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
    CheckBookingAvailabilityRequest,
    CheckBookingAvailabilityResponse,
    CreateBookingConflictResponse,
    CreateBookingRequest,
    CreateBookingResponse,
    CreateBookingResult,
    CreateLeadRequest,
    CreateLeadResponse,
    GetBookingStatusRequest,
    GetBookingStatusResponse,
    KnowledgeSource,
    SearchKnowledgeRequest,
    SearchKnowledgeResponse,
    SearchServiceRequest,
    SearchServiceResponse,
    ServiceMatch,
)

from app.services.knowledge_service import KnowledgeService
from app.services.booking_service import BookingService
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
        self.booking_workflow = BookingService(
            self.company_id,
            bookings=self.bookings,
        )

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
    ) -> CreateBookingResult:
        """Validate tenant ownership and prepare the repository result for Retell."""
        self._require_company(request.company_id)
        availability = await self.booking_workflow.check_availability(
            request.date_time,
        )
        if not availability.available:
            return CreateBookingConflictResponse()

        row = await self.bookings.create_booking(request)
        try:
            result = CreateBookingResponse(
                customer_id=row["customer_id"],
                booking_id=row["booking_id"],
                status=row["status"],
                pending_conflict=(True if availability.pending_conflict else None),
                message=(
                    "Booking request received; this time has another pending request."
                    if availability.pending_conflict
                    else "Booking created successfully"
                ),
            )
        except (KeyError, TypeError, ValidationError):
            raise ToolDataError("Booking workflow returned invalid data") from None
        logger.info(
            "Booking tool completed company_id=%s booking_id=%s",
            self.company_id,
            result.booking_id,
        )
        return result


    async def check_booking_availability(
        self,
        request: CheckBookingAvailabilityRequest,
    ) -> CheckBookingAvailabilityResponse:
        """Return an exact-slot availability decision for Retell."""
        self._require_company(request.company_id)
        result = await self.booking_workflow.check_availability(request.date_time)
        return CheckBookingAvailabilityResponse.model_validate(
            result.model_dump(),
        )


    async def get_booking_status(
        self,
        request: GetBookingStatusRequest,
    ) -> GetBookingStatusResponse:
        """Return the nearest relevant booking without exposing customer data."""
        self._require_company(request.company_id)
        now = datetime.now(UTC)

        if request.booking_id is not None:
            row = await self.bookings.get_booking_by_id(
                request.booking_id,
                email=request.email,
                phone=request.phone,
            )
            rows = [] if row is None else [row]
        else:
            rows = await self.bookings.find_customer_bookings(
                email=request.email,
                phone=request.phone,
                reference_time=now,
                limit=3,
            )

        if not rows:
            return GetBookingStatusResponse(
                found=False,
                message="No matching booking was found.",
            )

        try:
            candidates = [
                GetBookingStatusResponse(
                    found=True,
                    booking_id=row["id"],
                    service_type=row.get("service_type"),
                    date_time=row["date_time"],
                    status=row["status"],
                )
                for row in rows
            ]
            upcoming = [item for item in candidates if item.date_time >= now]
            result = (
                min(upcoming, key=lambda item: item.date_time)
                if upcoming
                else max(candidates, key=lambda item: item.date_time)
            )
        except (KeyError, TypeError, ValidationError):
            raise ToolDataError("Booking lookup returned invalid data") from None

        logger.info(
            "Booking status tool completed company_id=%s booking_id=%s",
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
