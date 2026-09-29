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

## Neon + Vercel (serverless)

Database on Neon, app on Vercel. `vercel.json` serves the SPA as static output and runs the whole Express API as one function (`api/index.mjs` → `apps/api/dist/serverless.js`).

1. **Neon**: create a project (Postgres 16, pick a region near your users), copy the *pooled* connection string. Apply migrations once: `DATABASE_URL=… DATABASE_SSL=true npm run db:migrate` (the serverless entry does not migrate on boot).
2. **Vercel**: import the GitHub repo (the Vercel GitHub app must have access to the repo's owner). Framework "Other"; `vercel.json` supplies install/build/output. Set env vars for Production (and Preview if used):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled URL (mark sensitive) |
| `DATABASE_SSL` | `true` |
| `PG_POOL_MAX` | `3` |
| `JWT_SECRET`, `ENCRYPTION_KEY` | fresh `openssl rand -hex 32` values |
| `CRON_SECRET` | `openssl rand -hex 24` (Vercel sends it to the cron route) |
| `ENABLE_SCHEDULER` | `false` |
| `STORAGE_DRIVER` / `UPLOAD_DIR` | `local` / `/tmp/uploads` (ephemeral — see below) |
| `WEB_ORIGIN`, `PUBLIC_WEB_URL` | your deployment URL |

3. Register the first company at `/register` (or `POST /api/auth/register`). Do not run the demo seed against a real database.

**Serverless trade-offs** (use the Docker path if you need any of these):

* **No live updates** – WebSockets are unavailable, so the SPA is built with `VITE_DISABLE_REALTIME=1` and refreshes on focus/navigation.
* **Scheduler is a cron** – `vercel.json` runs `/api/cron` daily (Hobby plans allow once per day; Pro can run it more often). It marks invoices overdue, expires quotes, refreshes risk and raises expiry alerts.
* **Uploads are not durable** – `/tmp` is per-instance and ephemeral. Configure S3-compatible storage (`STORAGE_DRIVER=s3`, `S3_*`) before accepting documents, PODs or receipts.
* **Automation webhooks** run after the response and may be cut off when the function freezes; use the long-running container for reliable outbound webhooks.
* Rate limits are per instance.

## Scaling and ops

* Stateless app tier – scale horizontally; DB is the bottleneck (add read replica for reports).
* Zero-downtime: migrations are additive; deploy new image, old replicas keep serving until drained.
* Backups: managed PITR; test restores. `uploads/` (if local) must be backed up too.
* Observability: pino JSON logs; `/healthz` liveness (process only), `/readyz` readiness (DB round-trip).

## CI

`.github/workflows/ci.yml` runs type-check, all tests against a Postgres service, the production build, and verifies `docs/API.md` is regenerated (`python3 scripts/gen-api-docs.py`).

## Status of this repository's deployment path

The Dockerfile and compose file were written and each stage's commands were exercised individually, but **the image has not been built end-to-end in the authoring environment (no Docker daemon)**. Run `docker compose build` once in CI or locally before relying on it.
