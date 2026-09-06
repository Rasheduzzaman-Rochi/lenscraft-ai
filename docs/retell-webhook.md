# Retell webhook integration

LensCraft exposes `POST /api/v1/retell/webhook` for Retell voice-call lifecycle
events. The endpoint is available in every environment because production Retell
must reach it, but it remains disabled until both `RETELL_API_KEY` and
`AGENT_COMPANY_ID` are configured.

This foundation makes no outbound Retell request and does not persist webhook
events. It verifies, validates, normalizes, and sends final transcript data to
the existing `AgentService` requirement-extraction path.

## Request flow

1. FastAPI reads the exact raw JSON bytes, capped at 2 MB.
2. `X-Retell-Signature` is verified before JSON parsing using HMAC-SHA256 and the
   configured webhook-enabled Retell API key.
3. The embedded millisecond timestamp must be within
   `RETELL_WEBHOOK_TOLERANCE_SECONDS` (300 seconds by default), limiting replay.
4. `RetellWebhookRequest` validates the event envelope and `CallInformation`.
   Unknown Retell fields are retained so compatible provider additions do not
   break delivery.
5. `RetellService` extracts call ID, event type, transcript, transcript items,
   metadata, and duration. If a flat transcript is absent, utterances are joined.
6. `call_ended` and `call_analyzed` events with transcripts pass deterministically
   extracted requirements into the existing `AgentService`. No LLM is called.
7. Started, transcript-update, transfer, unknown, and transcript-free events are
   acknowledged as `ignored`. This prevents pointless Retell retries for events
   LensCraft does not consume yet.
8. The response contains only the call ID, event, status, configured company, and
   acknowledgement. It never echoes transcript or metadata.

Retell expects a 2xx response within 10 seconds and may retry failures up to three
times. Current processing is side-effect free, so repeated final events do not
create duplicate CRM records. Before this handler saves calls, customers, leads,
or projects, add a durable webhook-event/idempotency table keyed by call ID and
event type plus an atomic database workflow. In-memory deduplication is inadequate
across workers, deployments, and restarts.

## Configuration

Set values in `backend/.env` or the deployment secret environment:

```dotenv
RETELL_API_KEY=your-webhook-enabled-retell-api-key
RETELL_WEBHOOK_TOLERANCE_SECONDS=300
AGENT_COMPANY_ID=existing-company-uuid
```

No credentials are committed. Only an API key marked for webhook verification in
Retell should be used. Configure the Retell agent webhook URL as:

```text
https://api.example.com/api/v1/retell/webhook
```

The current single `AGENT_COMPANY_ID` mapping is suitable for one configured
development/agent tenant. Multi-agent SaaS production must resolve Retell
`agent_id` or phone number through trusted server-side configuration to a company;
metadata supplied in the webhook must never be treated as tenant authorization.

## Payload shape

The route accepts Retell's `{ "event": ..., "call": ... }` envelope. Used call
fields include `call_id`, `agent_id`, `transcript`, `transcript_object`, `metadata`,
timestamps, and optional call analysis. Transcript items require `role` and accept
`content`. Provider-specific additional fields are tolerated.

Security failures return 401, invalid media types return 415, oversized bodies
return 413, malformed signed payloads return 400, normalization failures return
422, and server configuration/processing failures return 503. Logs include call
IDs, event types, status, and exception class only. They do not include raw bodies,
transcripts, metadata, signatures, API keys, or provider error text.

Use TLS in production. Keep the API key only on the backend, rotate it if exposed,
and monitor repeated signature failures. Retell currently also documents an IP
allowlist option, but signature verification remains the primary application-level
control. Ensure proxy/body middleware preserves raw bytes before verification.

## Tool calls later

Retell tools used during a live conversation will call dedicated FastAPI tool
endpoints for actions such as customer lookup, price calculation, availability,
booking, and CRM updates. Those endpoints will validate their own Retell requests,
resolve the tenant from trusted agent configuration, call service interfaces, and
return small tool-specific responses within Retell's timeout. Lifecycle webhooks
remain for call completion, analysis, audit, and asynchronous follow-up; they
should not be overloaded as synchronous tool endpoints.

## Files and validation

- `app/api/v1/routes/retell.py` verifies raw requests and maps HTTP errors.
- `app/services/retell_service.py` normalizes events and calls `AgentService`.
- `app/schemas/retell.py` defines webhook, call, transcript, normalized, and
  acknowledgement models.
- `app/core/security.py` implements timestamped constant-time HMAC validation.
- `tests/test_retell.py` covers signatures, replay, schemas, event processing,
  privacy, production routing, and the existing-agent handoff.

Run all backend tests from `backend/`:

```sh
.venv/bin/python -m unittest discover -s tests -v
```

The signature implementation follows Retell's current official webhook security
specification and uses the raw body rather than re-serialized JSON.
