# Database

PostgreSQL 16. **Row-level multi-tenancy**: every business table has `tenant_id uuid NOT NULL` (indexed, usually as the leading index column) and all access paths filter by the authenticated tenant. There is no schema-per-tenant.

Migrations: `apps/api/migrations/NNN_name.sql`, applied in order by `npm run db:migrate` (`src/migrate.ts`), tracked in `schema_migrations`, each in its own transaction. Add new files; never edit applied ones.

## Domains

| Domain | Tables |
|---|---|
| Identity & access | `tenants`, `entities`, `roles`, `users`, `refresh_tokens`, `password_resets`, `audit_log`, `notifications`, `integrations`, `counters` |
| CRM & sales | `customers`, `contacts`, `deals`, `rates`, `quotes`, `quote_items` |
| Operations | `shipments`, `milestones`, `charges`, `documents`, `doc_extractions`, `customs_declarations` |
| Dispatch | `vehicles`, `drivers`, `trips`, `trip_stops`, `pods`, `driver_expenses` |
| Warehouse & buying | `warehouse_bins`, `warehouse_stock`, `warehouse_movements`, `suppliers`, `purchases`, `bills` |
| Finance | `invoices`, `invoice_items`, `payments`, `accounts`, `journal_entries`, `journal_lines`, `bank_transactions`, `approvals` |
| People | `employees`, `leave_requests`, `attendance`, `payroll_runs`, `payslips`, `talent`, `courses`, `enrollments` |
| Projects & growth | `projects`, `project_tasks`, `timesheets`, `growth_metrics` |
| Automation & messaging | `workflows`, `workflow_runs`, `threads`, `messages`, `outbox` |

The authoritative definition is `apps/api/migrations/*.sql` — read it rather than this table for column-level detail.

## Conventions

* `id uuid` primary keys (`gen_random_uuid()`); `created_at/updated_at timestamptz`.
* Money is `numeric(14,2)`; the driver parses `numeric` to JS numbers (safe at these magnitudes) and all arithmetic goes through `packages/shared/money.ts` with explicit rounding.
* Human references come from `nextRef()`, an atomic upsert-increment on the `counters` table keyed by `(tenant_id, key)`, so numbers are unique per tenant (a rolled-back transaction rolls its number back too).
* Status columns are `text`; allowed transitions live in application code (`workflow.ts`), not the DB.
* Business records move through statuses (closed/cancelled) rather than being deleted; hard deletes exist on reference/master data via CRUD and are audited.
* Journal integrity: `journal_lines` are only written inside a transaction that asserts Σdebit = Σcredit.

## Operations

* Use a managed Postgres with PITR backups. Set `DATABASE_SSL=true` for TLS providers (Neon, RDS, Supabase).
* The scheduler takes `pg_try_advisory_lock` so only one replica runs periodic jobs (risk refresh, marking invoices overdue, expiring stale quotes, 30-day document-expiry alerts).
* Scaling path: read replicas for reports; partition `audit_log`/`messages` by month if they exceed tens of millions of rows.
