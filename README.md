# DigitalBurj Logistics OS

A multi-tenant operating system for UAE freight forwarders and logistics companies (5–100 staff): **quote → job → customs → dispatch → POD → invoice → cash**, with the back office (accounting, VAT, HR/payroll, procurement, warehouse) and customer/driver surfaces on the same data.

| Layer | Stack |
|---|---|
| API | Node 20, Express 4, TypeScript, PostgreSQL 16 (`pg`), zod, JWT + rotating refresh tokens, `ws`, pino |
| Web | React 18, Vite, React Router 6, TanStack Query 5, zustand, plain CSS design tokens (RTL + dark mode) |
| Shared | `packages/shared` – RBAC matrix, money/VAT maths, state machines, UAE validators (TRN, IBAN, ISO 6346, MSISDN) |
| Ops | Multi-stage `Dockerfile`, `docker-compose.yml`, GitHub Actions CI |

## What is in the box

Operations: shipments (sea/air/road/multimodal) with milestone templates, risk engine and live tracking · quotes with rate cards, approvals and one-click quote→job · customs declarations and HS codes · dispatch board, trips, drivers, vehicles, an **offline-first driver app** (POD capture, expenses, idempotent sync) · warehouse (bins, receive/move/release/count) · procurement · CRM pipeline · document vault with **document intelligence** (B/L, invoice, packing list extraction with ISO 6346 validation; Claude-powered when a key is set, deterministic rules otherwise).

Finance: charges & job costing · invoices (UAE VAT codes S/Z/E/O, credit notes, PINT-AE-style UBL XML) · double-entry ledger with balance enforcement, bank reconciliation, aging · VAT return workings · approvals with segregation of duties.

People: HRMS, leave, payroll with **WPS SIF** builder, compliance calendar (trade licence, visas, insurance).

Platform: 12 roles × 34 modules RBAC with field-level cost hiding · custom roles · multi-entity scoping · audit log · notifications + WebSocket live updates · automation engine (SSRF-guarded webhooks) · WhatsApp Cloud API inbox · customer portal + public tracking/request pages · AI assistant · reports (lane profitability, job costing, sales, attribution) · command palette (⌘K) · EN/AR.

See [`docs/COMPETITORS.md`](docs/COMPETITORS.md) for how this maps to Freightos, Magaya, CargoWise, Cargoo and others, and [`docs/UAE-READINESS.md`](docs/UAE-READINESS.md) for what is real vs. an adapter that needs credentials.

## Quick start (local)

```bash
# 1. Postgres 16 (any way you like), e.g.
docker run -d --name dbj-pg -e POSTGRES_USER=digitalburj -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=digitalburj_dev -p 5432:5432 postgres:16

# 2. Install, migrate, seed the demo tenant
npm install
cp apps/api/.env.example apps/api/.env
npm run db:migrate
npm run db:seed          # "Al Noor Logistics LLC" demo data

# 3. Run API (:3001) and web (:3000) together
npm run dev
```

Sign in at <http://localhost:3000> — password for every demo user is `Demo@12345!`:

| User | Role |
|---|---|
| owner@alnoor.ae | Owner (everything) |
| sales@alnoor.ae | Sales (cannot see buy rates / margins) |
| ops@alnoor.ae · customs@alnoor.ae · dispatch@alnoor.ae · warehouse@alnoor.ae | Operations roles |
| finance@alnoor.ae · hr@alnoor.ae | Finance / HR |
| driver@alnoor.ae | Driver app (`/driver`) |
| portal@noon-demo.ae | Customer portal (`/portal`) |

**Change or delete the demo users before any real deployment.**

## Docker

```bash
cp .env.example .env     # set JWT_SECRET and ENCRYPTION_KEY: openssl rand -hex 32
docker compose up --build
```

The image serves API and built SPA on one port (`:3001`), runs migrations on boot and exposes `/healthz`. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Quality gates

```bash
npm run type-check   # shared + api + web
npm run test         # 16 shared + 67 API (unit + Postgres integration) + 18 web tests
npm run build        # tsup bundle + Vite build
node e2e/flows.mjs   # 10 real-browser flows (Playwright-core; see e2e/README.md)
```

API integration tests run against a real Postgres (`digitalburj_test`) and cover auth/lockout, tenant isolation, field-level RBAC, portal scoping, workflow integrity, POD idempotency, ledger balance, payroll/SIF, webhook signatures and document extraction.

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [API reference (generated)](docs/API.md) · [Security](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md) · [UAE readiness](docs/UAE-READINESS.md) · [Competitor analysis](docs/COMPETITORS.md) · [ADRs](docs/adr/)

## Licence

Proprietary — © DigitalBurj.
