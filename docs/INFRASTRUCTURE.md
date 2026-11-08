# Infrastructure Guide – CPS Calculator

This document describes how the CPS Calculator runs with Docker Compose and Nginx.

## 1. Architecture overview

The deployment follows the agreed components & connectors (C&C) chain:

`Web Browser → Reverse Proxy → Web Frontend → CPS Calculator → Relational Database`

```text
                 host :8080
 Browser ───────────────────► nginx (main reverse proxy)          [edge_net]
                                 │  every request, URI unchanged
                                 ▼
                         web-frontend:80 (nginx)                  [edge_net + app_net]
                           ├── /       → React static build
                           └── /api/*  → strips "/api", forwards
                                 │
                                 ▼
                           backend:8000 (FastAPI)                 [app_net + data_net]
                                 │
                                 ▼
                             db:5432 (PostgreSQL 17)              [data_net]
                                 │
                                 ▼
                       volume: postgres_data
```

- The browser talks **only** to the main reverse proxy on `http://localhost:8080`.
- The main reverse proxy has **one** destination: the Web Frontend server. It has
  no route, upstream or network path to the backend.
- The Web Frontend server serves the React build and is the connector to the
  CPS Calculator (`/api/` → `backend:8000`).
- The backend and the database have no published ports.

## 2. Docker services

| Service        | Image / build                         | Internal port | Published | Purpose                                                  |
|----------------|---------------------------------------|---------------|-----------|----------------------------------------------------------|
| `nginx`        | `nginx:1.27-alpine`                   | 80            | `8080`    | Main reverse proxy, single entry point                   |
| `web-frontend` | `./web-frontend/Dockerfile`           | 80            | –         | Serves the React build; forwards `/api/` to the backend  |
| `backend`      | `./cps_backend/dockerfile`            | 8000          | –         | CPS Calculator REST API (FastAPI)                        |
| `db`           | `postgres:17`                         | 5432          | –         | Relational database (users and max CPS)                  |

### Two Nginx instances

| Instance | Config file | Role |
|----------|-------------|------|
| Main reverse proxy (`nginx` service) | `etc/nginx/sites-available/localhost` (mounted read-only) | Receives all browser traffic and forwards **everything** through the `backend_servers` upstream (`least_conn`, currently one server: `web-frontend:80`), keeping the URI (including `/api/`) unchanged. |
| Web Frontend server (inside `web-frontend`) | `web-frontend/nginx.conf` (copied into the image) | Serves `/usr/share/nginx/html` with SPA fallback (`try_files … /index.html`) and forwards `/api/<path>` to `http://backend:8000/<path>`. |

### Start-up order

Only the start-up dependencies that are technically required are declared:

1. `db` starts; health check `pg_isready`.
2. `backend` starts when `db` is **healthy**, because it creates the tables on
   start-up. Health check `GET /health`.
3. `web-frontend` starts without dependencies: its Nginx resolves `backend` per
   request, so it does not need the API to be running. Health check fetches `/`.
4. `nginx` starts when `web-frontend` is **healthy**, because its upstream host
   `web-frontend` is resolved when Nginx starts.

While the backend is still starting, the page loads but `/api/...` returns `502`.

## 3. Network communication

| Network    | Members                     | `internal` | Connector                         |
|------------|-----------------------------|------------|-----------------------------------|
| `edge_net` | `nginx`, `web-frontend`     | no         | Reverse Proxy → Web Frontend      |
| `app_net`  | `web-frontend`, `backend`   | yes        | Web Frontend → CPS Calculator     |
| `data_net` | `backend`, `db`             | yes        | CPS Calculator → Database         |

Containers resolve each other through Docker's embedded DNS using the **service
name**, and only for services that share at least one network. Resulting
reachability:

| From \ To      | nginx | web-frontend | backend | db  |
|----------------|:-----:|:------------:|:-------:|:---:|
| `nginx`        |   –   |      ✔       |    ✘    |  ✘  |
| `web-frontend` |   ✔   |      –       |    ✔    |  ✘  |
| `backend`      |   ✘   |      ✔       |    –    |  ✔  |
| `db`           |   ✘   |      ✘       |    ✔    |  –  |

