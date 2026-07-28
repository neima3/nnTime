# Round 17 Offline Mutation Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete ADR-002 web offline mutation adoption without making unsafe delayed writes possible, and make every terminal replay conflict visible until acknowledged.

**Architecture:** Add a typed, allowlisted delivery layer in front of the existing IndexedDB replay engine. Product surfaces use only replay-safe create or status-change helpers; the app shell owns durable queue status, conflict copy, and post-drain refresh.

**Tech Stack:** Next.js 16, React 19, TypeScript, IndexedDB, Vitest, Playwright, Better Auth, ADR-002 REST semantics.

---

## Execution status

- [x] Task 1 — typed offline delivery policy and red/green unit coverage
- [ ] Task 2 — durable queue summaries, dismissal, and shell conflict UX
- [ ] Task 3 — migrate the existing working paths and add an adoption gate
- [ ] Task 4 — adopt every fully local replay-safe create/status surface
- [ ] Task 5 — production-mode browser proof and adversarial review
- [ ] Task 6 — full verification, handoff, exact-SHA release, and live proof

## Task 1 — Server idempotency prerequisite and typed offline delivery policy

**Files**

- Modify: `src/app/api/v1/routines/route.ts`
- Modify: `src/app/api/v1/routines/route.test.ts`
- Modify: `src/server/shipping-idempotency.test.ts`
- Create: `src/lib/offline-mutation.ts`
- Create: `src/lib/offline-mutation.test.ts`
- Modify: `src/lib/offline-queue.ts`

### Steps

- [ ] Write a failing routine route test requiring the canonical
  `Idempotency-Key` header to flow through `withIdempotency`, and requiring
  `createRoutine(..., { db })` inside the callback.
- [ ] Add a failing PostgreSQL integration test that calls `withIdempotency`
  twice around `createRoutine` with steps and a schedule, then proves one
  routine bundle exists, the replay header is true, and the callback executed
  once.
- [ ] Run both focused tests and verify RED because the route currently ignores
  the documented header.
- [ ] Wrap routine POST in `withIdempotency`, pass its transaction database to
  the DAL, and run both tests to GREEN.
- [ ] Write failing tests for:
  - immediate `2xx` delivery with one `Idempotency-Key`;
  - non-retryable `4xx` passthrough;
  - offline/network/`429`/`5xx` queue fallback with the same key;
  - `unavailable` when IndexedDB persistence fails;
  - create-path allowlist rejection;
  - status-path and status-body allowlist rejection;
  - status replay entries carrying `rebasePath` but no pinned `If-Match`.
- [ ] Run `pnpm vitest run src/lib/offline-mutation.test.ts`; verify RED because
  the module does not exist.
- [ ] Implement:

```ts
export type OfflineDelivery =
  | { state: "server"; response: Response }
  | { state: "queued" }
  | { state: "unavailable" };

export async function sendReplaySafeCreate(input: {
  path: ReplaySafeCreatePath;
  body: unknown;
}): Promise<OfflineDelivery>;

export async function sendRebasedStatusChange(input: {
  path: `/api/v1/activities/${string}`;
  body: RebasedActivityStatusBody;
  onlineRevision?: number;
}): Promise<OfflineDelivery>;
```

  using a dependency-injected internal executor for deterministic unit tests.
- [ ] Make raw queue construction private to the offline modules; retain
  `executeMutation` as a testable replay boundary.
- [ ] Run focused tests to GREEN, then `pnpm typecheck`.

## Task 2 — Durable conflict state and shell UX

**Files**

- Modify: `src/lib/offline-queue.ts`
- Modify: `src/lib/offline-queue.test.ts`
- Modify: `src/components/OfflineIndicator.tsx`
- Create: `src/components/OfflineIndicator.test.ts`

### Steps

- [ ] Write failing queue tests proving:

```ts
await getQueueSummary("user-a")
// => { pending: 1, terminal: 1 }

await dismissTerminalMutations("user-a")
// removes user-a terminal rows only; pending rows and user-b rows remain
```

- [ ] Write a failing source/behavior test requiring `OfflineIndicator` to:
  listen for `kairo:queue-changed`, `kairo:queue-drained`, and
  `kairo:conflict`; call `router.refresh()` on drain; render the exact
  server-version conflict copy; and expose an accessible Dismiss button.
- [ ] Run the focused tests and verify RED for the missing APIs/UI.
- [ ] Add one queue-change dispatcher used after enqueue, state transition,
  success removal, and dismissal.
- [ ] Replace pending-only polling with `getQueueSummary`, load terminal state
  on mount, refresh after drain, and dismiss terminal rows through the queue
  API.
- [ ] Run focused tests to GREEN and verify `pnpm lint`.

## Task 3 — Existing path migration and adoption gate

**Files**

