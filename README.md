# Arquisoft-Lab-5

Una aplicación web sencilla para contar el número de clicks por segundo.
Usa nginx como reverse proxy

## Running with Docker

Requires Docker with the Compose v2 plugin.

```bash
docker compose up --build -d   # build and start all services
docker compose ps              # service status
docker compose logs -f         # follow logs
docker compose down            # stop (database data is kept)
```

The application is available at <http://localhost:8080>.

See [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) for services, networks,
environment variables and troubleshooting.
