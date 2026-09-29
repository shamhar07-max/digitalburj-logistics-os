# ADR-0003: JWT access + rotating refresh tokens; SSO later

**Status:** accepted

**Decision:** 15-minute bearer access tokens, hashed rotating refresh tokens, per-request user/role reload so permission changes and deactivation take effect immediately.

**Consequences:** + stateless API, simple mobile/driver client. − tokens live in browser storage (XSS exposure; mitigated by CSP). Enterprise SSO/MFA is not implemented; the intended path is an OIDC/WorkOS front door that mints the same session.
