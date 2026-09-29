# Deployment

Single container (API + built SPA) + PostgreSQL 16.

## Environment

See [`.env.example`](../.env.example) / [`apps/api/.env.example`](../apps/api/.env.example). Required in production: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `WEB_ORIGIN`, `PUBLIC_WEB_URL`. Optional integrations: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `WHATSAPP_*`, `NAVO24_API_KEY`, `ASP_*`, `S3_*`.

## Docker Compose (single host)

```bash
cp .env.example .env      # fill secrets
docker compose up -d --build
curl localhost:3001/healthz
```

The app runs pending migrations on start. Create your first tenant via the public `/register` flow (or `POST /api/auth/register`); do **not** run the demo seed in production.

## Container platform (Fly, Render, ECS, Cloud Run, Railway…)

Build the `Dockerfile`, point `DATABASE_URL` at managed Postgres (`DATABASE_SSL=true` if TLS is required), set liveness `GET /healthz` and readiness `GET /readyz` (readiness checks the database), expose port 3001, and run ≥1 replica. Multiple replicas are safe: migrations are transactional and the scheduler is advisory-locked. WebSocket upgrade on `/ws` must be allowed by the proxy. Use S3 storage when running more than one replica.

## Scaling and ops

* Stateless app tier – scale horizontally; DB is the bottleneck (add read replica for reports).
* Zero-downtime: migrations are additive; deploy new image, old replicas keep serving until drained.
* Backups: managed PITR; test restores. `uploads/` (if local) must be backed up too.
* Observability: pino JSON logs; `/healthz` liveness (process only), `/readyz` readiness (DB round-trip).

## CI

`.github/workflows/ci.yml` runs type-check, all tests against a Postgres service, the production build, and verifies `docs/API.md` is regenerated (`python3 scripts/gen-api-docs.py`).

## Status of this repository's deployment path

The Dockerfile and compose file were written and each stage's commands were exercised individually, but **the image has not been built end-to-end in the authoring environment (no Docker daemon)**. Run `docker compose build` once in CI or locally before relying on it.
