# Canonical Activity Edit Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make canonical activity PATCH operations preserve complete recurrence masters, enforce nested ownership atomically, emit complete sync changes, and return the master clients must continue editing.

**Architecture:** Keep the existing route and recurrence-service boundary. Export the DAL's nested-reference assertion, make every master edit transactional inside the recurrence service, return a small mutation result identifying the affected master, and validate/coerce transport fields at the route edge.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM/PostgreSQL, Zod, Vitest, Playwright.

---

## File map

- Modify `src/server/dal/index.ts`: export the existing category/tag ownership assertion for reuse by recurrence mutations.
- Modify `src/server/services/recurrence.ts`: add the mutation result contract, transactional ownership checks, full successor inheritance, optimistic predecessor update, and complete change logging.
- Modify `src/server/services/recurrence.test.ts`: PostgreSQL integration coverage for inheritance, identity, sync, and cross-user rollback.
- Modify `src/app/api/v1/activities/[id]/route.ts`: validate headers, coerce EXDATE, and return the actual affected master.
- Modify `src/app/api/v1/activities/[id]/route.test.ts`: route contract coverage for PATCH validation, coercion, response identity, and ETag.
- Modify `src/components/ActivityEditor.tsx`: make whole-series deletion explicit.
- Modify `api/openapi.yaml` and `ios/Kairo/Sources/Kairo/openapi.yaml`: expose scoped-delete occurrence identity.
- Modify `src/server/shipping-idempotency.test.ts`: pin imported-calendar tombstone rejection.
- Modify `e2e/core-loop.spec.ts` and `e2e/offline-replay.spec.ts`: wait for server persistence and initialize direct IndexedDB fixtures.
- Modify `docs/plans/2026-07-12-kairo-roadmap.md`: record the completed production-hardening slice without changing parity scope.
- Modify `docs/plans/progress.md`: add Round 55 implementation, verification, release, and remaining-boundary evidence.

### Task 1: Pin canonical split and ownership failures

**Files:**
- Modify: `src/server/services/recurrence.test.ts`

- [x] **Step 1: Add a complete-master split test**

Create owned category/tag rows, a series populated with every canonical field, and an occurrence override at the split key. Call `editSeriesOccurrence(..., "this_and_future", { title: "Updated", priority: "low" }, ...)`, then assert the returned `seriesId` identifies a revision-1 successor whose inherited fields match the predecessor and whose patched fields changed. Assert the override moved to that identifier with its original `occurrenceKey`.

```ts
const result = await editSeriesOccurrence(
  userId,
  series.id,
  splitKey,
  "this_and_future",
  { title: "Updated", priority: "low" },
  series.revision,
  { db: env!.db },
);
expect(result).toMatchObject({ seriesId: expect.any(String), revision: 1 });
expect(successor).toMatchObject({
  id: result.seriesId,
  title: "Updated",
  priority: "low",
  categoryId,
  tags: [tagId],
  checklistTemplate,
  source: "calendar",
  sourceRef: "provider-42",
});
```

- [x] **Step 2: Pin both sync-feed entries**

Query `change_log` for the predecessor and successor after the split. Assert the predecessor has an `upsert` at revision 2 and the successor has an `upsert` at revision 1.

- [x] **Step 3: Add atomic cross-owner tests**

For `all` and `this_and_future`, try a foreign category and foreign tag. Assert `NotFoundError`, then assert the original master revision/RRULE are unchanged, no successor exists, and no additional change-log row was written.

- [x] **Step 4: Run the focused tests and verify RED**

Run: `pnpm test -- src/server/services/recurrence.test.ts`

Expected: failures show the void result, missing inherited fields/change log, or accepted cross-user references.

### Task 2: Make recurrence mutations canonical and atomic

**Files:**
- Modify: `src/server/dal/index.ts`
- Modify: `src/server/services/recurrence.ts`
- Test: `src/server/services/recurrence.test.ts`

- [x] **Step 1: Export the shared ownership assertion**

Change the existing declaration to:

```ts
export async function assertOwnedActivityReferences(
  db: Db,
  userId: string,
  categoryId?: string,
  tags?: string[],
): Promise<void> {
```

- [x] **Step 2: Define the mutation result and full successor snapshot**

Add:

```ts
export interface ActivityEditResult {
  seriesId: string;
  revision: number;
}

type ActivitySeriesRow = typeof schema.activitySeries.$inferSelect;

function inheritedSeriesValues(series: ActivitySeriesRow) {
  return {
    tz: series.tz,
    dtstartLocal: series.dtstartLocal,
    rrule: series.rrule,
    exdate: series.exdate,
    rdate: series.rdate,
    title: series.title,
    emoji: series.emoji,
    categoryId: series.categoryId,
    durationMin: series.durationMin,
    checklistTemplate: series.checklistTemplate,
    energy: series.energy,
    priority: series.priority,
    tags: series.tags,
    notes: series.notes,
    source: series.source,
    sourceRef: series.sourceRef,
  };
}
```

- [x] **Step 3: Return the original master for occurrence-only edits**

After the occurrence upsert, return `{ seriesId: series.id, revision: series.revision }`. Preserve occurrence change logging.

- [x] **Step 4: Implement a complete transactional split**

Inside one transaction, build `successor = { ...inheritedSeriesValues(series), dtstartLocal: occurrenceKey, ...patch }`, validate its effective category/tags, update the predecessor using `revision = series.revision` and `deletedAt IS NULL` in the predicate, append its revision-2 change, insert and append the successor revision-1 change, move the overrides with both `seriesId` and `userId` predicates, and return the successor result.

