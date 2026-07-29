# Round 21 Native Sync Implementation Plan

> **Execution:** Follow this plan task by task with
> `superpowers:executing-plans`. Use `superpowers:test-driven-development` for
> every behavior change and `superpowers:verification-before-completion` before
> any completion claim.

**Goal:** Complete the actionable Phase 7C native data contract by adding a
protected, account-scoped offline outbox for task capture and activity status,
generated-client cursor invalidation, explicit conflict recovery, and polished
Today/Inbox states.

**Architecture:** `NativeSyncStore` persists one versioned protected document.
An actor-isolated `NativeSyncCoordinator` is the only queue owner and replays
through a narrow `NativeSyncTransport` implemented by `KairoAPI`. `AppState`
publishes a presentation snapshot and owns activation/purge boundaries. Today
and Inbox retain their current online paths while delegating the two
ADR-permitted offline mutations to this coordinator.

**Constraints:** ADR-002 is binding. Do not queue general edits, checklist
changes, deletes, focus actions, or arbitrary HTTP. Do not mutate production
data during verification. Reuse Kairo design tokens and existing typography.

---

## Task 1: Establish the protected sync document

**Files:**

- Create: `ios/App/API/NativeSyncModels.swift`
- Create: `ios/App/API/NativeSyncStore.swift`
- Create: `ios/UnitTests/NativeSyncStoreTests.swift`

1. Write failing tests for round-trip persistence, ordered mutations, conflicts,
   cursor, `nextAttemptAt`, last success, exact account scope, unsupported
   version removal, file protection, atomic replacement, and purge.
2. Run the focused store tests and confirm the new tests fail for missing types.
3. Add `Codable`, `Equatable`, and `Sendable` value models:
   `NativeSyncDocument`, `NativeSyncMutation`, `PendingTaskCreate`,
   `PendingActivityStatus`, and `NativeSyncConflict`.
4. Implement a dependency-injected `NativeSyncStore` rooted in Application
   Support by default. Apply
   `.completeUntilFirstUserAuthentication` after each atomic write.
5. Re-run the focused store tests, then commit:
   `feat(ios): add protected native sync store`.

## Task 2: Define replay transport and generated API adapters

**Files:**

- Modify: `ios/App/API/GeneratedAPIAdapters.swift`
- Modify: `ios/App/API/KairoAPI.swift`
- Modify: `scripts/ios-manual-api-contract.mjs`
- Modify: `ios/UnitTests/GeneratedAPIAdapterTests.swift`
- Modify: `ios/UnitTests/KairoAPITransportTests.swift`
- Modify: `src/lib/openapi/ios-adoption.test.ts`

1. Write failing adapter/transport tests for generated single-activity reads,
   paged changes, stable caller-supplied idempotency on task create, and stable
   caller-supplied idempotency on activity status.
2. Update the manual adoption contract to require `getActivitySeries` and
   `getChanges`; confirm the contract test fails.
3. Add generated response adapters for the two reads.
4. Add `KairoAPI.activity(id:)`, `KairoAPI.changes(cursor:limit:)`, and optional
   caller-owned idempotency parameters to `createTask` and `setStatus`.
5. Define `NativeSyncTransport` and make `KairoAPI` conform without handwritten
   planner `URLSession` traffic.
6. Run focused Swift and Vitest contract tests plus
   `pnpm api:check-ios-adoption`, then commit:
   `feat(ios): expose generated sync operations`.

## Task 3: Implement deterministic queue replay

**Files:**

- Create: `ios/App/API/NativeSyncCoordinator.swift`
- Create: `ios/UnitTests/NativeSyncCoordinatorTests.swift`

1. Write failing actor-backed transport tests for ordered replay, single-flight
   synchronization, stable idempotency, successful removal, and durable
   presentation snapshots.
2. Add failing tests for activity-status rebase: read the current activity,
   submit its fresh revision, keep 409 pending, and convert 404/410 into a
   terminal conflict.
