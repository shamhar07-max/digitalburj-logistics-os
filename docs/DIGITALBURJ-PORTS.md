# DigitalBurj hybrid ports — what was kept from the old repo

Base is ElvoraLogisticsOS (entity-driven Fastify + SQLite/Postgres, 97 entities,
AI team, WhatsApp, UAE compliance). The following was ported from the previous
`digitalburj-logistics-os` monorepo (Express + multi-tenant Postgres) as pure,
framework-free logic so it can be wired into Elvora entities without a rewrite.

## Ported modules

| Module | Location in this repo | Original | How to wire |
|---|---|---|---|
| Operational Velocity (Quote Accepted → Docs Generated, Sea/Air/Road compare, SLA 30/60 min) | `src/shared/ports/velocity.ts` + `tools/ports/velocity.ts` | `packages/shared/src/velocity.ts`, `prototype/src/utils/velocity.ts` | Build a `/velocity` report page reading `quotations.accepted_at`, `jobs.created_at`, `bookings.confirmed_at`, document `created_at`; reuse `modeGroup()` + `MeasureResult` |
| Modal Hub (vessel slots vs booked TEU, flight uplift, fleet utilisation, every figure tagged live/register/sample) | `src/shared/ports/hub.ts` + `tools/ports/modalHub.ts` | `packages/shared/src/hub.ts`, `prototype/src/utils/modalHub.ts` | Feed `HubInput` from jobs/shipments, vehicles, trips; render swimlanes; keep `source` tags honest |
| Document sets (HBL/HAWB/CMR + Packing List + Commercial Invoice, required-docs scorecard) | `src/shared/ports/docs.ts` + `tools/ports/documentGenerator.ts` | `packages/shared/src/docs.ts`, `prototype/src/utils/documentGenerator.ts` | Elvora already version-prints via `/print/:entity/:id`; add `transportDocFor(mode)` selection + `fileCompleteness()` scorecard on the job page |
| Old docs (competitor + comparison + UAE readiness notes) | `docs/ports/OLD-DIGITALBURJ-*.md` | `docs/COMPETITORS.md`, `docs/COMPARISON.md`, `docs/UAE-READINESS.md` | Kept for reference; Elvora `docs/` is authoritative for behaviour |

## Deliberately NOT ported (architecture conflicts)

- Multi-tenant Postgres row-level tenancy (`tenant_id` everywhere, JWT + refresh).
  Elvora is single-company SQLite-first with a Supabase replica. Multi-tenancy is a
  separate migration project (see `docs/POSTGRES.md` + `src/server/pgbridge.ts`).
- Offline-first driver PWA with idempotent `/driver/sync` (`client_id` replay).
  Elvora has trips/drivers/vehicles entities; the offline queue lives in the old
  `apps/web/src/pages/DriverApp.tsx` — rebuild as a lightweight `/driver` page later.
- Express `crud/` registry, `ws` realtime hub, `pino` logger.
  Elvora equivalents: entity-driven `routes/crud.ts`, in-app notifications, console log.

## Brand swap applied

- `public/brand/logo-primary.png` ← DigitalBurj wordmark; `icon-primary.png` /
  `icon-reverse.png` ← DigitalBurj hexagon icon; `logo-reverse.png` ← lockup
  (rendered white via CSS filter on the login panel); originals kept as
  `public/brand/DigitalBurj-*`.
- Colors: emerald `#007b52` → signal `#e8472b`, fold `#025e3d` → ink `#0a2a2b`,
  graphite `#161d1a` → ink `#0a2a2b`, signal `#c32135` → `#d13b20`
  (see `DESIGN.md` frontmatter + `src/web/index.css`).
- Strings: Elvora Shipping L.L.C. → DigitalBurj Logistics LLC,
  `@elvorashipping.com` → `@digitalburj.ae`, `elvora_*` keys/cookies/db → `digitalburj_*`.
- Corporate templates (`corporate-templates/documents/**`, `ELV-xxx`) kept as-is;
  rename to `DBJ-xxx` only when reprinting letterheads.
