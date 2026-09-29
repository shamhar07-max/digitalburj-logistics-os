# Architecture

```
 Browser (React SPA, PWA)  ──HTTPS──►  Express API  ──►  PostgreSQL 16
   ▲  offline queue (driver)            │  ▲             (row-level tenancy)
   │                                    │  └─ scheduler (advisory-locked)
   └──── WebSocket /ws ◄── event bus ◄──┴──► automation engine ──► webhooks
                                         └─► adapters: WhatsApp, Resend, Claude, ASP, Navo24, S3
```

One deployable: the API serves the built SPA in production. There is no Redis, queue broker or separate worker — background work runs in-process on a scheduler guarded by a Postgres advisory lock so multiple replicas do not double-run jobs. This keeps the ops footprint to "one container + one database"; see ADR-0002 for when to split.

## Monorepo

| Path | Role |
|---|---|
| `packages/shared` | Pure TypeScript consumed as source by both apps: RBAC matrix, money/VAT, state machines, UAE validators. One definition of "who can do what" for server enforcement and UI gating. |
| `apps/api` | `src/config.ts` env (zod, production secret guards) · `db.ts` pool, `tx()`, reference numbers · `auth/` JWT + per-request user/role load · `crud/` declarative resource registry · `routes/` workflow endpoints · `services/` domain logic (ledger, invoicing, e-invoice, WPS, risk, docintel, automation, realtime, scheduler) |
| `apps/web` | `pages/` one file per module · `ui/` kit, forms, `ResourceTable` · `hooks/useRealtime` WS → TanStack Query invalidation · `lib/i18n` EN/AR · `store/session` zustand |
| `e2e` | Playwright-core browser flows |

## Request pipeline

`helmet → CORS → rate limit → JSON → auth (verify JWT, load user + role, 30 s custom-role cache) → entity scope (X-Entity-Id) → requirePerm(module, action) → handler → audit + event`.

* **Tenancy** – every table carries `tenant_id`; every query in `crud/` and `routes/` filters on it from the authenticated principal, never from request input. Integration tests assert cross-tenant reads/writes return 404.
* **RBAC** – 12 roles × 34 modules × actions `c r u d a x`. The `costs` module gates buy rates and margins; the generic CRUD layer strips a resource's `sensitive` columns for users without `costs:r`. Portal users are additionally row-scoped to their customer.
* **Declarative CRUD** – a `Resource` entry (table, columns with types/limits, filters, search, sensitive fields, hooks) yields list/get/create/patch/delete with validation, pagination, audit and events. Bespoke endpoints exist only where there is a workflow (status transitions, posting, approvals).
* **Workflows** – shipment, quote and customs transitions are tables in `packages/shared/workflow.ts`; the API refuses invalid jumps (409) and milestone templates are generated per mode.
* **Ledger** – journal entries are inserted in a transaction and rejected unless debits = credits; invoice posting, payments, credit notes and payroll all post through the same service.
* **Events** – `services/events.ts` emits typed domain events → (a) WebSocket hub (tenant-scoped, portal/driver filtered), (b) automation engine, (c) notifications.
* **Offline driver app** – actions queue in `localStorage` with a client-generated `client_id`; `/driver/sync` replays idempotently, so retry after a flaky connection cannot double-post a POD or expense.

## Frontend

React Query for server state; zustand only for session. Pages call `/api` through `lib/api` (auto refresh on 401, single-flight). The WebSocket invalidates query keys by event type so lists update live. Design tokens live in `styles.css` (ink teal, orange signal; Archivo / IBM Plex); RTL via `dir`, dark mode via `prefers-color-scheme` + toggle.

## Failure model

* Startup refuses production boot with default `JWT_SECRET`/`ENCRYPTION_KEY`.
* Integrations degrade: no `ANTHROPIC_API_KEY` → rules-based extraction/assistant; no `RESEND_API_KEY` → emails recorded in the outbox; no ASP → e-invoice generated and validated locally, status `sandbox`.
* Integration secrets are AES-256-GCM encrypted at rest and masked on read.
