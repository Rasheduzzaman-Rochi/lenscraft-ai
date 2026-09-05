# Pricing and quote calculation

`POST /api/v1/quotes/calculate` calculates an unsaved subtotal. All rates come
from `pricing_rules`, selected through the company's active `services` record.
No prices are seeded or hardcoded by this implementation.

## Request

Configure Supabase and `AGENT_COMPANY_ID` in `backend/.env`. This unauthenticated
endpoint is available only in development/testing, and the requested company
must equal the configured company. Restart the backend after changing settings.

```sh
curl http://127.0.0.1:8000/api/v1/quotes/calculate \
  -H 'Content-Type: application/json' \
  -d '{"company_id":"YOUR_COMPANY_UUID","service_name":"Product photography","image_count":10,"addons":["retouch"]}'
```

`service_name` is an exact, case-sensitive name after whitespace trimming. It
must identify exactly one service in the company; inactive or missing services
return 404. Duplicate names return 409 rather than choosing an arbitrary row.

`image_count` must be an integer from 0 through 2147483647; strings, booleans,
negative numbers, and fractional counts are rejected. `addons` is a list of
unique, nonblank case-sensitive codes (at most 100). The caller cannot supply
prices, tax, currency, discount, or pricing conditions.

The response contains `service`, `base_price`, `addons`, and `total_price` as
requested. Amounts use the company's currency. `addons` is the sum of selected
add-on amounts. The total is **before tax and discounts**. There is no currency
conversion, quote persistence, payment processing, or Retell integration.

## Database rule contract

Maintain the existing tables in Supabase:

| services.pricing_type | Required rule_type | Base calculation |
| --- | --- | --- |
| `fixed` | Exactly one `base` | Rule `value` |
| `per_image` | Exactly one `per_image` | Rule `value` × requested image count |

Each base rule must have `condition = {}`. There must be exactly one matching
base rule; multiple base rules, a mismatched base type, or an unsupported service
pricing type are configuration errors. Rates must be finite nonnegative numbers
with at most four fractional digits, fitting `numeric(18,4)`.

Additional rules may have `rule_type = 'addon'` with this JSONB condition:

```json
{"code":"retouch","pricing_type":"per_image"}
```

Alternatively use `pricing_type = 'fixed'` for a flat add-on amount. Store the
actual price in that rule's `value`, not in the condition or request. Each code
must occur once per service. Unknown condition keys, unsupported rule types,
negative values, and malformed rules are rejected even for unselected add-ons.
An unknown requested add-on returns 422. No add-ons selected means a zero add-on
sum, not a fallback base price. Zero images results in a zero per-image charge;
fixed charges still apply. If zero-image requests should be disallowed for a
specific service, introduce an explicitly supported minimum-count rule later.

Arithmetic uses Decimal, preserving database precision with no implicit rounding.
Totals exceeding the supported monetary range are rejected. JSON amounts are
numbers; consumers should use decimal-aware handling for monetary values.

## Flow and ownership

1. The route validates input and checks the configured development company.
2. `QuoteService.calculate_quote` asks `ServiceRepository` for the service.
3. `PricingRepository` retrieves the rules with a company-filtered inner join
   through `services`. Rules from another company cannot be selected.
4. Stored rules are validated against their service ID and supported formats.
5. The pure `pricing_engine.calculate_price` function applies the base and the
   requested add-ons. It has no database dependencies.
6. A Pydantic `QuoteCalculation` is returned without creating a quote row.

Rules are read on every calculation, so changing `pricing_rules.value`, adding
supported add-ons, or editing supported conditions takes effect on the next
request without deployment. Apply related pricing edits in one database
transaction. New pricing formulas (tiers, tax, discounts, minimum charges) need
explicit engine support; unknown configuration is never silently ignored.

Each company owns its service catalog. The same service name in different
companies may have entirely different pricing. The server key bypasses RLS, so
repository filters remain necessary. Production access will require verified
user/company authorization; caller-supplied company IDs alone are not authorization.

The service and rules are separate reads, not a snapshot transaction. This is an
estimate endpoint. Before binding or persisting an accepted quote, add an atomic
pricing/version snapshot workflow to protect against concurrent configuration
changes. The existing synchronous `handle_quote_request` draft interface is
preserved for existing agent callers; the new endpoint uses async `calculate_quote`.

## Limits and errors

Active service listings are paginated. Rule retrieval requires an exact count and
rejects a truncated response or more than 1,000 rules per service rather than
underpricing from a partial result. Other responses:

- 403: company differs from server configuration.
- 404: service missing/inactive, or endpoint unavailable in staging/production.
- 409: missing, ambiguous, malformed, or unsupported stored pricing.
- 422: invalid input or unknown add-on.
- 503: company configuration absent, storage failure, or incomplete rule retrieval.

Provider messages and credentials are not returned to callers. Successful
responses have `Cache-Control: no-store`.

## Files and verification

- `app/repositories/service_repository.py`: service lookup and paginated active catalog.
- `app/repositories/pricing_repository.py`: tenant-scoped complete rule retrieval.
- `app/schemas/quote.py`: request, rule, condition, and calculation models.
- `app/services/pricing_engine.py`: pure arithmetic and configuration checks.
- `app/services/quote_service.py`: service/rule lookup and calculation orchestration.
- `app/api/v1/routes/quotes.py`: HTTP adapter and sanitized error mapping.
- `tests/test_pricing.py`: arithmetic and full API/SDK tests with mock HTTP.

```sh
cd backend
.venv/bin/python -m unittest discover -s tests -v
```
