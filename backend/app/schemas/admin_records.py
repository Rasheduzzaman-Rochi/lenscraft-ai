"""Validated admin management contracts for catalog, CRM, knowledge, and settings records."""

import json
import re
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID
from zoneinfo import available_timezones

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.base import Count, Money

Slug = Annotated[str, Field(min_length=1, max_length=50, pattern=r"^[a-z][a-z0-9_]{0,49}$")]
RuleValue = Annotated[Decimal, Field(allow_inf_nan=False, max_digits=18, decimal_places=4)]

_TIME = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
_SECRET_KEY = re.compile(r"(secret|token|password|api[_-]?key|credential)", re.IGNORECASE)
_MAX_JSON_BYTES = 20_000


class AdminWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def _bounded_json(value: dict[str, Any], label: str) -> dict[str, Any]:
    if len(json.dumps(value, separators=(",", ":"))) > _MAX_JSON_BYTES:
        raise ValueError(f"{label} is too large")
    return value


def _blank_to_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


class AdminPage(BaseModel):
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)


# Services ------------------------------------------------------------------


class AdminService(BaseModel):
    id: UUID
    name: str
    category: str | None = None
    description: str | None = None
    pricing_type: str
    is_active: bool
    created_at: AwareDatetime
    updated_at: AwareDatetime


class AdminServiceList(AdminPage):
    items: list[AdminService]
    pricing_types: list[str] = Field(default_factory=list)


class AdminServiceCreate(AdminWrite):
    name: str = Field(min_length=1, max_length=200)
    category: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5_000)
    pricing_type: Slug
    is_active: bool = True

    _blank = field_validator("category", "description", mode="before")(_blank_to_none)


class AdminServiceUpdate(AdminWrite):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5_000)
    pricing_type: Slug | None = None
    is_active: bool | None = None
    expected_updated_at: AwareDatetime

    _blank = field_validator("category", "description", mode="before")(_blank_to_none)

    @model_validator(mode="after")
    def required_columns_cannot_be_cleared(self) -> "AdminServiceUpdate":
        for column in ("name", "pricing_type", "is_active"):
            if column in self.model_fields_set and getattr(self, column) is None:
                raise ValueError(f"{column} cannot be cleared")
        return self


# Pricing rules -------------------------------------------------------------


class AdminPricingRule(BaseModel):
    id: UUID
    service_id: UUID
    service_name: str
    service_is_active: bool
    rule_type: str
    value: Decimal
    condition: dict[str, Any] = Field(default_factory=dict)
    created_at: AwareDatetime
    updated_at: AwareDatetime


class AdminPricingRuleList(BaseModel):
    items: list[AdminPricingRule]
    rule_types: list[str] = Field(default_factory=list)


class AdminPricingRuleCreate(AdminWrite):
    service_id: UUID
    rule_type: Slug
    value: RuleValue
    condition: dict[str, Any] = Field(default_factory=dict)

    @field_validator("condition")
    @classmethod
    def bounded_condition(cls, value: dict[str, Any]) -> dict[str, Any]:
        return _bounded_json(value, "Condition")


class AdminPricingRuleUpdate(AdminWrite):
    rule_type: Slug | None = None
    value: RuleValue | None = None
    condition: dict[str, Any] | None = None
    expected_updated_at: AwareDatetime

    @field_validator("condition")
    @classmethod
    def bounded_condition(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return _bounded_json(value, "Condition") if value is not None else None

    @model_validator(mode="after")
    def required_columns_cannot_be_cleared(self) -> "AdminPricingRuleUpdate":
        for column in ("rule_type", "value", "condition"):
            if column in self.model_fields_set and getattr(self, column) is None:
                raise ValueError(f"{column} cannot be cleared")
        return self


# Customers -----------------------------------------------------------------


class AdminCustomer(BaseModel):
    id: UUID
    name: str
    email: str | None = None
    phone: str | None = None
    business_name: str | None = None
    industry: str | None = None
    created_at: AwareDatetime
    updated_at: AwareDatetime


class AdminCustomerList(AdminPage):
    items: list[AdminCustomer]


class AdminRelatedLead(BaseModel):
    id: UUID
    status: str
    source: str | None = None
    intent: str | None = None
    estimated_value: Decimal | None = None
    created_at: AwareDatetime


class AdminRelatedBooking(BaseModel):
    id: UUID
    service: str | None = None
    date_time: AwareDatetime
    status: str
    created_at: AwareDatetime


class AdminRelatedProject(BaseModel):
    id: UUID
    service_type: str | None = None
    product_category: str | None = None
    image_count: int | None = None
    deadline: AwareDatetime | None = None
    status: str
    created_at: AwareDatetime


class AdminCustomerDetail(AdminCustomer):
    leads: list[AdminRelatedLead] = Field(default_factory=list)
    projects: list[AdminRelatedProject] = Field(default_factory=list)
    bookings: list[AdminRelatedBooking] = Field(default_factory=list)


class AdminCustomerUpdate(AdminWrite):
    name: str | None = Field(default=None, min_length=1, max_length=500)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=50)
    business_name: str | None = Field(default=None, max_length=500)
    industry: str | None = Field(default=None, max_length=200)
    expected_updated_at: AwareDatetime

    _blank = field_validator("email", "phone", "business_name", "industry", mode="before")(_blank_to_none)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Email address is invalid")
        return value.lower()

    @model_validator(mode="after")
    def name_cannot_be_cleared(self) -> "AdminCustomerUpdate":
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("Customer name cannot be cleared")
        return self


