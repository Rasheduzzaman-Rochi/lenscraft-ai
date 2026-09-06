# LensCraft AI

AI Voice Agent platform for photography businesses.

## Repository structure

```text
.
├── frontend/
│   └── README.md
├── backend/
│   ├── app/
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── README.md
├── docs/
│   └── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

- **frontend/** — Next.js, TypeScript, and Tailwind CSS web application.
- **backend/** — FastAPI and Python API, integrations, and server-side workflows.
- **docs/** — Architecture decisions, setup instructions, and operational documentation.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python |
| Database | Supabase PostgreSQL |
| Deployment | Docker, Dokploy |

## Initial setup

Follow [backend setup](backend/README.md) to install and run the FastAPI service.
Copy `backend/.env.example` to `backend/.env` for backend configuration.
Never commit populated environment files. Configure production secrets through
the deployment environment.

The root `.env.example` documents Docker Compose interpolation values. The
backend does not read the root `.env` directly; Compose injects the mapped
values. Only explicitly public values may use `NEXT_PUBLIC_`.

## Project status

The backend foundation includes `/api/v1/health`, environment settings, CORS,
JSON logging, Supabase connectivity, tests, and a production Docker image. The
root `docker-compose.yml` defines the backend service for Dokploy; see the
[deployment guide](docs/deployment.md) for local and production instructions.
The frontend remains a skeleton.
SQL migrations are available in `backend/database/migrations/`; applying them
to Supabase is a separate step. The database diagnostic is available only in
development and testing.

Further production work includes end-user authentication, integration tests,
monitoring, and backup procedures.
