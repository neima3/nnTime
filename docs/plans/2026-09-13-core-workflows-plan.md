# Kairo core workflows implementation plan

> For agentic workers: use `superpowers:executing-plans` when available. Follow the companion production completion program; check steps only against fresh evidence.

**Goal:** Complete dependable web and native capture → plan → focus → review workflows while preserving temporal, authorization and offline contracts.

**Architecture:** Shared authenticated server services own mutation truth. Web and SwiftUI use the same versioned API; generated client input stays synchronized. Virtual occurrences retain stable identity and do not require writes from GET requests.

**Stack:** Existing TypeScript/Zod/Drizzle/Postgres, Vitest/Playwright, SwiftUI and generated Swift OpenAPI client.

## P0. Establish an executable baseline

### Task 0.1 — Inventory and current gates

Read `AGENTS.md`, all five ADRs, the original roadmap, `progress.md` newest entries, `parity-checklist.md`, `.github/workflows/ci.yml`, `package.json`, `e2e/helpers.ts`, `src/server/db/test-db.ts`, `playwright.config.ts`, and `docs/DEPLOYMENT.md`.

- [ ] Record branch, HEAD, worktree status and any other active work; preserve unrelated edits.
- [ ] Check local test DB safety and test harness configuration without displaying env values. Verify an isolated local/synthetic DB before tests that create or drop databases. Do not reproduce prior mass cleanup of ephemeral DBs without verifying ownership and authorization.
- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Save actual exits/counts and separate infrastructure failures from regressions; do not weaken tests to get green.
- [ ] Run `pnpm api:check-ios`, `pnpm api:check-ios-client`, `pnpm ios:release:preflight`, and `node scripts/parity.mjs`.
- [ ] Start/reuse the configured local :3456 dev server and run `pnpm test:e2e`. Account for skipped tests and clock-sensitive fixtures; never kill unrelated :3000 services.
- [ ] Create `docs/plans/2026-09-13-readiness-evidence.md` (proposed new file): rows for requirement/platform/source proof/behavioral test/release SHA/environment/date/status/blocker. Seed every phase and every supported product flow.

Expected: current baseline documented, each failed gate has a reproduction or exact environment blocker. Do not run a signed archive or deploy merely to establish this baseline.

### Task 0.2 — Reconcile parity claims

Files: `scripts/parity.mjs`, `docs/plans/parity-checklist.md`; proposed `scripts/parity-audit.mjs`, `tests/parity-audit.test.ts`, `docs/plans/parity-evidence.json`.

- [ ] Preserve the historical score and inventory IDs. Explain the `planned: 1` planning convention explicitly.
- [ ] Add a separate audit command that joins the canonical inventory by ID with evidence for each applicable platform. Suggested record keys: `id`, `platform`, `status`, `credit`, `acceptance`, `sourcePaths`, `testPaths`, `verifiedAt`, `revision`, `environment`, `blocker`.
- [ ] Use audit states `verified`, `partial`, `unverified`, `deferred`, `excluded`. Full credit requires recorded platform-specific acceptance evidence; partial requires explicit met/unmet criteria; unverified/deferred score zero. Exclusions must match the canonical allowed reasons.
- [ ] Tests must reject unknown/duplicate IDs, absent applicable-platform rows, missing evidence, unsupported credit, invented exclusions and denominator changes. Include a planned-only row to prove it scores zero, and a web-only verified example that cannot grant iOS credit.
- [ ] The command prints separate percentages and exits nonzero when either release threshold is below 85%. Evidence presence is mechanically checked; the executor must independently inspect its substance. Do not fabricate evidence to pass the command.

Run `pnpm exec vitest run tests/parity-audit.test.ts`, then `node scripts/parity-audit.mjs`. A low initial audit score is an honest finding to resolve through the remaining phases, not a reason to discard this task.

## P1. Secure and complete occurrence-linked focus

### Task 1.1 — Reproduce and close the existing focus ownership boundary FIRST

