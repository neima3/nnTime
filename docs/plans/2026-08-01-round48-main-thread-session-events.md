# Round 48 Main-Thread Session Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate SwiftUI background-publishing warnings from native 401
handling by making the session-invalidated UI event a main-thread contract.

**Architecture:** `KairoAPI` remains an actor and continues to own session
invalidation. After the actor has invalidated persisted authentication state,
it crosses to `MainActor` only for the `NotificationCenter` post consumed by
SwiftUI. XCTest observes the real notification with `queue: nil` and pins its
delivery thread, so future transport changes cannot silently reintroduce the
warning.

**Tech Stack:** Swift concurrency, Foundation `NotificationCenter`, SwiftUI,
XCTest, XcodeGen.

## Evidence and scope

GitHub Actions run `30708541761` passed all 377 app-hosted tests but emitted
`Publishing changes from background threads is not allowed` immediately after
401 cases in `KairoAPITransportTests` and `NativeAuthTransportTests`. The event
is posted in `KairoAPI.invalidateAndNotify()` and consumed by SwiftUI
`onReceive`, so delivery inherits the API actor's background executor. This is
a focused concurrency hardening slice; it does not change authentication,
session invalidation, provider activation, or product parity.

## File map

- Modify `ios/App/API/KairoAPI.swift`: post the UI-facing session event on the
  main actor after invalidation succeeds.
- Modify `ios/UnitTests/KairoAPITransportTests.swift`: require the actual 401
  event to arrive on the main thread while preserving exactly-once behavior.
- Modify `docs/plans/progress.md`: record local, CI, and release evidence.

### Task 1: Pin the warning red

- [ ] Extend `testPlanner401InvalidatesSessionAndPublishesOnce` to capture
  `Thread.isMainThread` in the real notification observer.
- [ ] Run the focused app-hosted XCTest and observe failure because the current
  post inherits the `KairoAPI` actor's executor.

### Task 2: Isolate UI event delivery

- [ ] In `invalidateAndNotify()`, retain actor-owned invalidation and use
  `await MainActor.run` only around the notification post.
- [ ] Run the focused XCTest and require main-thread, exactly-once delivery.
- [ ] Run the native source/contract checks that cover every invalidation path.

### Task 3: Verify and release

- [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [ ] Run `./scripts/ios-main-thread-gate.sh` and require all app-hosted tests,
  Main Thread Checker, and the unsigned shipping build to pass without the
  background-publishing warning.
- [ ] Request independent review and address every Critical/Important finding.
- [ ] Commit, fast-forward `main`, push, and require all GitHub Actions jobs.
- [ ] Require Coolify to finish the exact pushed SHA and verify live health.
- [ ] Update this checklist and `docs/plans/progress.md` with exact evidence;
  preserve the Phase 7B/8B external activation boundaries.

## Self-review

- The fix crosses actor boundaries at the UI event, not around storage work.
- The regression test exercises the production notification path.
- No provider activation, production data mutation, or parity credit is in
  scope.
