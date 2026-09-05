"""Database-backed quote calculation and backwards-compatible draft preparation."""

from decimal import Decimal
from typing import Literal, Protocol
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.services.conversation_service import CustomerRequirements
from app.schemas.quote import PricingRule, QuoteCalculateRequest, QuoteCalculation
from app.repositories.service_repository import ServiceRepository
from app.repositories.pricing_repository import PricingRepository
from app.repositories.errors import RecordNotFoundError
from app.services.pricing_engine import PricingConfigurationError, calculate_price


class QuoteRequest(BaseModel):
    """Tenant-scoped pricing input; related IDs must later be verified by an adapter."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    company_id: UUID
    customer_id: UUID | None = None
    project_id: UUID | None = None
    service_id: UUID | None = None
    requirements: CustomerRequirements


class PriceCalculation(BaseModel):
    """A future pricing engine's result, using exact decimal currency amounts."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    currency: str = Field(pattern=r"^[A-Z]{3}$")
    total_price: Decimal = Field(ge=0, allow_inf_nan=False, max_digits=18, decimal_places=4)


class PricingCalculator(Protocol):
    """Future implementation loads tenant services/pricing_rules and evaluates them.

    Implementations must validate service/project/customer ownership, required
    inputs, active service status, and pricing configuration. No default amount,
    currency, tax, or pricing formula is supplied by this layer.
    """

    def calculate(self, request: QuoteRequest) -> PriceCalculation:
        """Calculate a price or raise a domain error; never silently return zero."""
        ...


class QuoteResult(BaseModel):
    """Explicitly distinguish a pending pricing request from a calculated amount."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    request: QuoteRequest
    status: Literal["awaiting_pricing", "calculated"]
    calculation: PriceCalculation | None = None

    @model_validator(mode="after")
    def validate_calculation(self) -> "QuoteResult":
        """Prevent pending requests from masquerading as calculated quotes."""
        if (self.status == "calculated") != (self.calculation is not None):
            raise ValueError("Calculated status requires a calculation; pending status must not have one")
        return self


class QuoteService:
    """Delegate pricing when configured; otherwise return a pending request."""

    def __init__(self, calculator: PricingCalculator | None = None) -> None:
        self._calculator = calculator

    def handle_quote_request(self, request: QuoteRequest) -> QuoteResult:
        """Prepare a quote without persistence or hardcoded pricing."""
        if self._calculator is None:
            return QuoteResult(request=request, status="awaiting_pricing")
        calculation = self._calculator.calculate(request)
        if not isinstance(calculation, PriceCalculation):
            raise TypeError("Pricing calculator must return PriceCalculation")
        return QuoteResult(request=request, status="calculated", calculation=calculation)

    async def calculate_quote(self, request: 'QuoteCalculateRequest') -> 'QuoteCalculation':
        """Load this company's catalog and rules, then prepare an unsaved calculation."""

        service = await ServiceRepository(request.company_id).get_service_by_name(request.service_name)
        if service is None or service.get('is_active') is not True:
            raise RecordNotFoundError('Active service not found in this company')
        try:
            service_id = UUID(str(service['id']))
            if UUID(str(service['company_id'])) != request.company_id:
                raise ValueError('Service company mismatch')
            name = service['name']
            pricing_type = service['pricing_type']
        except (KeyError, TypeError, ValueError):
            raise PricingConfigurationError('Invalid service configuration') from None
        records = await PricingRepository(request.company_id).get_pricing_configuration(service_id)
        try:
            rules = [PricingRule.model_validate(record) for record in records]
            if any(rule.service_id != service_id for rule in rules):
                raise ValueError('Rule service mismatch')
        except (ValidationError, ValueError):
            raise PricingConfigurationError('Invalid stored pricing rules') from None
        return calculate_price(request, service_name=name, pricing_type=pricing_type, rules=rules)