Existing files: `src/server/services/focus.ts`, `src/server/services/focus.test.ts`, `src/app/api/v1/focus-sessions/route.ts`, its `route.test.ts`, `src/server/db/schema.ts`, `src/server/dal/activities.ts`, `src/server/dal/cascade.test.ts`, `src/server/idempotency.ts`.
Proposed test: `src/server/services/focus-ownership.test.ts`.

- [ ] Use the existing ephemeral-DB harness to create users A/B, an A-owned active focus session and a B-owned activity occurrence. Attempt A's start with B's occurrence ID; assert rejection, no foreign link, no new focus event/change row, and A's existing active session unchanged. Repeat for an unknown ID and a tombstoned/cancelled source as allowed by the existing semantics.
- [ ] Run `pnpm exec vitest run src/server/services/focus-ownership.test.ts` to establish the actual failure. Inspect outer route/idempotency transaction behavior before claiming impact.
- [ ] Validate occurrence AND parent ownership and eligibility in the server service using authenticated `userId` predicates, before replacing/cancelling any active session. Reuse existing not-found/error envelopes; do not leak another account's resource existence.
- [ ] Add a valid same-user and an ad-hoc start case. Verify the negative boundary both via the service integration test and the HTTP route.
- [ ] Force history-write failure to determine whether session creation and its event can diverge. Make required history, revisions, and change-feed publication transactionally consistent; remove swallowed errors only with a regression proving correct rollback/retry behavior.
- [ ] Test lost response plus same idempotency key produces one logical start/event. Test concurrent starts and verify the documented one-active-session policy, old-session revision and changes-feed behavior.

ADR-004 describes adoption while current source describes superseding. Read the existing concurrency tests and reconcile the intended behavior before changing it. If a true contract decision is necessary, document the precise conflict and leave only that policy change blocked; ownership hardening does not depend on a redesign.

Exit: no cross-account or invalid occurrence can be attached, failed validation preserves the active session, retries do not duplicate events, and no unproven security claim is presented as a confirmed exploit.

### Task 1.2 — Resolve virtual occurrences through the canonical API

Existing files: `api/openapi.yaml`, `src/server/schemas/focus-session.ts`, `src/server/schemas/day.ts`, `src/server/services/day.ts`, `src/server/services/recurrence.ts`, focus service/route, `src/server/schemas/focus-openapi-contract.test.ts`, `src/server/schemas/day-openapi-contract.test.ts`.

- [x] Trace a one-off, recurring and rescheduled item from day response to focus URL. Record which identity is canonical and why a virtual occurrence may lack a DB row ID.
- [x] Extend focus-create additively with an optional paired `activitySeriesId` / `occurrenceKey` selector (proposed API fields), preserving existing `activityOccurrenceId` and ad-hoc requests. Reject incomplete selector pairs and simultaneous selectors/row ID with a validation error. Confirm naming fits existing API conventions before finalizing the contract.
- [x] Resolve and materialize that identity atomically in the authenticated POST path using existing occurrence uniqueness and temporal helpers. Validate that it is a real, eligible occurrence of the owned series. Never materialize by making a day GET write, fabricating a UUID, or guessing today's occurrence from title.
- [x] Preserve existing rows and overrides on repeat requests. Cover DST fold/gap, reschedule, cancellation, completed occurrence, series split, deleted parent, race with delete, and cross-user selector access. Use existing recurrence fixtures and ADR-001 policy for eligibility.
- [x] Keep the returned `activityOccurrenceId` authoritative. Provide any additive identity read-model fields needed to reconstruct completion after reload through the canonical schema, rather than browser-only state.
- [x] Run `pnpm api:sync-ios`, `pnpm api:check-ios`, `pnpm api:check-ios-client` and the focus/day contract suites. Compile the generated Swift package with `swift test --package-path ios/Kairo --only-use-versions-from-resolved-file` — **Linux host has no Swift; `native-contract` owns that compile. Not skipped in source.**

Prefer no migration if existing rows/keys suffice. If schema changes prove necessary, prepare expand/compatibility/rollback notes and route production application through B6. Old native clients must continue to decode and start ad-hoc sessions.

