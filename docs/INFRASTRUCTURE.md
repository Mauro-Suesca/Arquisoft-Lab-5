# Infrastructure Guide – CPS Calculator

This document describes how the CPS Calculator runs with Docker Compose and Nginx.

## 1. Architecture overview

```text
                 host :8080
 Browser ───────────────────► nginx (reverse proxy)
                                 │
                 ┌───────────────┴────────────────┐
                 │ /                              │ /api/*
                 ▼                                ▼
          web-frontend:80                   backend:8000
     (React build served by nginx)           (FastAPI)
                                                  │
                                                  ▼
                                              db:5432
                                           (PostgreSQL 17)
                                                  │
                                                  ▼
                                      volume: postgres_data
```

- The browser talks **only** to Nginx on `http://localhost:8080`.
- Frontend and API share the same origin, so no CORS configuration is needed.
- The backend and the database have no published ports; they are reachable only
  inside the Docker networks.

## 2. Docker services

| Service        | Image / build                         | Internal port | Published | Purpose                                   |
|----------------|---------------------------------------|---------------|-----------|-------------------------------------------|
| `nginx`        | `nginx:1.27-alpine`                   | 80            | `8080`    | Single entry point, reverse proxy         |
| `web-frontend` | `./web-frontend/Dockerfile`           | 80            | –         | Serves the static React (Vite) build      |
| `backend`      | `./cps_backend/dockerfile`            | 8000          | –         | FastAPI REST API                          |
| `db`           | `postgres:17`                         | 5432          | –         | Stores users and their max CPS            |

Start-up order is enforced with `depends_on` + health checks:

1. `db` starts; its health check runs `pg_isready`.
2. `backend` starts only when `db` is **healthy**. On start-up it creates the
   tables (`Base.metadata.create_all`). Its own health check calls `GET /health`.
3. `web-frontend` starts (no dependencies).
4. `nginx` starts when `backend` is **healthy** and `web-frontend` has started,
   so every upstream hostname already exists when Nginx resolves it.

## 3. Network communication

Two user-defined bridge networks are declared in `compose.yaml`:

| Network    | Members                            | Notes                                         |
|------------|------------------------------------|-----------------------------------------------|
| `app_net`  | `nginx`, `web-frontend`, `backend` | Proxy traffic                                 |
| `data_net` | `backend`, `db`                    | `internal: true` – no traffic outside Docker  |

Containers find each other through Docker's embedded DNS using the **service
name** (`backend`, `web-frontend`, `db`). `localhost` inside a container refers to
the container itself, so it is never used between services.

Because `nginx` is not attached to `data_net`, the proxy cannot reach the database
at all: only the backend can.

### Nginx routing

The configuration lives in `etc/nginx/sites-available/localhost` and is mounted
read-only as `/etc/nginx/conf.d/default.conf`.

| Browser request                         | Forwarded to                         |
|-----------------------------------------|--------------------------------------|
| `GET http://localhost:8080/`            | `http://web-frontend:80/`            |
| `GET http://localhost:8080/api/health`  | `http://backend:8000/health`         |
| `GET http://localhost:8080/api/users/x` | `http://backend:8000/users/x`        |
| `POST http://localhost:8080/api/users/x`| `http://backend:8000/users/x`        |
| `GET http://localhost:8080/api/docs`    | `http://backend:8000/docs` (Swagger) |

The trailing slash in `proxy_pass http://backend_servers/;` makes Nginx replace the
`/api/` prefix with `/`, so the FastAPI routes stay exactly as they are.
Uvicorn runs with `--root-path /api` so that Swagger UI (`/api/docs`) loads
`/api/openapi.json` correctly; it does not change the routes.

### Frontend API URL

`web-frontend/src/services/cpsService.js` uses
`import.meta.env.VITE_API_URL || "/api"`. Vite inlines this value **at build
time**. The Docker build receives `VITE_API_URL=/api` (build arg in
`compose.yaml`, also the default `ARG` in the Dockerfile), so the bundle calls
relative URLs such as `/api/users/<name>`, which hit Nginx on the same origin.

`web-frontend/.env` (`http://localhost:8000`) is only for running Vite locally
outside Docker; it is excluded from the image by `.dockerignore`.

## 4. Environment variables

Defined in the repository root (optional `.env`, see `.env.example`):

| Variable            | Default        | Used by            |
|---------------------|----------------|--------------------|
| `POSTGRES_DB`       | `cps_db`       | `db`, `backend`    |
| `POSTGRES_USER`     | `cps_user`     | `db`, `backend`    |
| `POSTGRES_PASSWORD` | `cps_password` | `db`, `backend`    |

