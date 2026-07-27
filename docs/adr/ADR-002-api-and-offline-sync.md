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

### Which mutations may be queued offline (decided 2026-07-26)
A queued mutation replays minutes-to-days later; whether that replay is safe
depends on what the mutation can clobber, so mutations fall into three classes:
1. **Replay-safe creates** — plain POSTs carrying an `Idempotency-Key`, no
   revision to go stale (e.g. inbox capture). Queue freely.
2. **Rebase-on-replay status changes** — complete / uncomplete / skip. The
   queue entry carries **no pinned revision**; at flush time the client GETs
   the resource, uses the *fresh* `revision` as `If-Match`, and replays. This
   is safe precisely because a status-only patch touches no other field group
   — under LWW-per-field-group it cannot clobber a concurrent edit, and
   completion conflicts already resolve by `planner_events` ordering (above).
   A 404 on the re-read (deleted while offline) is terminal → conflict UI.
   A 409 on the replay retries (the next flush re-reads again). The server
   endpoint MUST honor `Idempotency-Key` so a replay whose response was lost
   cannot double-apply.
3. **Never queued** — general field edits, checklist overrides, deletes, and
   anything focus-session (server-authoritative). These require a live
   `If-Match` against the revision the user actually saw; replaying them later
   could silently overwrite another device's edits. They fail honestly while
   offline until a real merge UI exists.

## Caching rules (Next.js cacheComponents)
- All user data responses `Cache-Control: private, no-store`.
- `use cache` never wraps user-scoped queries unless the cache key provably
  includes the user id; DAL is `server-only`; no DB/auth imports in Client
  Components. Static/marketing content may cache freely.