### Task 1.3 — Carry linkage through both clients and completion

Existing files: `src/components/FocusClient.tsx`, `src/components/TodayTimeline.tsx`, `src/app/app/focus/page.tsx`, `ios/App/API/KairoAPI.swift`, `ios/App/API/Models.swift`, `ios/App/API/GeneratedAPIAdapters.swift`, `ios/App/Features/Focus/FocusView.swift`, `ios/App/Features/Today/TodayView.swift`, `ios/UnitTests/KairoAPITransportTests.swift`.
Proposed tests: `e2e/focus-occurrence-link.spec.ts`, additional native transport/model cases in existing suites.

- [x] Preserve the stable source identity when starting focus from Today and other activity entry points. Send the new selector with a stable per-attempt idempotency key; include selector identity in the web request fingerprint.
- [x] Reload/relaunch during focus and recover the same linked occurrence from server state. Starting ad-hoc focus remains valid and has no fabricated activity association.
- [x] On finish, retain the explicit occurrence-scoped “Mark done” choice. Finishing a timer alone must not silently mark a task complete. Confirmation uses server identity and the existing conditional/idempotent completion path.
- [x] Simulate completion network failure and stale revision; show retry/reconciliation, retain identity, and celebrate only the confirmed write. Deleted or moved source identity must not complete a different occurrence.
- [x] Verify web → native and native → web focus adoption/rehydration against the agreed policy, including pause, extend, background return, cancellation and source deletion.
- [x] Run focused focus/contract tests, `pnpm exec playwright test e2e/focus-occurrence-link.spec.ts e2e/focus-concurrency.spec.ts` (9 passed; Playwright Chromium desktop). Native simulator / physical iPhone not available on this Linux host — `native-contract` owns Swift/`plutil`. Global commit gates run locally (see progress.md).

Exit: one scheduled occurrence remains identifiable across both clients, reloads, timer completion and review; source siblings remain unchanged.

## P2. Finish the everyday planner loops

### Task 2.1 — Capture, scheduling and routines regression tour

Existing files: `src/components/QuickCapture.tsx`, `AnytimeRail.tsx`, `PlanDayClient.tsx`, `RoutinesClient.tsx`, `ActivityEditor.tsx`; `src/server/dal/tasks.ts`, `src/server/services/routine-materializer.ts`; `e2e/core-loop.spec.ts`, `inbox-schedule.spec.ts`, `review-actions.spec.ts`; task/routine DAL integration tests.

- [ ] Seed a synthetic account and perform quick plain capture, failed AI parse fallback, Inbox edit, move to Anytime, schedule, focus, completion, and review. Assert persisted data after reload at each transition.
- [ ] Exercise AI confirmation, Anytime schedule and slot-it independently. Each conversion leaves exactly one destination activity, consumes the source once, preserves checklist/tags/priority/notes and records history. Retry after a lost response and after a duplicate click.
- [ ] Create a routine with multiple steps, apply “Use today,” schedule recurrence, pause it, then run materialization twice. Assert step preservation, correct duration, no duplicate instances and paused schedules produce no new work.
- [ ] Inject 401/409/429/500 and offline failures at each mutation family. The input remains recoverable, controls leave pending state, a truthful error appears, and retry cannot double-write.
- [ ] Add behavioral regressions only for missing coverage/reproduced failures. Preserve the Round 92 fixes instead of repeating them based on old findings.

### Task 2.2 — Recurrence, timezone and review correctness

Existing files: `src/server/temporal/`, `src/server/services/recurrence.ts`, `day.ts`, `src/lib/review-window.ts`, `src/components/ActivityEditor.tsx`, `ios/App/Features/Today/EditScopePrompt.swift`, `ios/UnitTests/EditScopePlanTests.swift`, `e2e/editor-edit-scope.spec.ts`, `e2e/review-actions.spec.ts`.

