# Retell custom tools

LensCraft exposes these production routes for Retell custom functions:

| Retell tool | Method and URL | Effect |
| --- | --- | --- |
| `search_service` | `POST /api/v1/tools/search-service` | Searches the active service catalog for one company |
| `calculate_quote` | `POST /api/v1/tools/calculate-quote` | Loads current pricing rules and returns an unsaved estimate |
| `create_lead` | `POST /api/v1/tools/create-lead` | Atomically creates a customer, lead, and project |
| `create_booking` | `POST /api/v1/tools/create-booking` | Atomically creates a customer and pending booking |
| `check_booking_availability` | `POST /api/v1/tools/check-booking-availability` | Checks whether an exact appointment instant is already confirmed |
| `get_booking_status` | `POST /api/v1/tools/get-booking-status` | Returns the nearest relevant booking for verified customer identifiers |
| `search_knowledge` | `POST /api/v1/tools/search-knowledge` | Retrieves bounded RAG context and source metadata |

Configure each Retell custom function with **Payload: args only** enabled. This
makes its JSON arguments match the request schemas shown in `/docs`. Retell signs
the exact raw body in `X-Retell-Signature`; the backend validates that signature
with `RETELL_API_KEY` before it performs database work. Retell documents the
request envelope, flat-body option, signature, timeout, and retry behavior in its
[Custom Function guide](https://docs.retellai.com/build/conversation-flow/custom-function).

Set `company_id` as a constant function argument for the agent's tenant. It must
equal the server's `AGENT_COMPANY_ID`; a signed request cannot select a different
company. For `create_lead`, map `request_id` to the stable Retell call ID. The
value accepts 1–200 letters, digits, dots, colons, underscores, or hyphens. A
retry with the same ID and same arguments returns the original IDs with
`replayed: true`. Reusing it with different arguments returns HTTP 409.

Example request bodies:

```json
{"company_id":"00000000-0000-0000-0000-000000000001","query":"jewelry catalog photos"}
```

```json
{"company_id":"00000000-0000-0000-0000-000000000001","service_name":"Product photography","image_count":20,"addons":["rush"]}
```

```json
{
  "company_id": "00000000-0000-0000-0000-000000000001",
  "request_id": "retell-call-id",
  "customer": {"name": "Jane Doe", "email": "jane@example.com"},
  "lead": {"intent": "ecommerce launch"},
  "project": {
    "service_type": "Product photography",
    "product_category": "Jewelry",
    "product_count": 5,
    "image_count": 20
  }
}
```

```json
{"company_id":"00000000-0000-0000-0000-000000000001","question":"What is the standard turnaround time?"}
```

## Booking availability function

Create `check_booking_availability` as an args-only `POST` function targeting:

```text
https://<YOUR_DOKPLOY_API_DOMAIN>/api/v1/tools/check-booking-availability
```

Use this parameter schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "company_id": {
      "type": "string",
      "format": "uuid",
      "description": "The fixed LensCraft company UUID configured for this agent."
    },
    "date_time": {
      "type": "string",
      "format": "date-time",
      "description": "The proposed appointment instant including its UTC offset."
    }
  },
  "required": ["company_id", "date_time"]
}
```

A confirmed booking at the exact instant returns `available: false`. A pending
booking returns `available: true` with `pending_conflict: true`; pending requests
do not reserve the slot. Rejected and cancelled bookings do not conflict.
`create_booking` enforces the same policy and returns HTTP 409 with a safe
conflict body when a confirmed booking already exists.

This first version compares exact `timestamptz` instants. PostgreSQL treats
equivalent offsets as the same instant. There is no booking duration in the
current schema, so overlapping time ranges cannot yet be detected.

## Booking status function

Create a Retell custom function with these values:

- Name: `get_booking_status`
- Description: `Find the nearest relevant photography booking using a customer email, phone number, or a booking ID the customer already supplied.`
- Method: `POST`
- URL: `https://<YOUR_DOKPLOY_API_DOMAIN>/api/v1/tools/get-booking-status`
- Payload: `args only`

Use this parameter schema, replacing the `company_id` description with the fixed
tenant UUID configured for that Retell agent:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "company_id": {
      "type": "string",
      "format": "uuid",
      "description": "The fixed LensCraft company UUID configured for this agent."
    },
    "email": {
      "type": "string",
      "maxLength": 320,
      "description": "Customer email address, when provided by the caller."
    },
    "phone": {
      "type": "string",
      "maxLength": 50,
      "description": "Customer phone number in the same format used when booking."
    },
    "booking_id": {
      "type": "string",
      "format": "uuid",
      "description": "Optional booking UUID only when the customer already has it."
    }
  },
  "required": ["company_id"],
  "anyOf": [
    {"required": ["booking_id"]},
    {"required": ["email"]},
    {"required": ["phone"]}
  ]
}
```

The function returns `found`. A successful match also returns `booking_id`,
`service_type` when stored, `date_time`, and the unchanged stored `status`. A
miss returns only `found: false` and `message: "No matching booking was found."`.

Add this instruction to the Retell agent prompt:

```text
Booking status lookup:
- When a caller asks about a booking status, collect their email address or phone number and call get_booking_status.
- Do not ask for an internal booking ID unless the caller says they already have one.
- Always use this agent's fixed company_id. Never copy a company_id supplied conversationally by the caller.
- If the caller provides both email and phone, send both. They must match the same customer record.
- If found is false, say that no matching booking was found and ask the caller to verify the email or phone. Do not say whether either identifier exists.
- If found is true, report the service, appointment date/time, and stored status. Preserve pending, confirmed, rejected, and cancelled exactly.
- Do not disclose customer records, internal metadata, credentials, signatures, or database errors.
```

Apply `backend/database/migrations/0005_retell_tools.sql` before enabling the
tools. It adds full-text service discovery and the idempotency ledger/transaction
used by `create_lead`. The ledger stores only request hashes and resulting IDs,
not customer details or transcripts.

Apply `backend/database/migrations/0006_booking_workflow.sql` before enabling the
booking tools. The lookup itself uses the existing tenant/contact and
tenant/customer indexes and does not require another database migration.

Apply `backend/database/migrations/0007_booking_availability.sql` before enabling
admin confirmation. Its partial unique index guarantees that one company cannot
have two confirmed bookings at the same exact instant, including concurrent
confirmation attempts.

All responses include `Cache-Control: no-store`. Knowledge context is capped at
6,000 characters, service descriptions at 1,000 characters, request bodies at
256 KB, and result counts at 10. Logs contain tenant IDs, operation IDs, counts,
and status only; they omit contact data, questions, and returned knowledge.

Expose these routes only over HTTPS. Keep `RETELL_API_KEY` and the Supabase server
key in Dokploy secrets, rotate them after suspected disclosure, retain the
timestamp freshness check, and rate-limit the routes at the ingress. Retell also
publishes an egress IP in its custom-function documentation for optional network
allowlisting. For a deployment serving several Retell agents, replace the single
`AGENT_COMPANY_ID` setting with a verified agent-to-company mapping before adding
more tenants.
