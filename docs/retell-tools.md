# Retell custom tools

LensCraft exposes four production routes for Retell custom functions:

| Retell tool | Method and URL | Effect |
| --- | --- | --- |
| `search_service` | `POST /api/v1/tools/search-service` | Searches the active service catalog for one company |
| `calculate_quote` | `POST /api/v1/tools/calculate-quote` | Loads current pricing rules and returns an unsaved estimate |
| `create_lead` | `POST /api/v1/tools/create-lead` | Atomically creates a customer, lead, and project |
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

Apply `backend/database/migrations/0005_retell_tools.sql` before enabling the
tools. It adds full-text service discovery and the idempotency ledger/transaction
used by `create_lead`. The ledger stores only request hashes and resulting IDs,
not customer details or transcripts.

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

