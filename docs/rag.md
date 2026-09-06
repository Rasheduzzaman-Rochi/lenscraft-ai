# Knowledge base and RAG foundation

LensCraft stores reusable business knowledge in `knowledge_documents` and
retrieves a small, tenant-scoped set for each future agent turn. The current API
does not call Retell, an LLM, or an external embedding provider.

## Setup

Apply migration `0004_knowledge_search_functions.sql` after the first three
migrations. It adds:

- a full-text GIN index;
- a model identifier for embeddings;
- a tenant-scoped PostgreSQL full-text search function;
- a tenant- and model-scoped pgvector cosine search function.

Configure `SUPABASE_URL`, the server-only `SUPABASE_KEY`, and an existing
`AGENT_COMPANY_ID` in `backend/.env`. The unauthenticated knowledge routes are
available only when `ENVIRONMENT` is `development` or `testing`. Keep such a
deployment private. Production routes require authenticated tenant resolution
in a later change.

## Add a document

Documents may be stored without an embedding while no provider is configured:

```sh
curl http://127.0.0.1:8000/api/v1/knowledge \
  -H 'Content-Type: application/json' \
  -d '{
    "company_id":"YOUR_COMPANY_UUID",
    "title":"Booking policy",
    "content":"A 30 percent deposit confirms a booking."
  }'
```

An already generated vector can be supplied by a trusted integration. Its model
identifier is mandatory so vectors from incompatible embedding spaces are never
compared:

```json
{
  "company_id": "YOUR_COMPANY_UUID",
  "title": "Booking policy",
  "content": "A 30 percent deposit confirms a booking.",
  "embedding": [0.12, -0.03, 0.88],
  "embedding_model": "provider/model-version"
}
```

Vectors accept 1–16,000 finite numeric values. A database constraint requires
new embeddings and model identifiers together. The constraint is initially
`NOT VALID` so a database with legacy vectors can migrate; backfill their model
identifier and validate the constraint before semantic production use.

## Search and context

Without a query embedding, search uses PostgreSQL full-text retrieval:

```sh
curl http://127.0.0.1:8000/api/v1/knowledge/search \
  -H 'Content-Type: application/json' \
  -d '{
    "company_id":"YOUR_COMPANY_UUID",
    "query":"booking deposit",
    "limit":5
  }'
```

Supplying `query_embedding` and the same `embedding_model` selects semantic
cosine retrieval. `similarity_threshold` defaults to `0.70`. Search returns the
matched documents, retrieval mode, and source-labelled context bounded to
12,000 characters by default. Individual retrieved content is capped at 50,000
characters, and search returns at most 20 rows.

The RAG flow is:

1. A verified caller resolves the company.
2. The query is embedded when a provider exists, or supplied by a trusted
   integration. Until then, full-text search works without embeddings.
3. `KnowledgeRepository` invokes a company-scoped database search function.
4. `KnowledgeService` validates results and builds bounded, source-labelled
   context.
5. A future agent adapter supplies that context to the model alongside the
   current conversation and system instructions.

`EmbeddingProvider` is an async protocol with `model_name`, `dimensions`, and
`embed(text)`. `EmbeddingService` validates model metadata, dimensions, and
finite output. Adding OpenAI, a local model, or another provider later requires
an adapter and dependency wiring, without changing knowledge or repository
logic. No provider is selected in this foundation.

## Retell integration later

Retell will continue handling audio, speech recognition, and conversation flow.
A verified webhook or tool endpoint will resolve the tenant, pass the caller's
question to `KnowledgeService`, and give the returned context to the AI response
layer. Retell payload verification, event idempotency, and LLM response generation
are intentionally absent here.

Knowledge should remain in the database rather than being copied into permanent
prompts. Database content can be updated without redeploying agents, searched by
relevance, isolated per company, audited, and eventually versioned. Permanent
prompts grow costly and stale, have practical context limits, and make tenant
separation difficult. Retrieved documents are still untrusted data: a future
prompt builder must delimit them and instruct the model to treat their text as
reference material rather than executable instructions.

The shared server key bypasses RLS, so repository and RPC company filters are
both enforced. Anonymous/authenticated Supabase roles cannot execute these RPCs.
Semantic search additionally filters `embedding_model` and vector dimensions.
An approximate vector index is still deferred until one production embedding
model and dimension are selected; current vector retrieval is exact.

## Files

- `app/schemas/knowledge.py` defines ingestion, search, document, and context models.
- `app/services/embedding_service.py` defines the abstract provider interface.
- `app/services/knowledge_service.py` coordinates storage, retrieval, and context.
- `app/repositories/knowledge_repository.py` isolates Supabase table/RPC queries.
- `app/api/v1/routes/knowledge.py` maps development HTTP requests and errors.
- `database/migrations/0004_knowledge_search_functions.sql` adds search support.
- `tests/test_knowledge.py` validates both retrieval modes with mock HTTP.

Run the complete backend suite from `backend/`:

```sh
.venv/bin/python -m unittest discover -s tests -v
```
