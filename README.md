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

The root `.env.example` is a future platform configuration reference and is not
loaded by the backend. Only explicitly public values may use `NEXT_PUBLIC_`.

## Project status

The backend foundation includes `/api/v1/health`, environment settings, CORS,
JSON logging, tests, and a Dockerfile. Frontend and shared documentation remain
skeletons. `docker-compose.yml` is an empty Compose placeholder; use the backend
README for standalone Docker commands. Supabase integration is not implemented.

Further production work includes authentication, database access controls,
migrations, integration tests, monitoring, backup procedures, and platform-level
Dokploy configuration.
