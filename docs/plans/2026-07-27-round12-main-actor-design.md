# Round 12 — Main-Actor App State Design

## Problem

Kairo's iOS unit suite passes while Main Thread Checker reports two UIKit
violations during `AppState.bootstrap()`:

- `UIApplication.connectedScenes`
- `UIWindowScene.windows`

Both calls originate in `AppState.applyContrastOverride()`. `AppState` is the
SwiftUI environment model for authentication, preferences, categories, and
accessibility presentation, but it has no actor isolation. After an async
suspension, bootstrap may resume on a cooperative background executor and both
touch UIKit and mutate observable UI state there.

## Selected design

Make the entire `AppState` type `@MainActor`. This matches its actual role: it
is created by the app, injected into SwiftUI, owns UI-observed state, and
performs UIKit trait updates. Network calls remain asynchronous and do not
block the main thread; only state access before and after suspension is actor
isolated.

Add `scripts/ios-main-thread-gate.sh` as a repeatable native release gate. It
regenerates the Xcode project, runs the app-hosted unit bundle with Main Thread
Checker enabled in isolated temporary DerivedData, preserves `xcodebuild`'s
status, and fails if the log contains a Main Thread Checker violation. This
closes the current gap where assertions are green despite runtime correctness
warnings and avoids collisions with concurrent Kairo checkouts.

## Approaches considered

1. **Isolate all of `AppState` (selected).** Compile-time protection covers
   UIKit calls and every observable state mutation, including future methods.
2. **Wrap only `applyContrastOverride()` in `MainActor.run`.** This removes the
   two current warnings but leaves `auth`, timezone, category, and preference
   mutations free to resume off-main.
3. **Dispatch UIKit work asynchronously to the main queue.** This hides the
   immediate warning while introducing ordering races between preference state
   and the trait override, with no compiler enforcement.

## Contracts and scope

- No API, persistence, parity, or visual contract changes.
- Accessibility settings keep their existing immediate local application and
  best-effort server reconciliation.
- No network operation is converted to synchronous work.
- The gate uses an explicit simulator ID when
  `KAIRO_SIMULATOR_ID` is set; otherwise it selects the first booted iPhone.
- The shared-QA full-flight smoke accepts both idle and active Focus states
  without mutating another runner's server-authoritative session.
- Round 11's physical-device HealthKit verification remains a separate human
  release step and is not reclassified by this work.

## Verification

1. Run the new gate before the fix and observe nonzero exit with both known
   violations.
2. Apply `@MainActor` to `AppState`.
3. Re-run the gate and require 37/37 tests with no Main Thread Checker match.
4. Run the complete iOS unit and UI suites, generic arm64 device build, and all
   required web gates.
5. Deploy the exact merged SHA and live-smoke the unchanged production web
   surface because production deployment is still required after pushing
   `main`.
