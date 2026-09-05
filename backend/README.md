# LensCraft AI backend

FastAPI foundation for Python 3.12+, with a versioned liveness endpoint,
environment configuration, CORS, JSON logging, and Docker support.
Database models, integration clients, authentication, and business logic are not
implemented.

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
| `SUPABASE_URL` | Empty | Reserved Supabase URL |
| `SUPABASE_KEY` | Empty | Reserved server-side Supabase key |
| `RETELL_API_KEY` | Empty | Reserved Retell credential |
| `OPENAI_API_KEY` | Empty | Reserved OpenAI credential |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, or `CRITICAL` |
| `CORS_ORIGINS` | `[]` | JSON array of allowed browser origins |

Integration fields may remain empty. Secret fields use Pydantic `SecretStr` to
mask their representations. Never log credentials or complete settings objects.
Environment and log-level values are case-sensitive. Unknown dotenv fields are
ignored. Blank values do not fall back to defaults for required configuration.

The example permits `http://localhost:3000`. Set exact HTTPS frontend origins for
production, e.g. `CORS_ORIGINS=["https://studio.example.com"]`. Only GET and the
Content-Type header are allowed; credentialed CORS is disabled. Extend this
policy when additional endpoints are implemented.

Logs go to stdout as JSON lines containing UTC timestamp, level, logger, service,
and message. Startup includes environment; exception records include tracebacks.
Uvicorn loggers use this format after application startup.

## Docker

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
| `app/core/security.py` | Placeholder for future security utilities |
| `app/api/v1/router.py` | Aggregates version-one endpoint routers |
| `app/api/v1/routes/health.py` | Implements the liveness endpoint |
| `app/services/__init__.py` | Reserves the services package |
| `app/database/__init__.py` | Reserves the database connectivity package |
| `app/models/__init__.py` | Reserves the model package without defining models |
| `app/schemas/__init__.py` | Reserves the API schema package |
| `app/utils/__init__.py` | Reserves the shared utilities package |
| Other `__init__.py` files | Mark `app`, `core`, `api`, `api/v1`, and `routes` as Python packages |
| `.env.example` | Documents configuration without credentials |
| `.dockerignore` | Limits image build inputs to runtime files |
| `Dockerfile` | Container build, non-root runtime, and health check |
| `requirements.txt` | Pinned runtime dependencies including transitive dependencies |
| `requirements-dev.txt` | Adds the HTTP test client to runtime dependencies |
| `tests/test_foundation.py` | Verifies health, routing, CORS, settings, and JSON logs |
| `README.md` | Installation, configuration, execution, and file reference |
