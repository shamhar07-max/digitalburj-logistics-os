# ADR-0001: Modular monolith with row-level multi-tenancy

**Status:** accepted

**Context:** Target customers are 5–100 person forwarders with small IT capacity. Need fast onboarding of many tenants and simple operations.

**Decision:** One Node service + one PostgreSQL database; every table carries `tenant_id`; the tenant comes from the verified token. Not schema-per-tenant or DB-per-tenant.

**Consequences:** + trivial onboarding, cheap ops, cross-tenant analytics for the operator, single migration path. − a missed `tenant_id` filter is a data leak, so isolation is covered by integration tests and the CRUD layer centralises the filter; noisy-neighbour risk is handled by indexes/rate limits. Enterprise customers wanting hard isolation can get a dedicated deployment of the same image.
