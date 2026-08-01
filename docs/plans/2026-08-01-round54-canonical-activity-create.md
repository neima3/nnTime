# Round 54 Canonical Activity Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ordinary activity creation preserve the complete canonical API body, reject cross-user category/tag references atomically, and remove the editor's category-loading save race without weakening offline creation.

**Architecture:** Keep `/api/v1/activities` as the canonical mutation boundary and pass every `activitySeriesCreate` field into the idempotency-locked DAL transaction. Centralize owned category/tag validation so both ordinary creation and Inbox conversion use the same ADR-005 checks. Resolve editor category IDs from server-seeded authenticated data on first render, while retaining the client request as a refresh path.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Drizzle ORM/PostgreSQL, Vitest, Playwright.

---

## Root cause and binding constraints

- `activitySeriesCreate` accepts `exdate`, `rdate`, `tags`, and `sourceRef`, but `src/app/api/v1/activities/route.ts` does not forward them and `createActivitySeries` cannot persist them.
- `createActivitySeries` inserts `categoryId` without validating active ownership and does not validate tag IDs, violating ADR-005's nested-resource ownership rule.
- `ActivityEditor` begins with an empty category list. A user can select a category and save before `/api/v1/categories` resolves, producing no `categoryId`.
- ADR-002 requires UUID idempotency keys, complete canonical mutation semantics, and `Cache-Control: private, no-store` on user data.
- Offline create remains replay-safe. Save must not be disabled merely because a refresh request is delayed or unavailable.

## File map

- Modify `src/server/dal/index.ts`: shared category/tag ownership assertion; complete canonical activity insert.
- Create `src/server/activity-create.test.ts`: ephemeral-Postgres coverage for canonical fields and atomic cross-user rejection.
- Modify `src/app/api/v1/activities/route.ts`: UUID header validation, complete field transforms/forwarding, no-store response.
- Create `src/app/api/v1/activities/route.test.ts`: route-edge contract coverage.
- Modify `src/app/app/editor/page.tsx`: authenticate and load categories for every editor render.
- Modify `src/components/ActivityEditor.tsx`: accept and initialize from server categories, preserving client refresh.
- Create `src/components/activity-editor-categories.test.ts`: source contract that pins server hydration and fallback refresh.
- Create `e2e/activity-editor-categories.spec.ts`: real-browser immediate
  category-save regression.
- Modify `docs/plans/2026-07-12-kairo-roadmap.md` and `docs/plans/progress.md`: record Round 54 implementation and proof.

### Task 1: Pin canonical DAL behavior with failing database tests

- [x] Create `src/server/activity-create.test.ts` using `createEphemeralDb`, two users, owned/cross-owned categories and tags.
- [x] Assert one successful `createActivitySeries` call persists `exdate`, `rdate`, `tags`, and `sourceRef` exactly.
- [x] Assert cross-user category and tag IDs throw `NotFoundError`, create no activity row, and append no change-log row.
- [x] Run `pnpm test src/server/activity-create.test.ts` and confirm RED because the current input type/persistence/ownership behavior is incomplete.

### Task 2: Complete and centralize DAL creation semantics

- [x] In `src/server/dal/index.ts`, extract `assertOwnedActivityReferences(tdb, userId, categoryId, tags)` from `scheduleTask`'s working ownership checks.
- [x] Call the helper from both `scheduleTask` and `createActivitySeries` inside their existing transactions.
- [x] Extend `createActivitySeries` input and insert values with:

```ts
exdate?: Date[];
rdate?: Date[];
tags?: string[];
sourceRef?: string;
```

- [x] Persist missing arrays as `null` (matching the schema response contract) and preserve caller values.
- [x] Run `pnpm test src/server/activity-create.test.ts 'src/app/api/v1/tasks/[id]/schedule/route.test.ts' src/server/shipping-idempotency.test.ts` and confirm GREEN.

### Task 3: Pin and fix the `/api/v1/activities` route contract

- [x] Create `src/app/api/v1/activities/route.test.ts` by following the schedule-route mock pattern.
- [x] Assert the route transforms `exdate` day strings to midnight UTC `Date` values and `rdate` instants to `Date` values; forwards tags/sourceRef; uses the idempotency callback database; and returns 201 with `private, no-store`.
- [x] Assert malformed optional `Idempotency-Key` returns 400 before idempotency or DAL execution; assert unauthenticated requests do not mutate.
- [x] Run the route test and confirm RED against the current incomplete handler.
- [x] Update `src/app/api/v1/activities/route.ts` to import `errorResponse` and `uuid`, validate the optional key, forward every canonical field, and set the response cache header.
- [x] Run both activity and task-schedule route tests and confirm GREEN.

### Task 4: Pin and fix editor category readiness

- [x] Create `src/components/activity-editor-categories.test.ts` to assert the editor page obtains a session independently of `taskId`, lists categories for the authenticated user, passes `initialCategories`, initializes client state from that prop, and still refreshes `/api/v1/categories`.
- [x] Run the test and confirm RED because ordinary editor renders do not load or hydrate categories.
- [x] Update `src/app/app/editor/page.tsx` to call `getSession()` for all renders, load categories whenever authenticated, load the task/checklist only when converting, and pass the minimal `{id,key,label}` category rows to `ActivityEditor`.
- [x] Add `initialCategories?: CategoryRow[]` to `ActivityEditorProps`; initialize `categories` from it. Keep the existing client fetch so later changes refresh the server snapshot.
- [x] Run the focused component/source tests and confirm GREEN.

### Task 5: Browser regression and integration gates

- [x] Add `e2e/activity-editor-categories.spec.ts` using the existing authenticated
  fixture; delay or abort the client category request, open `/app/editor`, select
  Life, save immediately, capture the outgoing activity request, and assert its
  `categoryId` equals the authenticated Life category ID.
- [x] Start the isolated dev server on port 3456 and run the focused Playwright case RED before the editor fix if practical; after the fix run `pnpm test:e2e` and confirm the full suite passes.
- [x] Capture desktop and mobile screenshots of the working editor/category flow to `browser-qa/` (git-ignored).
- [x] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, `node scripts/parity.mjs`, `./scripts/ios-main-thread-gate.sh`, and `pnpm ios:release:preflight`.

### Task 6: Review, document, release, and verify

- [x] Review `git diff --check`, `git status`, the complete diff, sensitive ownership predicates, and route cache/idempotency behavior.
- [x] Update the Round 54 roadmap/progress entries with exact local counts and evidence paths.
- [x] Commit intentionally, push `codex/round54-canonical-create`, fast-forward `main`, and push `main` only after every gate is green.
- [x] Wait for the exact pushed SHA's GitHub Actions run and require every job green.
- [x] Deploy the exact final SHA through the documented Coolify application, require a finished deployment, and verify live `/api/health`, landing/editor HTTP behavior, exact deployed SHA, and a unique non-mutating shipped-code marker.
- [x] Do not mutate the production planner. Record external Google/physical-device activation gates as still pending rather than redefining completion.

## Self-review

- Spec coverage: canonical forwarding, DAL persistence, nested ownership, idempotency UUID validation, cache policy, category readiness, offline behavior, browser proof, full release proof, and pending external gates are each assigned.
- Placeholder scan: no deferred implementation placeholders or unspecified test steps remain.
- Type consistency: route and DAL use `Date[]` for persisted recurrence values, `string[]` for UUID tag IDs, and the editor uses the existing `{id,key,label}` category shape.