- `nginx` is attached only to `edge_net`, so the name `backend` does not even
  resolve inside it.
- `edge_net` is the only non-internal network because Docker needs it to publish
  port 8080 on the host.
- `app_net` and `data_net` are `internal: true`: their containers cannot reach,
  or be reached from, anything outside Docker through them.

### Request flow

| Browser request                          | Main reverse proxy → | Web Frontend server →               |
|------------------------------------------|----------------------|-------------------------------------|
| `GET http://localhost:8080/`             | `web-frontend:80/`   | serves `index.html`                 |
| `GET http://localhost:8080/assets/…`     | `web-frontend:80/assets/…` | serves the static file        |
| `GET http://localhost:8080/api/health`   | `web-frontend:80/api/health` | `backend:8000/health`       |
| `GET/POST http://localhost:8080/api/users/x` | `web-frontend:80/api/users/x` | `backend:8000/users/x` |

The Web Frontend server removes the `/api` prefix with
`rewrite ^/api/(.*)$ /$1 break;`, so the FastAPI routes stay unchanged.

> The backend runs with its original Dockerfile command. Swagger UI is therefore
> not usable through `/api/docs` (it requests `/openapi.json` without the prefix).
> Use `docker compose exec web-frontend wget -q -O - http://backend:8000/openapi.json`
> to inspect the API schema if needed.

The Web Frontend server resolves `backend` at request time through Docker's DNS
(`resolver 127.0.0.11`). This lets the container start without the backend (for
example with `web-frontend/compose.yaml` alone, where `/api/` simply returns
`502`) and follows the backend if its container is recreated with a new IP.

### Frontend API URL

React runs in the **browser**, so its `fetch()` calls do not originate from the
`web-frontend` container. `web-frontend/src/services/cpsService.js` uses
`import.meta.env.VITE_API_URL || "/api"`; Vite inlines this value at build time.
`web-frontend/.env` (`VITE_API_URL=http://localhost:8000`) is excluded from the
Docker build context by `web-frontend/.dockerignore`, so the image uses the
`/api` fallback. The browser then calls relative URLs such as
`/api/users/<name>` on `localhost:8080`, which travel through the connector chain
above.

> Keep `.env` in `web-frontend/.dockerignore`. If it is removed, the bundle will
> call `http://localhost:8000`, which is not published by the Docker stack.

## 4. Environment variables

Defined in the repository root (optional `.env`, see `.env.example`):

| Variable            | Default        | Used by            |
|---------------------|----------------|--------------------|
| `POSTGRES_DB`       | `cps_db`       | `db`, `backend`    |
| `POSTGRES_USER`     | `cps_user`     | `db`, `backend`    |
| `POSTGRES_PASSWORD` | `cps_password` | `db`, `backend`    |

Derived values:

| Variable       | Service        | Value                                                   |
|----------------|----------------|---------------------------------------------------------|
| `DATABASE_URL` | `backend`      | `postgresql+psycopg://<user>:<password>@db:5432/<db>`   |
| `VITE_API_URL` | `web-frontend` | not set in Docker; the code falls back to `/api`        |

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

# service status (db, backend and web-frontend should show "healthy")
docker compose ps
```

Open <http://localhost:8080>.

### Day-to-day commands

| Task                                   | Command                                             |
|----------------------------------------|-----------------------------------------------------|
| Start (build if needed)                | `docker compose up --build -d`                      |
| Stop and remove containers (keep data) | `docker compose down`                               |
| Stop without removing containers       | `docker compose stop`                               |
| Rebuild one service                    | `docker compose up --build -d backend`              |
| Rebuild without cache                  | `docker compose build --no-cache`                   |
| All logs (follow)                      | `docker compose logs -f`                            |
| Logs of one service                    | `docker compose logs -f web-frontend`               |
| Reload the main proxy after editing it | `docker compose restart nginx`                      |
| Open a psql shell                      | `docker compose exec db psql -U cps_user -d cps_db` |

### Verification

```bash
# API through the full chain (nginx -> web-frontend -> backend)
curl http://localhost:8080/api/health
# -> {"status":"ok"}

