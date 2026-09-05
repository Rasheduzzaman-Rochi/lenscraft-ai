"""Pure deterministic pricing arithmetic, independent of repositories and APIs."""

from decimal import Decimal
from pydantic import ValidationError

from app.schemas.quote import AddonCondition, PricingRule, QuoteCalculateRequest, QuoteCalculation


class PricingConfigurationError(ValueError):
    """Stored pricing is missing, conflicting, unsupported, or invalid."""


class UnknownAddonError(ValueError):
    """The request selects an add-on absent from this service's catalog."""


def calculate_price(
    request: QuoteCalculateRequest, *, service_name: str, pricing_type: str, rules: list[PricingRule],
) -> QuoteCalculation:
    """Apply exactly one base rule and selected add-ons without default prices.

    fixed uses a base rule; per_image uses a per_image rule times image_count.
    Base rule conditions must be empty. Add-ons require code and pricing_type.
    Validate the entire configuration, including unselected add-ons, before use.
    """
    expected = {'fixed': 'base', 'per_image': 'per_image'}.get(pricing_type)
    if expected is None:
        raise PricingConfigurationError('Unsupported service pricing type')
    base_rules = []
    addon_rules: dict[str, tuple[PricingRule, AddonCondition]] = {}
    for rule in rules:
        if rule.rule_type == 'addon':
            try:
                condition = AddonCondition.model_validate(rule.condition)
            except ValidationError:
                raise PricingConfigurationError('Invalid add-on configuration') from None
            if condition.code in addon_rules:
                raise PricingConfigurationError('Duplicate add-on configuration')
            addon_rules[condition.code] = (rule, condition)
        else:
            if rule.rule_type != expected or rule.condition:
                raise PricingConfigurationError('Base rule does not match the service pricing type')
            base_rules.append(rule)
    if len(base_rules) != 1:
        raise PricingConfigurationError('Exactly one matching base rule is required')
    if any(code not in addon_rules for code in request.addons):
        raise UnknownAddonError('One or more add-ons are unavailable for this service')
    base = base_rules[0].value * (request.image_count if pricing_type == 'per_image' else 1)
    addons = Decimal(0)
    for code in request.addons:
        rule, condition = addon_rules[code]
        addons += rule.value * (request.image_count if condition.pricing_type == 'per_image' else 1)
    try:
        return QuoteCalculation(service=service_name, base_price=base, addons=addons, total_price=base + addons)
    except ValidationError:
        raise PricingConfigurationError('Calculated amount exceeds supported monetary precision') from None
