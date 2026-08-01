# Round 50 Native Warning Cleanliness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Kairo-owned Swift compiler warnings from the shipping native
gate, beginning with the Swift 6 sendability debt exposed by widget completion.

**Architecture:** Preserve `WidgetCompletionService` as a genuinely sendable
value used across the App Intent async boundary. Prove its immutable file-cache
dependency satisfies checked `Sendable` rather than weakening the service or
using `@unchecked Sendable`. Keep cache I/O and the network-first widget
contract unchanged. Clean the one separate repository-owned `var`/`let` warning
surfaced by the same hosted build.

**Tech Stack:** Swift 5.9 with Swift 6 concurrency diagnostics, XCTest,
XcodeGen, xcodebuild, GitHub Actions.

---

## Requirements

- `DayCacheStore` satisfies a compile-time generic `T: Sendable` contract.
- Its stored values and cache snapshot/block payloads use checked sendability;
  no `@unchecked Sendable`, actor hop, lock, or warning suppression is added.
- Widget completion retains the same network-first, session-scope, cache-update,
  and error behavior.
- The Google auth tour's immutable control reference is declared `let`.
- The app-hosted and unsigned-build logs contain no warning originating from a
  Kairo Swift source file; external tool metadata notices are reported honestly.

## File map

- Modify `ios/Shared/DayCache.swift`: add checked `Sendable` conformances to the
  immutable store and its cross-boundary value payloads.
- Modify `ios/UnitTests/DayCacheTests.swift`: add the compile-time sendability
  contract without runtime-only reflection.
- Modify `ios/UITests/KairoRound23GoogleAuthTour.swift`: replace the immutable
  local `var` with `let`.
- Update `docs/plans/progress.md` with red/green, review, and release evidence.

### Task 1: Pin the warning red

- [ ] Add a generic `assertSendable<T: Sendable>` compile contract for a real
  `DayCacheStore` value.
- [ ] Run the focused native test and confirm compilation fails because
  `DayCacheStore` does not conform to `Sendable`.
- [ ] Preserve the exact hosted warning from run `30713013689` as baseline
  evidence and inventory all Kairo-source warnings in that log.

### Task 2: Add checked value semantics

- [ ] Add explicit `Sendable` conformance to `CachedBlock`, `DayCacheStore`, and
  `DayCacheStore.Snapshot` as required by the compiler.
- [ ] Do not change cache methods, file protection, storage location, or update
  ordering.
- [ ] Run focused `DayCacheTests` and `WidgetCompletionServiceTests` green.

### Task 3: Close the remaining repository warning

- [ ] Change the non-mutated Google auth tour control local from `var` to `let`.
- [ ] Regenerate the Xcode project and build/test with fresh derived data.
- [ ] Require no `warning:` line whose path points into Kairo's Swift sources.

### Task 4: Review and release

- [ ] Run web gates plus generated-client, Apple release, app-hosted native, and
  unsigned-build gates.
- [ ] Obtain independent review and resolve every actionable finding.
- [ ] Fast-forward `main`, rerun merged focused gates, push, and require exact-SHA
  GitHub CI success.
- [ ] Require the hosted native log to preserve 377-test/Main Thread Checker
  proof while removing the targeted Kairo-source warnings.
- [ ] Require Coolify's exact-SHA deployment and read-only live health proof,
  then record the final handoff and clean both feature worktrees.

## Self-review

- The fix strengthens the compiler contract; it does not silence or defer it.
- The store has immutable value state and Foundation value/thread-safe
  dependencies, so checked `Sendable` is the narrow ownership model.
- Widget completion behavior and all external Phase 7B/8B activation boundaries
  remain unchanged.
