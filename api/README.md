# Kairo API

The OpenAPI 3.1 contract for the Kairo REST + JSON API, served under
`/api/v1`. This is the single source of truth shared by the **web** client
(Phase 1A onward) and the **iOS** client (Phase 7).

It conforms to:

- **ADR-002 — API contract & offline sync protocol** (binding): standard
  error envelope, `Idempotency-Key`, `If-Match`/`ETag`-style revisions,
  cursor pagination, `/batch`, `/changes` feed, tombstones, RFC 3339
  instants + date-only formats, closed enums, UUIDv7 ids.
- **ADR-001 — Temporal model & recurrence**: `/day/{date}?tz=`, edit scopes
  (`this` / `this_and_future` / `all`), series + occurrence model, task
  buckets and "Schedule".
- **ADR-004 — Focus timer**: server-authoritative focus-session state
  machine.

Field names in JSON are camelCase, mirroring
[`src/server/db/schema.ts`](../src/server/db/schema.ts) (the source of truth
for field names and types).

## Files

- [`openapi.yaml`](./openapi.yaml) — the spec itself.

## Servers

- Production: `https://time.neima.me/api/v1`
- Staging: `https://time-staging.neima.me/api/v1`

Because the server URLs already include `/api/v1`, all paths in the spec are
relative (e.g. `/day/{date}`, `/activities/{id}`).

## Conventions

- **Auth:** `cookieAuth` (Better Auth session cookie, ADR-003) is the only
  scheme for now; bearer tokens arrive in Phase 7. Every endpoint requires
  an authenticated session.
- **Conditional writes:** PATCH/DELETE SHOULD send `If-Match: <revision>`.
  A stale revision returns **409 Conflict** with the current server state in
  `error.details`.
- **Idempotency:** POST/PATCH/DELETE/PUT SHOULD send a client-generated
  `Idempotency-Key` (UUID). The server replays the original response within
  a 48h window.
- **Deletes** are tombstones (`deleted_at`), retained ≥30 days, surfaced in
  the `/changes` feed with `op=delete`.
- **Pagination** is cursor-based (`?cursor=&limit=`); cursors are opaque.
- **Errors** use the envelope `{ error: { code, message, details?, retryable } }`.
- **Security (SEC-01):** cross-user resource access returns **404** to avoid
  enumeration.
- **Caching:** all user-data responses are `Cache-Control: private, no-store`.

## Validating the spec

No YAML parser is bundled. To sanity-check the file parses, use one of:

```bash
# Node (lint only — confirms the file is readable):
node -e "const yaml=require('fs').readFileSync('api/openapi.yaml','utf8'); console.log('bytes:', yaml.length)"

# Redocly CLI (validates against OpenAPI 3.1):
npx @redocly/cli@latest lint api/openapi.yaml

# Swagger CLI:
npx @apidevtools/swagger-cli@latest validate api/openapi.yaml
```

CI runs a stricter check: the **contract-parity** test below fails the build
on any drift between the spec, the zod registry, and the route handlers.

## Contract parity (zod ↔ OpenAPI)

The spec is paired with a zod validator registry under
`src/server/schemas/`. Each named component schema in `openapi.yaml`
(`Error`, `ErrorEnvelope`, `Category`, `Tag`, `Task`, `ActivitySeries`,
`ActivityOccurrence`, `ChecklistItem`, `Routine`, `RoutineStep`,
`RoutineSchedule`, `FocusSession`, `PlannerEvent`, `UserSettings`,
`BatchRequest`, `BatchOperation`, `BatchResponse`, `BatchResult`,
`ChangeLogEntry`, `ChangesResponse`, `DayResponse`) must have a zod
validator with the **same name** and a matching shape (required fields,
closed enums, nullable fields, formats).

The drift-detection test lives at:

- [`src/server/schemas/contract-parity.test.ts`](../src/server/schemas/contract-parity.test.ts)

It is part of the default `npm test` run (Vitest) and is enforced in CI.
Adding a field to a schema without updating both the zod validator and the
OpenAPI component will fail the build.

## Swift codegen (Phase 7A)

The iOS client is generated from this spec in Phase 7A. The toolchain is
pinned there (per ADR-002, **not** the deprecated `swift5` generator).
Generated types take the same names as the component schemas above; the
parity test keeps the two sides from drifting.
