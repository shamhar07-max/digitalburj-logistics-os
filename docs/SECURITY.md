# Security

Scope: what the code enforces today, and what the operator must still do. This is not a third-party audit or pen-test.

## Enforced in code

| Area | Control |
|---|---|
| Authentication | bcrypt (cost 12); 15-minute access JWT; refresh tokens stored hashed, **rotated on use** (reuse fails); lockout after 5 failed logins; password reset tokens single-use and expiring |
| Authorisation | Server-side `requirePerm(module, action)` on every route from the shared RBAC matrix; per-request user + role reload so revocation is immediate (custom roles cached 30 s); segregation of duties on approvals (requester cannot approve their own request; the owner role is exempt) |
| Tenant isolation | `tenant_id` derived from the token, never the request; integration tests prove cross-tenant access returns 404 |
| Field-level | Buy rates, margins and job costs stripped unless `costs:r`; customer-portal users row-scoped to their customer; public tracking exposes only a safe status subset via an unguessable rotating token |
| Input | zod/declarative validation on every write; parameterised SQL only; upload limits: 1 file, 15 MB (multer 2) |
| Transport/headers | helmet with production CSP; CORS restricted to `WEB_ORIGIN` |
| Abuse | Global 600/min limiter, login (default 30/15 min/IP, `LOGIN_RATE_LIMIT`), register and forgot-password limiters |
| Secrets | Integration credentials AES-256-GCM encrypted at rest, masked in responses; production refuses to boot with default `JWT_SECRET` / zero `ENCRYPTION_KEY` |
| Outbound | Automation webhooks: HTTPS only, DNS-resolved target must be public (blocks loopback, RFC1918, link-local/metadata) |
| Inbound webhooks | WhatsApp payloads verified with HMAC-SHA256 (`WHATSAPP_APP_SECRET`) and the verify-token handshake |
| Audit | `audit_log` table (application-level; not DB-enforced immutable) of create/update/delete/login/permission changes with actor, entity and diff |
| Money integrity | Ledger rejects unbalanced journals; idempotent POD/expense sync via `client_id` |

## Operator responsibilities

1. Generate `JWT_SECRET` and `ENCRYPTION_KEY` (`openssl rand -hex 32`); store in a secret manager. Rotating `ENCRYPTION_KEY` requires re-entering integration credentials.
2. Delete or re-password the seeded demo users (`Demo@12345!`) — never run `db:seed` against production.
3. Terminate TLS in front of the app (load balancer / platform) and set `WEB_ORIGIN` / `PUBLIC_WEB_URL` to the HTTPS origin.
4. Put uploads on S3-compatible storage (`STORAGE_DRIVER=s3`) with private buckets; local disk is single-node only.
5. Enable database backups with point-in-time recovery; restrict DB network access.
6. Ship logs (pino JSON) to a store with alerting; watch for repeated 401/429s.

## Known limits / not done

* No MFA/SSO yet (WorkOS/OIDC is the intended route — see ADR-0003).
* Access tokens are bearer JWTs kept in memory/localStorage by the SPA; XSS would expose them. CSP is the mitigation; httpOnly-cookie sessions are a future hardening.
* Uploaded files are not virus-scanned.
* Rate limiting is per-process memory; behind multiple replicas use a shared store or edge limiter.
* No independent penetration test has been performed.

Report vulnerabilities privately to the maintainers rather than via public issues.
