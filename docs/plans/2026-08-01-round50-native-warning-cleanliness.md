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
- Modify `scripts/ios-xcodebuild.sh`: fail every wrapped Xcode invocation when
  a warning originates from a Kairo Swift source path, covering both app-hosted
  tests and the separate unsigned shipping build.
- Modify `tests/ci-native-contract.test.ts`: pin the repository-warning gate in
  the CI source contract.
- Modify `tests/ios-native-toolchain.test.ts`: execute the wrapper against a
  fake Kairo-source warning and require a failure.
- Update `docs/plans/progress.md` with red/green, review, and release evidence.

### Task 1: Pin the warning red

- [x] Add a generic `assertSendable<T: Sendable>` compile contract for a real
  `DayCacheStore` value.
- [x] Run the strict widget build with warnings-as-errors and confirm compilation
  fails because `DayCacheStore` does not conform to `Sendable`, then because its
  stored `FileManager` does not conform.
- [x] Preserve the exact hosted warning from run `30713013689` as baseline
  evidence and inventory all Kairo-source warnings in that log.

### Task 2: Add checked value semantics

- [x] Add explicit `Sendable` conformance to `CachedBlock`, `DayCacheStore`, and
  `DayCacheStore.Snapshot` as required by the compiler.
- [x] Do not change cache methods, file protection, storage location, or update
  ordering.
- [x] Run `DayCacheTests` and `WidgetCompletionServiceTests` green inside the
  app-hosted native gate.

### Task 3: Close the remaining repository warning

- [x] Change the non-mutated Google auth tour control local from `var` to `let`.
- [x] Add source and executable contracts, and make every wrapped Xcode
  invocation reject warnings originating from Kairo Swift source paths.
- [x] Regenerate the Xcode project and build/test with fresh derived data.
- [x] Require no `warning:` line whose path points into Kairo's Swift sources.

### Task 4: Review and release

- [x] Run web gates plus generated-client, Apple release, app-hosted native, and
  unsigned-build gates.
- [x] Obtain independent review and resolve every actionable finding.
- [ ] Fast-forward `main`, rerun merged focused gates, push, and require exact-SHA
  GitHub CI success.
- [ ] Require the hosted native log to preserve 378-test/Main Thread Checker
  proof while removing the targeted Kairo-source warnings.
- [ ] Require Coolify's exact-SHA deployment and read-only live health proof,
  then record the final handoff and clean both feature worktrees.

## Self-review

- The fix strengthens the compiler contract; it does not silence or defer it.
- The store has immutable value state and Foundation value/thread-safe
  dependencies, so checked `Sendable` is the narrow ownership model.
- Widget completion behavior and all external Phase 7B/8B activation boundaries
  remain unchanged.