3. Add failing tests for retry classification: network/429/5xx persist a capped
   exponential delay; other non-auth 4xx become conflicts; explicit retry
   bypasses `nextAttemptAt`; 401 rethrows for the existing auth boundary.
4. Add failing cursor tests: decoded pages commit their cursor, a failed page
   does not advance it, and one invocation stops after ten pages.
5. Implement the actor API from the design document, using an injected clock
   and UUID provider for deterministic tests.
6. Run all coordinator/store tests, then commit:
   `feat(ios): add native sync coordinator`.

## Task 4: Wire account lifecycle and sync triggers

**Files:**

- Modify: `ios/App/KairoApp.swift`
- Modify: `ios/App/Support/NetworkMonitor.swift`
- Modify: `ios/UnitTests/AppSessionPolicyTests.swift`
- Create: `ios/UnitTests/NativeSyncAppStateTests.swift`

1. Write failing tests for activate, logout purge, account-switch purge, 401
   purge, published pending/conflict counts, and completion notification.
2. Add `AppState` sync presentation fields and narrow methods for activate,
   enqueue, sync, explicit retry, acknowledge, and purge.
3. Activate only after the session scope is known. Extend every existing
   credential/cache purge boundary to remove the sync document.
4. Trigger a sync when the scene becomes active and when `NetworkMonitor`
   changes from offline to online. Keep HealthKit refresh independent.
5. Post one `.kairoSyncCompleted` notification only when replay or cursor
   advancement requires visible data refresh.
6. Run the focused unit tests, then commit:
   `feat(ios): integrate sync lifecycle`.

## Task 5: Make cached Today completion safe and optimistic

**Files:**

- Modify: `ios/Shared/DayCache.swift`
- Modify: `ios/App/API/CachedDayAdapter.swift`
- Modify: `ios/App/Features/Today/TodayView.swift`
- Modify: `ios/UnitTests/DayCacheTests.swift`
- Create: `ios/UnitTests/OfflineTodayMutationTests.swift`

1. Write failing tests for atomically updating the matching cached occurrence,
   preserving unrelated blocks and metadata, and refusing scope/date mismatch.
2. Write failing policy tests proving cached Today exposes only Complete and
   Mark not done while edit, move, delete, focus, review, templates, and create
   remain disabled.
3. Implement the cache update helper and enqueue-before-optimistic-render path.
   Roll back the visible state if protected persistence fails.
4. Replace “read-only day” copy with concise “Saved day” messaging and a
   visible “Saved on this iPhone” pending state using Butter tokens.
5. Refresh authoritative Today data after `.kairoSyncCompleted`.
6. Run focused tests and a simulator build, then commit:
   `feat(ios): allow safe offline day completion`.

## Task 6: Add durable offline Inbox capture

**Files:**

- Modify: `ios/App/Features/Inbox/InboxView.swift`
- Create: `ios/UnitTests/OfflineInboxMutationTests.swift`

1. Write failing tests for non-empty input, durable enqueue before draft clear,
   preserved draft on store failure, same-scope relaunch restoration, and
   pending-row removal after successful replay.
2. Present queued captures in a separate local section rather than fabricating
   server IDs or revisions.
3. Use the online create path when connected and the durable queue when
   disconnected. Disable duplicate submission while either path is saving.
4. Render “Saved on this iPhone” with Butter tokens and an accessible pending
   label; keep destructive/scheduling gestures unavailable on local rows.
5. Refresh Inbox after `.kairoSyncCompleted`.
6. Run focused tests, then commit:
   `feat(ios): preserve offline inbox capture`.

## Task 7: Add explicit durable conflict recovery

**Files:**

- Create: `ios/App/Components/SyncConflictNotice.swift`
- Modify: `ios/App/KairoApp.swift`
- Modify: `ios/App/Features/Today/TodayView.swift`
- Modify: `ios/App/Features/Inbox/InboxView.swift`
- Create: `ios/UnitTests/SyncConflictPresentationTests.swift`

