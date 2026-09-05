# Agent service layer

This layer accepts structured commands and prepares in-memory results. It has no
FastAPI route, Retell, LLM, or database dependencies. It uses the existing Pydantic
installation for validation and Python Decimal for monetary values.

| Module | Responsibility |
| --- | --- |
| `agent_service.py` | Validate explicit actions and coordinate conversation, lead, and quote services. |
| `conversation_service.py` | Accept transcripts, customer messages, and extracted facts; return normalized requirements. Raw text extraction is intentionally a placeholder. |
| `lead_service.py` | Create unsaved lead drafts, validate partial updates, and produce SQL-column-compatible payloads. |
| `quote_service.py` | Prepare quote requests and delegate to the `PricingCalculator` protocol when supplied. |

## Example

Run Python from `backend/` with the virtual environment activated:

```python
from uuid import uuid4
from app.services.agent_service import AgentRequest, AgentService
from app.services.conversation_service import ConversationInput

request = AgentRequest(
    company_id=uuid4(),  # Example only; integrations must use verified tenant context.
    action="request_quote",
    conversation=ConversationInput(
        extracted_information={
            "service_type": "product photography",
            "product_category": "jewelry",
            "product_count": 5,
            "image_count": 15,
            "purpose": "online store",
        }
    ),
)
result = AgentService().handle_conversation(request)
print(result.model_dump(mode="json"))
# result.quote.status == "awaiting_pricing"
# result.quote.calculation is None
```

Supported actions are `extract_requirements`, `create_lead`, `update_lead`, and
`request_quote`. Creation requires `lead_data=LeadData(...)`; updates require
`existing_lead` and `lead_patch=LeadPatch(...)`. Pass customer identity through
`LeadData` for lead creation; top-level customer/project/service IDs apply to
quote requests. Each command executes one action, with requirements normalization
shared by every action.

## Future integration flow

Retell continues to handle voice, recognition, and conversation flow. A future
FastAPI adapter will verify the Retell request, resolve the company from trusted
configuration, validate and map the payload into `AgentRequest`, and invoke
`AgentService`. The adapter must not trust a customer-supplied company UUID.
The returned requirements and draft data can then be passed to authorized CRM
repositories. No webhook route or verification is implemented here.

A future repository will load existing leads within a company, verify related
customer ownership, and persist `LeadService.prepare_lead_data(...)`. Lead
requirements are returned separately; they are not nonexistent columns in the
SQL leads table. Lead drafts have UUIDs but are not saved records. Partial updates
preserve omitted fields and allow explicit nulls for nullable columns. Tenant and
lead IDs cannot be patched. Retell event deduplication must be implemented before
persisting repeated webhook deliveries; draft creation is not idempotent.

A future `PricingCalculator.calculate(QuoteRequest)` implementation will obtain
the selected company's active service and `pricing_rules`, validate required
inputs and related IDs, and calculate a `PriceCalculation`. Until then there is
no currency default, pricing formula, zero-price fallback, or saved quote. The
pending quote status is an orchestration state, not a SQL quote status. Pricing
errors propagate to the caller for a future API adapter to translate.

Blank strings and null counts indicate unknown requirements; zero is preserved
when explicitly supplied. Counts reject negative numbers, booleans, and numeric
strings. Deadlines remain normalized text and need timezone-aware interpretation
before a future project write. No service attempts to interpret transcripts or
customer messages yet.

## Verification

```sh
python -m unittest discover -s tests -v
```