- Modify: `src/components/QuickCapture.tsx`
- Modify: `src/components/TodayTimeline.tsx`
- Create: `src/lib/offline-mutation-adoption.test.ts`

### Steps

- [ ] Write a failing adoption test that reads the two current working
  components and rejects imports/calls to raw `enqueueMutation`.
- [ ] Replace Quick Capture's manual online/offline fork with
  `sendReplaySafeCreate`. Preserve:
  - queued success copy;
  - sign-in copy on a real 401;
  - undo only when a server response supplies id/revision;
  - the user's input when delivery is `unavailable`.
- [ ] Replace Today complete/uncomplete's manual queue branch with
  `sendRebasedStatusChange`, retaining optimistic offline state and the online
  response/conflict behavior.
- [ ] Run focused tests and the existing production-mode offline E2E.

## Task 4 — Full eligible-surface adoption

**Files**

- Modify: `src/components/ActivityEditor.tsx`
- Modify: `src/components/InboxClient.tsx`
- Modify: `src/components/ReviewClient.tsx`
- Modify: `src/components/StatsClient.tsx`
- Modify: `src/components/RoutinesClient.tsx`
- Modify: `src/components/PeakFocusNudge.tsx`
- Modify: `src/components/QuickCapture.tsx`
- Modify: `src/lib/offline-mutation-adoption.test.ts`

### Steps

- [ ] Extend the adoption test with one named expectation per eligible call
  site. Verify RED before each migration batch.
- [ ] Migrate creates in Activity Editor, Inbox, Stats mood, Routines, Peak
  Focus, and confirmed Quick Capture proposals.
- [ ] Migrate Review Today complete/skip to the rebased status helper.
- [ ] For `queued`, clear only inputs that are durably stored and show
  surface-specific “saved on this device” copy.
- [ ] For `unavailable`, preserve form input and show copy that the change was
  not saved.
- [ ] Keep unsafe mutations direct and online-only. Add source assertions that
  deletes, focus transitions, checklist overrides, general edits, imports, and
  promotions never call the offline helper.
- [ ] Run focused tests after each surface batch, then all Vitest tests.

## Task 5 — Browser proof and review

**Files**

- Modify: `e2e/app.spec.ts`
- Create: `browser-qa/round17-offline-integrity/` evidence (git-ignored)

### Steps

- [ ] Add a failing production-mode Playwright test that:
  - authenticates a synthetic local tenant;
  - queues an inbox create while offline;
  - reconnects and observes the queued count clear and the item render;
  - queues a Today completion offline and observes server convergence;
  - injects a terminal replay response;
  - reloads and still sees the safe server-version conflict copy;
  - dismisses it and confirms it does not return.
- [ ] Run the focused test against `pnpm start`; verify RED before
  implementation-dependent assertions are satisfied.
- [ ] Fix only defects revealed by the E2E, using focused red/green cycles.
- [ ] Capture and visually inspect desktop 1440×1000 and mobile 390×844 queue
  and conflict states; save screenshots under the ignored evidence directory.
- [ ] Request adversarial review against ADR-002 and this design. Verify every
  finding against current code, fix all Critical/Important issues test-first,
  and re-run focused proof.

## Task 6 — Verification, handoff, and release

**Files**

- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/parity-checklist.md` only if evidence changes a score
- Modify: `docs/plans/progress.md`
- Modify: this plan's execution status
- Create: `docs/plans/2026-07-28-round17-offline-integrity-prompt.md`

### Steps

- [ ] Run:
  `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [ ] Run:
  `pnpm api:check-ios && pnpm api:check-ios-adoption &&
  node scripts/parity.mjs`.
- [ ] Run production-mode Playwright, Swift package tests, app-hosted native
  tests, unsigned simulator build, and the serial native UI suite because the
  repository release gate covers both clients.
- [ ] Record exact counts, screenshots, review disposition, parity, and the
  remaining external authenticated-production-read limitation.
- [ ] Commit the immutable handoff, integrate without discarding unrelated
  work, push `main`, and wait for all exact-SHA GitHub Actions jobs.
- [ ] Wait for the exact-SHA Coolify deployment to be `finished` and
  `running:healthy`.
- [ ] Verify production read-only: health checks, security headers, unique
  deployed bundle marker, signed-out authorization boundary, desktop/mobile
  UI, and console. Do not mutate production planner or mood data.

## Definition of done

- Every fully local ADR-002 replay-safe create/status surface uses the typed
  delivery boundary.
- Unsafe delayed mutations are rejected by types, runtime validation, and the
  adoption test.
- Retryable failures preserve one logical idempotency key.
- Terminal conflicts survive reload, disclose the server-version outcome, and
  disappear only after acknowledgment.
- Queue drain refreshes rendered server truth.
- Local, CI, native, production-mode E2E, exact-SHA deploy, and read-only live
  evidence are green and recorded.
