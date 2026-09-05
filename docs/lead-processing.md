# Transcript lead processing

`POST /api/v1/agent/process` accepts a transcript and creates a new customer,
lead, project, and call. It is mounted only in development/testing while tenant
routing and authentication are still pending. There is no Retell or LLM call.

## Setup

Apply the existing SQL migrations and configure the Supabase server credentials
in `backend/.env`. Add the UUID of an existing company:

```dotenv
ENVIRONMENT=development
AGENT_COMPANY_ID=replace-with-an-existing-company-uuid
```

Restart Uvicorn from `backend/` with its virtual environment activated:

```sh
python -m uvicorn app.main:app --reload
```

This request writes real records to the configured database. Use a development
company/project for manual checks:

```sh
curl -i http://127.0.0.1:8000/api/v1/agent/process \
  -H 'Content-Type: application/json' \
  -d '{"transcript":"Name: Jane; Email: jane@example.com; Service type: product photography; Product category: jewelry; Product count: 4; Image count: 12; Deadline: 2026-12-01T12:00:00+06:00; Purpose: online store"}'
```

A completed request returns HTTP 201:

```json
{
  "success": true,
  "customer_id": "generated-customer-uuid",
  "lead_id": "generated-lead-uuid",
  "project_id": "generated-project-uuid",
  "message": "Lead processed successfully"
}
```

## Data flow

1. The API validates a nonblank transcript of at most 100,000 characters. Extra
   fields, including a client-provided company ID, are rejected.
2. The dependency reads `AGENT_COMPANY_ID` from server settings. Missing tenant or
   Supabase configuration returns 503 before any database write.
3. `LeadProcessingService` calls `ConversationService.extract_from_transcript`.
4. The conversation service reads explicitly labeled facts. Supported labels are
   name/customer name, email, phone, business name, industry, service type,
   product category, product count, image count, deadline, and purpose. Separate
   fields with semicolons or newlines; underscore variants also work. Conflicting
   duplicates and malformed counts return 422 before writes.
5. All creation payloads are validated, then repositories create the customer,
   lead, project, and call in that order. The three dependent records use the
   returned customer ID and the same trusted company UUID.
6. The original transcript is stored on the call. The response is sent only once
   all four repositories have confirmed saved IDs.

There is no general natural-language extraction. Free-form prose is saved but
not interpreted. Unknown contact details stay null; an unnamed customer receives
the explicit placeholder `Unidentified customer`. Unknown requirements stay
empty/null. Deadlines are written only when the labeled value is an ISO datetime
with an explicit offset; unresolved text remains in the saved transcript.
Every request creates a new customer; contact deduplication is not implemented.

## Failure semantics

These are four independent Supabase REST writes, **not a database transaction**.
A failure returns 503 with `code=lead_processing_incomplete`, an operation UUID,
the failed stage, confirmed record IDs, and `retry_safe=false`. Subsequent steps
are not executed. Earlier records remain committed, and the failed write may
also have committed before a transport failure. No automatic retry or destructive
cleanup is attempted. Logs contain operation IDs, stages, and record IDs, never
transcripts, contact details, credentials, or provider error bodies.

Before production or webhook delivery, add an idempotency key and an atomic
PostgreSQL workflow RPC (or a durable reconciliation workflow). The endpoint is
intentionally unavailable in staging/production until trusted tenant routing and
request authentication are implemented. A development deployment must remain
local/private; setting the environment to development is not authentication.

## Retell integration later

Retell continues to handle speech and conversation flow. A future webhook adapter
will verify Retell's request, deduplicate its event/call ID, resolve the company
from trusted server-side configuration, and call this same processing service.
It should supply verified extracted facts or use an improved deterministic
extractor; it should not blindly forward unauthenticated traffic to this route.
No webhook or verification code is part of this change.

## Files

- `app/schemas/conversation.py`: conversation inputs, extracted requirements,
  transcript request, and successful response.
- `app/schemas/customer.py`, `lead.py`, `project.py`, `call.py`: reusable creation
  contracts moved out of repository internals without changing their validation.
- `app/schemas/base.py`: common validation and numeric types.
- `app/repositories/schemas.py`: compatibility exports for existing repository users.
- `app/services/conversation_service.py`: deterministic labeled-fact extraction.
- `app/services/lead_processing_service.py`: orchestration and partial-failure reporting.
- `app/api/v1/routes/agent.py`: HTTP adapter, tenant configuration, and error responses.
- `tests/test_lead_processing.py`: full API/service/repository/SDK checks using mock HTTP.

Run the backend suite without making live database writes:

```sh
cd backend
.venv/bin/python -m unittest discover -s tests -v
```
