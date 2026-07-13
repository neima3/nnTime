# ADR-002 — API contract & offline sync protocol

Status: **Accepted** (2026-07-12). Binding on web AND iOS clients.

## Contract source of truth
- `api/openapi.yaml` (OpenAPI 3.1), committed, versioned under `/api/v1`.
  zod validators are checked against it in CI; Swift client generated from it
  (toolchain pinned in Phase 7A; not the deprecated swift5 generator).
  CI fails on drift between spec, zod, and handlers.
- Formats: instants RFC 3339 UTC (`date-time`), day values `date`, enums
  closed, IDs UUIDv7. Standard error envelope
  `{error: {code, message, details?, retryable: bool}}`. Cursor pagination
  (`?cursor=&limit=`).
- Server components call the same server-only service layer as route handlers
  — never self-HTTP, never duplicated business rules.

## Mutation semantics (defined in Phase 1, before any optimistic UI)
- Every user-owned row: monotonic integer `revision`.
- Conditional writes: `If-Match: <revision>` (or body field) — mismatch → 409
  with current server state; client rebases or surfaces conflict.
- `Idempotency-Key` header (client-generated UUID per logical mutation);
  server stores keys 48h and replays the original result on retry.
- Deletes are tombstones (`deleted_at`), retained ≥30 days, surfaced in the
  changes feed. Hard deletion only via account-deletion cascade.
- Batch endpoint `POST /api/v1/batch`: ordered operations, ordered results,
  each result independently retryable/terminal.
- Incremental sync: `GET /api/v1/changes?cursor=` returns rows (including
  tombstones) ordered by a per-user change sequence + next cursor. Day
  snapshots are for rendering, not sync.

## Conflict policy
- Default: last-write-wins per FIELD group at the server given a valid
  revision; stale revision → 409, client must rebase.
- Completion state conflicts resolve via planner_events ordering (an
  uncomplete after a complete wins by occurred_at).
- Focus sessions: server-authoritative (ADR-004); clients never merge.
- Unresolvable client-queue conflicts surface explicit UI ("kept server
  version / your change saved as…"), never silent drops.

## Offline clients (web PWA Phase 6, iOS Phase 7C — same protocol)
- Queue of mutations with idempotency keys, replayed in order on reconnect;
  429/5xx retry with backoff, 4xx terminal → conflict UI.
- Caches and IndexedDB/local stores are **user-scoped** (key prefix = user
  id), never store auth responses, and are purged on logout/account switch.
  iOS local store uses an appropriate data-protection class.

## Caching rules (Next.js cacheComponents)
- All user data responses `Cache-Control: private, no-store`.
- `use cache` never wraps user-scoped queries unless the cache key provably
  includes the user id; DAL is `server-only`; no DB/auth imports in Client
  Components. Static/marketing content may cache freely.
