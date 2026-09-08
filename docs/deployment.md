# Backend deployment

The LensCraft backend is packaged as a stateless Python 3.12 container. Supabase
remains external, and the application does not apply database migrations during
startup.

## Production container

`backend/Dockerfile` installs the pinned runtime dependencies before copying the
application so dependency layers remain cacheable. The final process runs as UID
and GID `10001`, starts one Uvicorn worker without reload mode, listens on port
`8000`, accepts proxy headers from the container network, and allows 30 seconds
for graceful shutdown. The image includes a liveness check against
`/api/v1/health`.

The Compose service adds a read-only root filesystem, a restricted temporary
directory, dropped Linux capabilities, `no-new-privileges`, log rotation, restart
handling, and the same health check. Port `8000` is exposed only to the container
network. Dokploy's Traefik proxy should be the public entry point.

## Environment

Never copy a populated `.env` file into the image. Use `backend/.env` only for
local runs and configure production values in Dokploy.

| Variable | Production requirement |
| --- | --- |
| `SUPABASE_URL` | Required Supabase project HTTPS URL |
| `SUPABASE_KEY` | Required server-only secret or legacy `service_role` key |
| `AGENT_COMPANY_ID` | Required company UUID authorized for this agent deployment |
| `ADMIN_API_KEY` | Required server-only key for Next.js-to-FastAPI admin requests; use the same value in both services |
| `RETELL_API_KEY` | Required server-only key used to verify Retell signatures |
| `ENVIRONMENT` | Set to `production`; Compose defaults to it |
| `CORS_ORIGINS` | JSON array of exact HTTPS frontend origins, or `[]` when unused by browsers |
| `APP_NAME` | Optional; defaults to `lenscraft-backend` |
| `LOG_LEVEL` | Optional; defaults to `INFO` |
| `SUPABASE_TIMEOUT_SECONDS` | Optional; defaults to `10` |
| `RETELL_WEBHOOK_TOLERANCE_SECONDS` | Optional; defaults to `300` |
| `OPENAI_API_KEY` | Reserved and may remain empty until an OpenAI integration exists |
| `IMAGE_TAG` | Optional Compose image tag; defaults to `latest` |

`SUPABASE_KEY`, `ADMIN_API_KEY`, `RETELL_API_KEY`, and future provider credentials are secrets.
Store them as Dokploy service variables or through a supported secrets provider.
Do not use Docker build arguments for runtime credentials.

## Build and run locally

Create local configuration and set the required values:

```sh
cp backend/.env.example backend/.env
```

Set `ENVIRONMENT=production` in that file when testing the production route set.
Apply the existing SQL migrations to the target Supabase project separately and
in filename order.

Build from the repository root:

```sh
docker build --pull --tag lenscraft-backend:local backend
```

Run with the same filesystem and privilege restrictions used by Compose:

```sh
docker run --rm --name lenscraft-backend --init \
  --env-file backend/.env \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --security-opt no-new-privileges=true \
  --cap-drop ALL \
  --publish 127.0.0.1:8000:8000 \
  lenscraft-backend:local
```

Verify the process from another terminal:

```sh
curl --fail http://127.0.0.1:8000/api/v1/health
docker inspect --format '{{.State.Health.Status}}' lenscraft-backend
```

The expected HTTP body is:

```json
{"status":"healthy","service":"lenscraft-backend"}
```

The health route reports process liveness. It deliberately does not contact
Supabase or Retell, so provider outages do not continuously restart a healthy API
process.

## Deploy with Dokploy

1. Create a **Docker Compose** service in Dokploy and connect the Git repository.
2. Set the Compose path to `./docker-compose.yml`. Use Docker Compose mode because
   the file builds the backend image; Docker Stack mode does not support `build`.
3. Add the required environment variables in Dokploy's Environment panel. The
   Compose file explicitly maps those values into the backend container.
4. Enable an isolated deployment network when available.
5. In the Domains tab, select service `backend`, container port `8000`, and the
   API hostname. Enable HTTPS and leave path stripping disabled for a dedicated
   API hostname.
6. Deploy and wait for the service health check to become healthy. Confirm
   `https://your-api-host/api/v1/health`, then test a signed Retell request.

Dokploy adds its Traefik routing labels when a domain is configured. The Compose
file therefore contains no host port publication and no hand-written Traefik
labels. Dokploy also writes UI variables beside the Compose file, but those values
only reach a container when Compose maps them; the `environment` section performs
that mapping explicitly. See Dokploy's [Docker Compose environment guide](https://docs.dokploy.com/docs/core/docker-compose)
and [Compose domain guide](https://docs.dokploy.com/docs/core/docker-compose/domains).

The Next.js admin bridge and FastAPI backend must receive the same non-empty
`ADMIN_API_KEY`. The key belongs in each service's runtime environment and must
not be exposed through a `NEXT_PUBLIC_` variable. After deployment, the first
admin request logs only these boolean frontend checks:
`hasApiUrl`, `hasAdminApiKey`, and `hasCompanyId`. If FastAPI logs
`Admin API authentication is not configured`, verify that the Compose
`environment` mapping is present and redeploy the backend container; changing
the Dokploy UI variable alone does not update an already-running container.

Uvicorn trusts forwarded headers because the container is intended to receive
traffic through Dokploy's Traefik network. Do not publish port `8000` directly on
the production host. FastAPI documents proxy-header configuration for containers
behind TLS termination in its [container deployment guide](https://fastapi.tiangolo.com/deployment/docker/).

For each release, build from a reviewed commit, apply any pending SQL migrations
before enabling code that depends on them, deploy, confirm health, and inspect the
JSON logs in Dokploy. Roll back to the previous commit or image if the new
container does not become healthy.