- [x] **Step 5: Make all-scope ownership and update atomic**

Inside one transaction, validate `categoryId`/`tags` only when those keys are present, update using the expected-revision predicate, distinguish not-found from conflict through `getActivitySeries`, append the change, and return the updated result.

- [x] **Step 6: Run focused recurrence tests and verify GREEN**

Run: `pnpm test -- src/server/services/recurrence.test.ts src/server/services/recurrence-patch.test.ts src/server/activity-create.test.ts`

Expected: all focused tests pass against PostgreSQL.

### Task 3: Pin and harden the PATCH transport contract

**Files:**
- Modify: `src/app/api/v1/activities/[id]/route.test.ts`
- Modify: `src/app/api/v1/activities/[id]/route.ts`

- [x] **Step 1: Add failing route tests**

Import `PATCH` and add tests that assert:

```ts
expect(await patch({ ifMatch: "NaN" })).toHaveStatus(400);
expect(await patch({ ifMatch: "0" })).toHaveStatus(400);
expect(await patch({ idempotencyKey: "not-a-uuid" })).toHaveStatus(400);
expect(mocks.editSeriesOccurrence).not.toHaveBeenCalled();
```

Add a canonical split test where the service resolves `{ seriesId: "successor-id", revision: 1 }`; assert EXDATE becomes midnight-UTC `Date` values, `getActivitySeries` is called for the successor, the JSON body is the successor, and ETag is `1`.

- [x] **Step 2: Run route tests and verify RED**

Run: `pnpm test -- 'src/app/api/v1/activities/[id]/route.test.ts'`

Expected: malformed headers reach mutation and split returns the predecessor.

- [x] **Step 3: Add small header parsers at the route edge**

Use the shared `uuid` schema and a local positive-integer parser:

```ts
function parseRevision(value: string): number | null {
  return /^[1-9]\d*$/.test(value) ? Number(value) : null;
}
```

Return a private `400 bad_request` for malformed values before `withIdempotency` or mutation.

- [x] **Step 4: Coerce EXDATE and use the service result**

Convert a non-null EXDATE array with `new Date(`${date}T00:00:00.000Z`)`. Capture the edit result, write planner history against `result.seriesId`, load `result.seriesId`, and return that master plus its revision ETag.

- [x] **Step 5: Run route and focused service tests and verify GREEN**

Run: `pnpm test -- 'src/app/api/v1/activities/[id]/route.test.ts' src/server/services/recurrence.test.ts src/server/services/recurrence-patch.test.ts src/server/activity-create.test.ts`

Expected: all tests pass.

### Task 4: Documentation, browser regression, and repository gates

**Files:**
- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/progress.md`

- [x] **Step 1: Update roadmap and progress evidence**

Record Round 55 as a completed production-hardening slice. Include exact focused/full test totals, browser evidence paths, SHAs, CI run, deployment UUID, and live-health response as each becomes available. Keep Phase 7B and Phase 8B explicitly external and pending.

- [x] **Step 2: Run the existing editor in a real browser**

Start `pnpm dev` on an unused worktree port with local synthetic data. Exercise create/edit at desktop and 390px mobile widths, verify the edited activity remains visible after reload, inspect console/network errors, and save screenshots under ignored `browser-qa/round55-activity-edit/`.

- [x] **Step 3: Run all local gates**

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e
node scripts/parity.mjs
./scripts/ios-main-thread-gate.sh
pnpm ios:release:preflight
```

Expected: every required gate passes; parity does not regress.

- [x] **Step 4: Review the final diff**

Confirm only the planned files changed, no raw design-token violations or generated QA artifacts are tracked, and all mutation predicates remain user-scoped.

- [x] **Step 5: Commit the completed tranche**

```bash
git add docs/plans/2026-08-01-round55-canonical-activity-edit-design.md \
  docs/plans/2026-08-01-round55-canonical-activity-edit-implementation.md \
  docs/plans/2026-07-12-kairo-roadmap.md docs/plans/progress.md \
  src/server/dal/index.ts src/server/services/recurrence.ts \
  src/server/services/recurrence.test.ts \
  'src/app/api/v1/activities/[id]/route.ts' \
  'src/app/api/v1/activities/[id]/route.test.ts'
git commit -m "fix: harden canonical activity edits"
```

### Task 5: Integrate, release, and verify production

- [ ] **Step 1: Integrate the reviewed commit into `main`**

Use the repository's existing fast-forward or cherry-pick release flow without overwriting unrelated changes. Re-run the focused tests after integration.

- [ ] **Step 2: Push `main` and wait for exact-SHA CI**

Push to `origin/main`, follow the CI run for the pushed SHA, and require every job to pass.

- [ ] **Step 3: Deploy the exact SHA through Coolify**

Follow `docs/DEPLOYMENT.md`. Record the Coolify deployment UUID and require the deployment to finish at the same SHA.

- [ ] **Step 4: Verify live health and shipped code**

Check `https://time.neima.me/api/health`, signed-out landing/editor status, security headers, and a shipped-JavaScript marker unique to this tranche. Do not mutate Neima's production planner.

- [ ] **Step 5: Commit and push final release evidence**

Update `docs/plans/progress.md` with exact CI/deploy/live proof, run documentation checks, commit the evidence, push it, and verify the evidence SHA's CI/deployment if the app bundle changed.