- [ ] Verify recurring create/edit/delete with “this,” “this and future,” and “all” on web and iOS, including missing identity and stale revision. Compare neighboring days and preserved completed history, not only request bodies.
- [ ] Exercise spring gap, autumn fold, leap day, month end, overnight split, all-day/Anytime dates, planning-zone change and imported absolute instants. Reuse deterministic service tests; freeze browser time explicitly where needed.
- [ ] Review at midday lists only ended unfinished blocks; a future block stays untouched. Complete, skip, carry to tomorrow, and undo each have reload-persistent outcomes and correct net history/stats.
- [ ] Test two clients changing the same occurrence: clear conflict and fresh state, no silent overwrite of unrelated fields.

Exit P2: every capture → plan → do → review scenario has persisted-state evidence on web and applicable native surfaces, without regression of temporal contracts.

## P3. Recovery and complete advertised features

### Task 3.1 — Offline and account-boundary matrix

Files: locate web queue/store modules via `rg --files src/lib | rg 'offline|queue|sync'`; `public/sw.js`; `ios/App/API/NativeSyncStore.swift`, `NativeSyncCoordinator.swift`, `NativeSessionController.swift`, `ios/Shared/DayCache.swift`; `e2e/offline-replay.spec.ts`, native sync/session tests.

- [ ] Test offline capture → restart → reconnect, lost server response → replay, and status changes concurrent with a second-device title edit. One mutation/key survives and non-status fields remain intact.
- [ ] Test expired session, logout and A→B account switch with pending work. No prior-user cache, queue, widget or credential leaks; no old operation replays as B.
- [ ] Prove 429/5xx backoff, 409 re-read/retry for allowed status changes, terminal deleted-resource conflict, durable conflict presentation and user recovery.
- [ ] General edits/deletes/checklist overrides/focus transitions fail honestly offline under ADR-002's later explicit mutation classification. ADR-004's older queue wording is not permission to broaden replay.
- [ ] Verify service-worker upgrade evicts prior sensitive caches and caches neither auth responses nor private route HTML. Browser tests must use real IndexedDB/service-worker behavior where supported.

### Task 3.2 — Feature capability audit and targeted completion

Create a row per feature in the readiness ledger. Inspect and test existing implementation before deciding anything is missing.

| Feature / starting files | Required acceptance |
|---|---|
| Calendar: `src/server/services/calendar.ts`, calendar route family, Settings, native Settings | Import, provider update/delete, recurrence/all-day/DST mapping, duplicate sync, revoked credentials, disconnect and clear ownership. No external writes; ICS redirect/private-address cases stay blocked. |
| AI: `src/server/services/ai.ts`, planner/capture clients | Provider disabled, timeout/cancel, malformed output and quota exhaustion are truthful; proposals require explicit per-item confirmation and cannot mutate via prompt content; failed acceptance preserves input. |
| Templates/routines: `src/server/services/templates.ts`, routine DAL and both clients | Discover, apply, edit, pause/resume, delete; preserved steps and no duplicate materialization. |
| Stats/mood/review: `src/server/services/stats.ts`, `privacy.ts`, stats clients | Empty state, complete/uncomplete netting, timezone boundaries, mood persistence and export agree with event history. |
| Search and navigation: `src/app/app/`, `ios/App/Features/Search/SearchView.swift` | Owned results only; correct destination identity/date; empty/no-results/error states; deep link preserves intended destination across auth. |
| Preferences/onboarding: Settings clients, `src/app/app/prefs-bootstrap.ts`, native Preferences | Theme, clock, timezone, notification and accessibility preferences persist, survive relaunch and do not flash another user's values. Onboarding resumes without duplicating data. |
| Games/rewards: `src/lib/games.ts`, native `PlayArcadeLogic` and existing tests | Existing games launch, pause/exit cleanly, keyboard/VoiceOver modal behavior works, sounds respect settings. No expansion of game count. |

For each failed row: write a small failure-specific plan with exact files and a failing behavioral test, fix it, run focused and global gates, capture real interaction evidence, and update only supported platform credit. External-provider/device proof moves to P7; disabled local configuration is not proof of a broken implementation or a working provider.
