# Arquisoft-Lab-5

Una aplicación web sencilla para contar el número de clicks por segundo.
Usa nginx como reverse proxy

## Overview

CPS Calculator measures how many clicks per second a user makes in a 5-second
test and stores each user's best score.

| Component     | Technology            | Folder                     |
|---------------|-----------------------|----------------------------|
| Frontend      | React + Vite          | `web-frontend/`            |
| Backend       | FastAPI + SQLAlchemy  | `cps_backend/`             |
| Database      | PostgreSQL 17         | (Docker image)             |
| Reverse proxy | Nginx                 | `etc/nginx/sites-available/` |

```text
Browser ──► nginx :8080 ──┬── /      ──► web-frontend
                          └── /api/  ──► backend ──► db (PostgreSQL)
```

## Quick start

Requires Docker with the Compose v2 plugin.

```bash
docker compose up --build -d
```

- App: <http://localhost:8080>
- API health: <http://localhost:8080/api/health>
- API docs: <http://localhost:8080/api/docs>

```bash
docker compose ps            # status
docker compose logs -f       # logs
docker compose up --build -d # rebuild after code changes
docker compose down          # stop (data is kept)
```

## API

All routes are available under `/api` through Nginx.

| Method | Path                | Body              | Response                                  |
|--------|---------------------|-------------------|-------------------------------------------|
| GET    | `/api/health`       | –                 | `{"status": "ok"}`                        |
| GET    | `/api/users/{name}` | –                 | `{"Name": str, "maxCPS": float}`          |
| POST   | `/api/users/{name}` | `{"clicks": int}` | `{"Name": str, "CPS": float, "maxCPS": float}` |

## Documentation

See [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) for architecture, services,
networks, environment variables, deployment and troubleshooting.
