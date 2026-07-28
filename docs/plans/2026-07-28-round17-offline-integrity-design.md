# Round 17 Offline Mutation Integrity — Design

**Status:** Accepted from existing binding contracts. This is a completion fix
for ADR-002 and Phase 6B, not a new product-policy decision.

## Problem

Kairo has a durable IndexedDB mutation queue with idempotent replay, fresh
revision rebasing, retry/backoff, user scoping, and logout purge. The queue is
sound, but adoption is opt-in at individual call sites:

- Quick Capture queues one inbox-task create.
- Today queues one activity complete/uncomplete path.
- Other fully local replay-safe creates and status-only changes call `fetch`
  directly and fail on network loss.
- `flushQueue` emits `kairo:conflict` and `kairo:queue-drained`, but the app
  shell does not consume either event. Terminal conflicts survive in
  IndexedDB without a persistent acknowledgment UI.
- Each call site independently decides eligibility, headers, idempotency, and
  copy, so future code can accidentally queue an unsafe mutation or omit a
  safe one.

This contradicts the shipped Phase 6B claim and ADR-002's requirement that
eligible writes replay in order and terminal conflicts are explicit.

## Goals

1. Make ADR-002 mutation eligibility executable in one client module.
2. Queue eligible actions when already offline, after a network exception, or
   after a retryable `429`/`5xx`, reusing one idempotency key for the original
   attempt and replay.
3. Keep general field edits, deletes, checklist edits, focus mutations,
   imports, and multi-resource operations live-only.
4. Persist terminal conflicts until the user explicitly dismisses them.
5. Refresh server-rendered product state after queued writes drain.
6. Cover every currently mounted, fully local replay-safe create/status
   surface and fail CI if those call sites regress to direct mutation fetches.

## Non-goals

- No general offline database or optimistic entity-ID synthesis.
- No queued deletes, focus transitions, calendar imports, push subscriptions,
  settings edits, checklist overrides, or drag/resize.
- No automatic merge UI. ADR-002's current policy keeps the server version for
  terminal conflicts and reports that outcome honestly.
- No production planner mutation during release verification.

## Architecture

### 1. Typed delivery boundary

`src/lib/offline-mutation.ts` exposes two operations:

- `sendReplaySafeCreate` accepts only the allowlisted create endpoints:
  `/api/v1/tasks`, `/api/v1/activities`, `/api/v1/routines`, and
  `/api/v1/mood`.
- `sendRebasedStatusChange` accepts only an activity resource path and a body
  whose keys are limited to `editScope`, `occurrenceKey`, `status`, and
  `completedAt`.

Both generate one UUID, use it as `Idempotency-Key` for the immediate request,
and preserve it if the same logical mutation enters the queue. They return a
discriminated result:

```ts
type OfflineDelivery =
  | { state: "server"; response: Response }
  | { state: "queued" }
  | { state: "unavailable" };
```

`unavailable` means no live delivery and no safe local persistence; callers
must retain the user's input and show honest copy.

The audit found that canonical OpenAPI already declares `Idempotency-Key` for
routine creation, but the web route ignores it. Round 17 first brings
`POST /api/v1/routines` into contract with `withIdempotency` and passes the
transaction-scoped database handle into `createRoutine`. The routines endpoint
does not enter the client allowlist until that server proof is green.

### 2. Durable queue state

`src/lib/offline-queue.ts` remains the persistence/replay engine. It adds:

- `getQueueSummary(userId)` for pending and terminal counts;
- `dismissTerminalMutations(userId)` to acknowledge and remove terminal rows;
- a `kairo:queue-changed` event after enqueue, retry-state changes, success,
  terminal transition, and dismissal.

The raw enqueue function becomes an internal mechanism. Product call sites use
the typed delivery boundary, which is the only module allowed to construct new
queued mutations.

### 3. Shell-level recovery UI

`OfflineIndicator` becomes the single global queue status surface:

- offline state and pending count;
- persistent terminal-conflict notice loaded from IndexedDB on mount;
- explicit copy: “A saved offline change couldn’t sync. Kairo kept the server
  version.”;
- “Dismiss” acknowledges all currently terminal mutations;
- queue drain triggers `router.refresh()` so server components adopt replayed
  truth.

No mutation body, title, note, or endpoint is displayed, avoiding accidental
personal-data exposure.

### 4. Adoption scope

The typed helper replaces eligible direct fetches in:

- Quick Capture: plain inbox creates and confirmed AI-proposal creates;
- Activity Editor: new activity creation only;
- Inbox: new task creation only;
- Today: complete/uncomplete;
- Review Today: complete/skip;
- Stats: mood check-in creation;
- Routines: new routine creation;
- Peak Focus Nudge: recurring focus-block creation.

Online-dependent flows such as templates and “copy yesterday” remain
live-only because they require fresh server reads to construct the mutation.
Unsafe edits retain their existing online-only behavior.

## Error handling

- `2xx`: return the real response.
- Non-retryable `4xx`: return the real response so existing validation/auth
  copy remains authoritative.
- `429` or `5xx`: enqueue the same logical mutation with the same idempotency
  key.
- Network exception/offline: enqueue.
- IndexedDB unavailable: return `unavailable`; never pretend the change was
  saved.
- Rebase read `404/410`: terminal conflict.
- Rebase replay `409`: retryable; the next attempt re-reads revision.
- Other `4xx`: terminal conflict persisted until acknowledgment.

## Verification

- Route and PostgreSQL integration tests prove routine creation replays one
  atomic routine/steps/schedule result for one idempotency key.
- Unit tests drive every delivery transition and reject unsafe paths/bodies.
- Queue tests prove terminal summaries survive reload and dismissal removes
  only the signed-in user's terminal rows.
- An adoption test scans the named product surfaces and rejects direct
  replay-safe mutation fetches.
- Playwright production-mode E2E queues a create and a status change offline,
  reconnects, observes drain/refresh, injects a terminal conflict, and verifies
  persistent safe copy plus dismissal.
- Full lint, typecheck, Vitest, build, OpenAPI/native adoption, parity, native
  package/app gates, desktop/mobile browser QA, exact-SHA CI, Coolify deploy,
  and read-only production proof remain required.