Derived values:

| Variable       | Service        | Value                                                                    |
|----------------|----------------|--------------------------------------------------------------------------|
| `DATABASE_URL` | `backend`      | `postgresql+psycopg://<user>:<password>@db:5432/<db>`                    |
| `VITE_API_URL` | `web-frontend` | `/api` (build arg, inlined into the JavaScript bundle)                   |

> PostgreSQL only applies `POSTGRES_*` when the data directory is empty. If you
> change the credentials after the volume exists, the old ones remain valid.

## 5. Build and deployment

Requirements: Docker Engine / Docker Desktop with the Compose v2 plugin.

```bash
# (optional) customise credentials
cp .env.example .env

# validate the configuration
docker compose config

# build images and start all services in the background
docker compose up --build -d

# service status (db and backend should show "healthy")
docker compose ps
```

Open <http://localhost:8080>.

### Day-to-day commands

| Task                                   | Command                                            |
|----------------------------------------|----------------------------------------------------|
| Start (build if needed)                | `docker compose up --build -d`                     |
| Stop and remove containers (keep data) | `docker compose down`                              |
| Stop without removing containers       | `docker compose stop`                              |
| Rebuild one service                    | `docker compose up --build -d backend`             |
| Rebuild without cache                  | `docker compose build --no-cache`                  |
| All logs (follow)                      | `docker compose logs -f`                           |
| Logs of one service                    | `docker compose logs -f backend`                   |
| Reload Nginx after editing its config  | `docker compose restart nginx`                     |
| Open a psql shell                      | `docker compose exec db psql -U cps_user -d cps_db` |

### Verification

```bash
# API through the proxy
curl http://localhost:8080/api/health
# -> {"status":"ok"}

# Full flow: write and read through nginx -> backend -> PostgreSQL
curl -X POST http://localhost:8080/api/users/alice \
     -H "Content-Type: application/json" -d '{"clicks": 40}'
# -> {"Name":"alice","CPS":8.0,"maxCPS":0.0}
curl http://localhost:8080/api/users/alice
# -> {"Name":"alice","maxCPS":8.0}

# Data stored in the database
docker compose exec db psql -U cps_user -d cps_db -c "SELECT * FROM users;"

# Backend and DB are NOT exposed on the host (both should fail)
curl http://localhost:8000/health
```

On Windows PowerShell use `curl.exe` instead of `curl`, and for the POST body:
`curl.exe -X POST http://localhost:8080/api/users/alice -H "Content-Type: application/json" -d "{\"clicks\": 40}"`.

## 6. Data persistence

The `db` service mounts the named volume `postgres_data` at
`/var/lib/postgresql/data`. Compose prefixes it with the project name, so the real
volume is `cps-calculator_postgres_data` (`docker volume ls`).

- `docker compose down` removes containers and networks but **keeps** the volume.
- `docker compose down -v` **deletes** the volume and all stored scores. Use it
  only when you intentionally want a clean database.

## 7. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| `Bind for 0.0.0.0:8080 failed: port is already allocated` | Another process uses 8080. Stop it, or change the left side of `"8080:80"` in `compose.yaml`. |
| `backend` restarts, logs show `connection refused` / `password authentication failed` | DB not ready, or credentials in `.env` differ from those used when the volume was first created. Check `docker compose logs db`. |
| `502 Bad Gateway` on `/api/...` | Backend down or unhealthy: `docker compose ps`, `docker compose logs backend`. |
| `nginx` exits with `host not found in upstream` | An upstream container is missing. Run `docker compose up -d` so all services exist, then `docker compose restart nginx`. |
| Frontend shows "Unable to retrieve user information" | Open browser DevTools → Network. Requests must go to `/api/users/...` on port 8080. If they go to `localhost:8000`, the image was built with a wrong `VITE_API_URL`: `docker compose build --no-cache web-frontend`. |
| Frontend build fails with `Could not read package.json` | `web-frontend/package.json` is required by the Dockerfile. |
| Changes to code are not visible | Images must be rebuilt: `docker compose up --build -d`. |
| Changes to the Nginx config are not applied | `docker compose restart nginx`; test syntax with `docker compose exec nginx nginx -t`. |

## 8. Per-service compose files

`cps_backend/docker-compose.yml` and `web-frontend/compose.yaml` are kept for
running each part on its own during development. The root `compose.yaml` is the
one used to run the integrated application. Do not run them at the same time as
the root stack: the backend file also publishes port 8000 and uses fixed
`container_name`s, and it uses a different volume (`cps_backend_postgres_data`).
