# LensCraft AI backend

FastAPI foundation for Python 3.12+, with a versioned liveness endpoint,
environment configuration, CORS, JSON logging, Docker support, and a reusable
Supabase client. SQL migrations live in `database/migrations/`. End-user
authentication and ORM models are not implemented. The initial agent
service layer prepares requirements, lead drafts, and quote requests without
external calls; see [service interfaces and examples](app/services/README.md).
The [repository layer](app/repositories/README.md) provides tenant-scoped Supabase
operations for customers, leads, calls, projects, and quotes. The transcript lead
processing endpoint connects the API to these repositories through a workflow service.
The [pricing endpoint](../docs/pricing.md) calculates quotes from the company's
service catalog and stored pricing rules, without saving quote records.
The [knowledge and RAG foundation](../docs/rag.md) stores tenant documents and
supports full-text or pgvector retrieval without selecting an embedding provider.
The [Retell webhook foundation](../docs/retell-webhook.md) authenticates and
normalizes voice-call events before handing final transcripts to agent services.
The [Retell custom tools](../docs/retell-tools.md) expose authenticated service
search, quote, lead, and knowledge operations for live conversations.

## Install and run locally

From the repository root:

```sh
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Use Python 3.12 or newer. On Windows, activate with
`.venv\Scripts\Activate.ps1`. Run commands from `backend/` so Python can import
`app`. Use reload only for development.

Activate the environment again in each new terminal with `source .venv/bin/activate`
from `backend/`. If you see `command not found: pip` or `command not found: uvicorn`,
the virtual environment likely has not been activated. You can also run directly
without activation:

```sh
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload
```

```sh
curl http://localhost:8000/api/v1/health
```

Expected response:

```json
{"status":"healthy","service":"lenscraft-backend"}
```

Swagger UI: `/docs`. ReDoc: `/redoc`. OpenAPI: `/openapi.json`.
Opening `/` redirects to Swagger UI. `/favicon.ico` returns an empty 204 response
until a backend favicon is provided. These browser convenience routes are excluded
from the OpenAPI schema.
API routes are mounted under `/api/v1`. Health reports process liveness only;
it does not validate external services.

## Environment setup

Settings load `backend/.env`, independent of the working directory. Process
environment variables override the file. The root `.env` is not loaded.
Settings are cached per process; restart after configuration changes.

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_NAME` | `lenscraft-backend` | FastAPI application title |
| `ENVIRONMENT` | `development` | `development`, `testing`, `staging`, or `production` |
| `SUPABASE_URL` | Empty | Supabase project HTTP(S) URL |
| `SUPABASE_KEY` | Empty | Server-only Supabase secret or legacy service_role key |
| `SUPABASE_TIMEOUT_SECONDS` | `10` | HTTP timeout per operation, greater than 0 and at most 60 seconds |
| `AGENT_COMPANY_ID` | Empty | Existing company UUID for development/testing transcript processing |
| `RETELL_API_KEY` | Empty | Server-only key for Retell request signature verification |
| `RETELL_WEBHOOK_TOLERANCE_SECONDS` | `300` | Maximum accepted webhook signature age, 30–900 seconds |
| `OPENAI_API_KEY` | Empty | Reserved OpenAI credential |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, or `CRITICAL` |
| `CORS_ORIGINS` | `[]` | JSON array of allowed browser origins |

Supabase fields may remain empty for health-only startup; the database diagnostic
returns 503 until both are populated. Secret fields use Pydantic `SecretStr` to
mask their representations. Never log credentials or complete settings objects.
Environment and log-level values are case-sensitive. Unknown dotenv fields are
ignored. Blank values do not fall back to defaults for required configuration.

The example permits `http://localhost:3000`. Set exact HTTPS frontend origins for
production, e.g. `CORS_ORIGINS=["https://studio.example.com"]`. GET, POST, and the
Content-Type header are allowed; credentialed CORS is disabled. Extend this
policy when additional endpoints are implemented.

Logs go to stdout as JSON lines containing UTC timestamp, level, logger, service,
and message. Startup includes environment; exception records include tracebacks.
Uvicorn loggers use this format after application startup.

## Supabase connection and diagnostic

The official supabase-py library is installed under the PyPI name `supabase` and
is pinned in `requirements.txt`. From `backend/`:

```sh
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Create `.env` from `.env.example` if it does not exist, then set:

```dotenv
ENVIRONMENT=development
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-server-only-secret-or-service-role-key
SUPABASE_TIMEOUT_SECONDS=10
```

Apply the SQL files in `database/migrations/` in filename order to your Supabase
project as the trusted migration owner. This backend does not apply migrations.
The migrations deny anonymous table access, so a publishable/anon key cannot run
this diagnostic. The server key bypasses RLS and counts all companies; keep it
out of the frontend and version control. Future tenant endpoints must enforce
authorization before using this privileged client.

`app/database/supabase.py` reads the validated settings and initializes a shared
client on first use through `get_supabase_client()`. The exported
`supabase_client` instance is initially `None`; import the accessor to obtain it.
A lock prevents duplicate initialization. HTTP connections are reused and closed
at application shutdown. Session persistence and automatic token refresh are
disabled; never sign a user into this shared server client. Restart the process
after changing credentials.

```sh
python -m uvicorn app.main:app --reload
```

From another terminal:

```sh
curl -i http://127.0.0.1:8000/api/v1/test/database
```

Example response (the count reflects your database):

```json
{"database":"connected","companies_count":0}
```

The synchronous endpoint runs in FastAPI's thread pool and requests an exact
count using a HEAD request to `public.companies`; it does not download company
rows or infer counts from the API's row limit. Responses are not cacheable.
Missing credentials, network failures, invalid keys, missing migrations, or denied
permissions return 503 with a sanitized message. A missing count returns 502.
Provider error bodies and credentials are not included in diagnostic logs.

The unauthenticated diagnostic is mounted only in `development` and `testing`.
It returns 404 and is absent from OpenAPI in `staging` and `production` to avoid
exposing tenant totals. `/api/v1/health` remains available in every environment.
Keep the development server bound to localhost.

## Docker

For the transcript workflow, see [lead processing setup](../docs/lead-processing.md).

From the repository root, after creating `backend/.env`:

```sh
docker build -t lenscraft-backend:local backend
docker run --rm --name lenscraft-backend \
  --env-file backend/.env \
  -p 8000:8000 lenscraft-backend:local