# Full flow: write and read through nginx -> web-frontend -> backend -> PostgreSQL
curl -X POST http://localhost:8080/api/users/alice \
     -H "Content-Type: application/json" -d '{"clicks": 40}'
# -> {"Name":"alice","CPS":8.0,"maxCPS":0.0}
curl http://localhost:8080/api/users/alice
# -> {"Name":"alice","maxCPS":8.0}

# Data stored in the database
docker compose exec db psql -U cps_user -d cps_db -c "SELECT * FROM users;"

# Network isolation checks
curl http://localhost:8000/health                                  # must fail: backend not published
docker compose exec nginx getent hosts backend                     # must print nothing: not resolvable
docker compose exec nginx wget -q -O - http://backend:8000/health  # must fail
docker compose exec web-frontend wget -q -O - http://backend:8000/health  # -> {"status":"ok"}
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
| `502 Bad Gateway` on every page | Main proxy cannot reach `web-frontend`: `docker compose ps`, `docker compose logs web-frontend`. |
| `502 Bad Gateway` only on `/api/...` | Web Frontend server cannot reach the backend: `docker compose logs web-frontend backend`, and check `docker compose exec web-frontend wget -q -O - http://backend:8000/health`. |
| `nginx` exits with `host not found in upstream "web-frontend"` | The frontend container is missing. Run `docker compose up -d`, then `docker compose restart nginx`. |
| Pages fail after recreating `web-frontend` | The main proxy cached the old IP: `docker compose restart nginx`. |
| Frontend shows "Unable to retrieve user information" | Open browser DevTools → Network. Requests must go to `/api/users/...` on port 8080. If they go to `localhost:8000`, `.env` was included in the build context (check `web-frontend/.dockerignore`), then run `docker compose build --no-cache web-frontend`. |
| Changes to code or `web-frontend/nginx.conf` are not visible | Images must be rebuilt: `docker compose up --build -d`. |
| Changes to the main proxy config are not applied | `docker compose restart nginx`; test syntax with `docker compose exec nginx nginx -t`. |

## 8. Per-service compose files

`cps_backend/docker-compose.yml` and `web-frontend/compose.yaml` are kept for
running each part on its own during development. The root `compose.yaml` is the
one used to run the integrated application. Do not run them at the same time as
the root stack: the backend file also publishes port 8000 and uses fixed
`container_name`s, and it uses a different volume (`cps_backend_postgres_data`).

## 9. Scaling to a second stack instance (future work)

The reverse proxy was designed to balance load between **two complete stack
instances** (frontend + backend each). The current deployment runs **one**
instance; the `backend_servers` upstream already uses `least_conn`, so adding a
second instance does not change the load-balancing strategy.

Outline of the future change (not implemented):

1. Add `web-frontend-2` and `backend-2` services to `compose.yaml`, built from the
   same Dockerfiles.
2. Add a private network for the second pair (for example `app_net_2`, internal)
   so `web-frontend-2` only reaches `backend-2`. Attach `web-frontend-2` to
   `edge_net` and `backend-2` to `data_net` (both backends share the same database).
3. Make the backend host used by the frontend server configurable, because
   `web-frontend/nginx.conf` currently targets `backend`. The official Nginx image
   supports this through `/etc/nginx/templates/*.template` and environment
   variables (`envsubst`).
4. Add the second server to the upstream in `etc/nginx/sites-available/localhost`:

   ```nginx
   upstream backend_servers{
       least_conn;
       server web-frontend:80;    # Stack instance 1
       server web-frontend-2:80;  # Stack instance 2
   }
   ```

5. Add `web-frontend-2` to the `depends_on` list of the `nginx` service.

## 10. Pending validation by the team

| Item | Owner | Reason |
|------|-------|--------|
| `web-frontend/package.json`, `web-frontend/package-lock.json`, `web-frontend/vite.config.js` | Web frontend | They were missing from the repository and are required by the existing Dockerfile (`COPY package*.json`, `npm run build`). Dependency versions must be confirmed, or replaced with the team's original files. |
| `web-frontend/nginx.conf` and the `COPY nginx.conf` line in `web-frontend/Dockerfile` | Web frontend | Adds the SPA fallback and the `/api/` connector to the backend in the existing frontend Nginx. |