# Leads ---------------------------------------------------------------------


class AdminLeadUpdate(AdminWrite):
    """Descriptive lead fields; status keeps its dedicated endpoint."""

    source: str | None = Field(default=None, max_length=100)
    intent: str | None = Field(default=None, max_length=1_000)
    estimated_value: Money | None = None
    expected_updated_at: AwareDatetime

    _blank = field_validator("source", "intent", mode="before")(_blank_to_none)


# Projects ------------------------------------------------------------------


class AdminProject(BaseModel):
    id: UUID
    customer_id: UUID
    customer_name: str | None = None
    service_type: str | None = None
    product_category: str | None = None
    product_count: int | None = None
    image_count: int | None = None
    deadline: AwareDatetime | None = None
    status: str
    created_at: AwareDatetime
    updated_at: AwareDatetime


class AdminProjectList(AdminPage):
    items: list[AdminProject]
    statuses: list[str] = Field(default_factory=list)


class AdminProjectDetail(AdminProject):
    customer_email: str | None = None
    customer_phone: str | None = None
    leads: list[AdminRelatedLead] = Field(default_factory=list)


class AdminProjectUpdate(AdminWrite):
    service_type: str | None = Field(default=None, max_length=500)
    product_category: str | None = Field(default=None, max_length=200)
    product_count: Count | None = None
    image_count: Count | None = None
    deadline: AwareDatetime | None = None
    status: str | None = Field(default=None, min_length=1, max_length=100)
    expected_updated_at: AwareDatetime

    _blank = field_validator("service_type", "product_category", mode="before")(_blank_to_none)

    @model_validator(mode="after")
    def status_cannot_be_cleared(self) -> "AdminProjectUpdate":
        if "status" in self.model_fields_set and self.status is None:
            raise ValueError("Project status cannot be cleared")
        return self


# Knowledge -----------------------------------------------------------------


class AdminKnowledgeDocument(BaseModel):
    id: UUID
    title: str
    content: str
    has_embedding: bool
    created_at: AwareDatetime
    updated_at: AwareDatetime


class AdminKnowledgeList(AdminPage):
    items: list[AdminKnowledgeDocument]


class AdminKnowledgeCreate(AdminWrite):
    title: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1, max_length=200_000)


class AdminKnowledgeUpdate(AdminWrite):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    content: str | None = Field(default=None, min_length=1, max_length=200_000)
    expected_updated_at: AwareDatetime

    @model_validator(mode="after")
    def columns_cannot_be_cleared(self) -> "AdminKnowledgeUpdate":
        for column in ("title", "content"):
            if column in self.model_fields_set and getattr(self, column) is None:
                raise ValueError(f"{column} cannot be cleared")
        return self


# Company settings ----------------------------------------------------------


class AdminCompanySettings(BaseModel):
    currency: str
    timezone: str
    tax_rate: Decimal
    business_hours: dict[str, Any]
    settings: dict[str, Any]
    updated_at: AwareDatetime


class AdminCompanySettingsUpdate(AdminWrite):
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    timezone: str | None = Field(default=None, min_length=1, max_length=100)
    tax_rate: Decimal | None = Field(default=None, ge=0, le=100, max_digits=7, decimal_places=4)
    business_hours: dict[str, Any] | None = None
    settings: dict[str, Any] | None = None
    expected_updated_at: AwareDatetime

    @field_validator("timezone")
    @classmethod
    def known_timezone(cls, value: str | None) -> str | None:
        if value is not None and value not in available_timezones():
            raise ValueError("Unknown time zone")
        return value

    @field_validator("business_hours")
    @classmethod
    def valid_business_hours(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        _bounded_json(value, "Business hours")
        for day, hours in value.items():
            if not isinstance(hours, dict):
                raise ValueError(f"Business hours for {day} must be an object")
            if hours.get("closed") is True:
                continue
            if "closed" in hours and not isinstance(hours["closed"], bool):
                raise ValueError(f"Closed flag for {day} must be true or false")
            opens, closes = hours.get("open"), hours.get("close")
            if not (isinstance(opens, str) and isinstance(closes, str)):
                raise ValueError(f"Business hours for {day} need open and close times")
            if not (_TIME.fullmatch(opens) and _TIME.fullmatch(closes)) or opens >= closes:
                raise ValueError(f"Business hours for {day} must use HH:MM with open before close")
        return value

    @field_validator("settings")
    @classmethod
    def valid_settings(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        _bounded_json(value, "Settings")

        def reject_secret_keys(node: object) -> None:
            if isinstance(node, dict):
                for key, child in node.items():
                    if _SECRET_KEY.search(str(key)):
                        raise ValueError("Settings must not contain credentials")
                    reject_secret_keys(child)
            elif isinstance(node, list):
                for child in node:
                    reject_secret_keys(child)

        reject_secret_keys(value)
        booking = value.get("booking")
        if booking is None:
            return value
        if not isinstance(booking, dict):
            raise ValueError("Booking settings must be an object")
        advance = booking.get("minimum_advance_days")
        if advance is not None and (type(advance) is not int or not 0 <= advance <= 365):
            raise ValueError("Minimum advance days must be a whole number from 0 to 365")
        durations = booking.get("slot_duration_minutes")
        if durations is not None:
            if not isinstance(durations, dict):
                raise ValueError("Slot durations must be an object")
            for service, minutes in durations.items():
                if type(minutes) is not int or not 5 <= minutes <= 1440:
                    raise ValueError(f"Slot duration for {service} must be 5 to 1440 minutes")
        return value