```

The image runs Python 3.12 as an unprivileged user, starts one Uvicorn worker,
and probes `/api/v1/health`. Local environment files, virtual environments, and
tests are excluded from the build. Supply production variables through Dokploy
and set `ENVIRONMENT=production`. Build `backend/Dockerfile` with `backend/` as
its build context and route traffic to port 8000. The root Compose file remains
a placeholder.

## Verification

From `backend/`, with the virtual environment activated:

```sh
python -m pip install -r requirements-dev.txt
python -m unittest discover -s tests -v
```

## File guide

| File | Purpose |
| --- | --- |
| `app/main.py` | App factory, lifespan logging, CORS, and versioned router mounting |
| `app/core/config.py` | Validated settings and cached environment loading |
| `app/core/logging.py` | JSON formatter and stdout logging configuration |
| `app/core/security.py` | Timestamped Retell raw-body signature verification |
| `app/api/v1/router.py` | Aggregates version-one endpoint routers |
| `app/api/v1/routes/health.py` | Implements the liveness endpoint |
| `app/api/v1/routes/database.py` | Development-only database count diagnostic and sanitized failures |
| `app/api/v1/routes/agent.py` | Transcript processing endpoint and workflow error mapping |
| `app/api/v1/routes/quotes.py` | Validated quote calculation endpoint |
| `app/api/v1/routes/knowledge.py` | Development knowledge ingestion and search endpoints |
| `app/api/v1/routes/retell.py` | Raw-body authenticated Retell webhook endpoint |
| `app/api/v1/routes/tools.py` | Signed Retell custom-function endpoints and sanitized HTTP errors |
| `app/services/__init__.py` | Marks the independent business service package |
| `app/services/agent_service.py` | Coordinates explicitly requested service actions |
| `app/services/conversation_service.py` | Normalizes supplied customer requirements |
| `app/services/lead_service.py` | Prepares unsaved leads and validated partial updates |
| `app/services/quote_service.py` | Prepares quotes with an injectable pricing interface |
| `app/services/pricing_engine.py` | Pure fixed/per-image and add-on calculations |
| `app/services/knowledge_service.py` | Knowledge storage, retrieval, and bounded context orchestration |
| `app/services/embedding_service.py` | Provider-neutral async embedding interface and validation |
| `app/services/retell_service.py` | Retell event normalization and agent-service handoff |
| `app/services/tool_service.py` | Tenant-bound orchestration for Retell tool operations |
| `app/services/lead_processing_service.py` | Coordinates customer, lead, project, and call persistence |
| `app/services/README.md` | Service usage, contracts, and future integration flow |
| `app/repositories/` | Async persistence adapters, validated inputs, and storage errors |
| `app/repositories/knowledge_repository.py` | Tenant-scoped knowledge table and search RPC operations |
| `app/repositories/README.md` | Repository interfaces, tenant contracts, and usage |
| `app/database/__init__.py` | Marks the database connectivity package |
| `app/database/supabase.py` | Reusable Supabase client, HTTP timeout, and connection cleanup |
| `app/schemas/tools.py` | Strict Retell tool request and bounded response contracts |
| `database/migrations/*.sql` | Tenant schema, indexes, search functions, idempotency, triggers, and policies |
| `app/models/__init__.py` | Reserves the model package without defining models |
| `app/schemas/` | Shared Pydantic conversation, customer, lead, project, and call contracts |
| `app/utils/__init__.py` | Reserves the shared utilities package |
| Other `__init__.py` files | Mark `app`, `core`, `api`, `api/v1`, and `routes` as Python packages |
| `.env.example` | Documents configuration without credentials |
| `.dockerignore` | Limits image build inputs to runtime files |
| `Dockerfile` | Container build, non-root runtime, and health check |
| `requirements.txt` | Pinned runtime dependencies including transitive dependencies |
| `requirements-dev.txt` | Adds the HTTP test client to runtime dependencies |
| `tests/test_foundation.py` | Verifies health, routing, CORS, settings, and JSON logs |
| `tests/test_database.py` | Tests actual SDK requests with mock HTTP responses, client reuse, errors, and environment gating |
| `tests/test_services.py` | Verifies dispatch, draft updates, tenant checks, and deferred pricing |
| `tests/test_repositories.py` | Verifies real SDK request shapes, tenant filters, validation, and errors with mock HTTP |
| `tests/test_lead_processing.py` | Exercises the full HTTP workflow, linking, failures, validation, and environment guards |
| `tests/test_pricing.py` | Tests stored-rule calculations, configuration failures, and tenant filters |
| `tests/test_knowledge.py` | Tests ingestion, semantic/full-text retrieval, provider contracts, and isolation |
| `tests/test_retell.py` | Tests webhook signatures, replay protection, normalization, and privacy |
| `README.md` | Installation, configuration, execution, and file reference |