1. Write failing presentation tests for safe copy, operation labels, retry,
   acknowledge, accessible names, and no payload/error-body disclosure.
2. Build one reusable Rose-token notice with a clear hierarchy: what stayed on
   the server, what local action needs attention, Retry, and Dismiss.
3. Show the compact notice at the relevant top-level product surface and keep
   terminal conflicts until acknowledgement.
4. Add a transient Mint confirmation only after successful replay; respect
   reduced stimulation.
5. Run focused tests and simulator build, then commit:
   `feat(ios): surface durable sync conflicts`.

## Task 8: Add deterministic Round 21 UI evidence

**Files:**

- Modify: `ios/App/KairoApp.swift`
- Create: `ios/UITests/KairoRound21SyncTour.swift`

1. Add DEBUG-only synthetic fixture arguments for offline pending Today, offline
   pending Inbox, durable conflict, dark appearance, and accessibility XXXL.
2. Write UI tests that prove:
   cached-day completion remains operable; unsafe actions are absent; pending
   Inbox survives a relaunch; conflict Retry/Dismiss are reachable; 390-point
   light/dark/XXXL states do not clip.
3. Generate the Xcode project if needed and run only the Round 21 UI suite until
   green.
4. Capture screenshots under `browser-qa/round21-native-sync/` and keep them
   git-ignored.
5. Commit:
   `test(ios): add native sync UI tour`.

## Task 9: Documentation and roadmap truth

**Files:**

- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/parity-checklist.md`
- Modify: `docs/plans/progress.md`
- Modify: `docs/DEPLOYMENT.md` only if release procedure changed

1. Recompute parity with `node scripts/parity.mjs`.
2. Check Phase 7C only if queue replay, cursor invalidation, conflict UI, full
   local gates, and deterministic UI evidence are all green.
3. Record exact commands, evidence paths, commits, remaining 7B provider/device
   blockers, and the legacy broad synthetic-login test status.
4. Run `git diff --check`, then commit:
   `docs: record native sync completion`.

## Task 10: Full verification and independent review

1. Run:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   pnpm api:check-ios
   pnpm api:check-ios-adoption
   pnpm ios:release:preflight
   swift test --package-path ios/Kairo
   xcodebuild -project ios/Kairo.xcodeproj -scheme Kairo \
     -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
     -only-testing:KairoUnitTests test
   xcodebuild -project ios/Kairo.xcodeproj -scheme Kairo \
     -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
     -only-testing:KairoUITests/KairoRound21SyncTour test
   xcodebuild -project ios/Kairo.xcodeproj -scheme Kairo \
     -configuration Release \
     -destination 'generic/platform=iOS Simulator' build
   ```

2. Run the design polish pass against Today, Inbox, and conflict fixtures:
   accessibility, hierarchy/rhythm, interaction states, and AI-slop. Fix every
   blocker and quality issue, then repeat impacted gates.
3. Run an independent code review against ADR-002 and this plan. Fix every
   valid P0–P2 finding test-first and repeat impacted gates.
4. Confirm `git status --short` contains only intentional changes and commit
   any verified review fixes.

## Task 11: Integrate, deploy, and verify live

1. Use the finishing-development-branch workflow to integrate the reviewed
   commits into `main` without disturbing unrelated worktrees.
2. Push `main` and record the exact remote SHA.
3. Deploy that exact SHA using the repository’s Coolify procedure.
4. Verify live health, deployed SHA/runtime metadata, AASA, auth callback
   boundaries, and a read-only unauthenticated `/api/v1/changes` probe.
5. Do not claim provider activation, physical-iPhone proof, or TestFlight if
   those external gates remain unavailable.
6. Update `docs/plans/progress.md` with final exact evidence if deployment adds
   new information, commit/push/deploy that documentation update, and re-verify
   the resulting exact SHA.
