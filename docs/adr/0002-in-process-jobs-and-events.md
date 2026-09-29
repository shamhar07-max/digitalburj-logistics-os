# ADR-0002: In-process events and scheduler, no broker

**Status:** accepted

**Decision:** Domain events fan out in-process to the WebSocket hub, automations and notifications. Periodic jobs run in the API process under a Postgres advisory lock. No Redis/queue.

**Consequences:** + one container and one database to run. − WebSocket delivery is per-instance (a client only hears events emitted on its own replica) and heavy jobs share CPU with requests. When running multiple replicas or heavy async work, introduce Postgres `LISTEN/NOTIFY` or Redis pub/sub for cross-instance fan-out and a job worker (e.g. pg-boss) — the event bus interface is the seam.
