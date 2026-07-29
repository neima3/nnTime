# Round 22 iOS Glance Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Use
> `superpowers:test-driven-development` for every behavior change and
> `superpowers:verification-before-completion` before any completion claim.
> Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Complete the actionable Phase 8A scope by making Kairo's read-only
widgets hour-cycle-correct, deterministic, accessible, release-gated, and
proven on the real simulator system surface.

**Architecture:** Extend the protected app-group day snapshot with a validated
hour-cycle preference. Put pure widget presentation behavior in a shared Swift
unit consumed by both app and extension targets. Keep the Widget target
network-free and mutation-free, then enforce that boundary with source-level
release tests and real simulator evidence.

**Tech Stack:** Swift 5.9, SwiftUI, WidgetKit, ActivityKit, XCTest, XcodeGen,
Vitest, Xcode 26 simulator tooling.

---

### Task 1: Lock the glance-surface contract

**Files:**

- Create: `tests/ios-glance-surface-contract.test.ts`
- Modify: `tests/ios-generated-client-adoption.test.ts`

- [x] Write a failing Vitest contract that requires all supported widget
  families, the Today/Focus deep links, app-group-only extension dependencies,
  and absence of `URLSession`, `KairoAPIClient`, Keychain symbols, `AppIntent`,
  and `Button(intent:)` from widget sources.
- [x] Run
  `pnpm exec vitest run tests/ios-glance-surface-contract.test.ts` and confirm
  failure because the new contract helper/export does not exist.
- [x] Implement the smallest source-contract helper and assertions without
  changing production behavior.
- [x] Re-run the focused contract test and
  `pnpm exec vitest run tests/ios-generated-client-adoption.test.ts`.

### Task 2: Make widget time and selection deterministic

**Files:**

- Create: `ios/Shared/WidgetPresentation.swift`
- Create: `ios/UnitTests/WidgetPresentationTests.swift`
- Modify: `ios/Shared/DayCache.swift`
- Modify: `ios/UnitTests/DayCacheTests.swift`
- Modify: `ios/UnitTests/CachedDayAdapterTests.swift`

- [x] Write failing XCTest cases for 12-hour and 24-hour midnight, noon, and
  afternoon text; invalid/absent hour-cycle fallback; current-before-next
  selection; completed exclusion; timezone-aware day matching; and stale-day
  empty selection.
- [x] Boot an isolated iPhone simulator and run only
  `KairoUnitTests/WidgetPresentationTests`; confirm the expected compile/test
  failure before production code exists.
- [x] Add pure `WidgetClock` and `WidgetSelection` helpers in
  `ios/Shared/WidgetPresentation.swift`.
- [x] Add an optional, validated `hourCycle` to the protected snapshot and
  preserve it through status updates. Existing version-2 snapshots must decode.
- [x] Re-run the focused XCTest cases and the complete DayCache/CachedDay
  adapter suites.

### Task 3: Adopt the shared contract in every widget family

**Files:**

- Modify: `ios/Widget/KairoWidget.swift`
- Modify: `ios/Widget/FocusLiveActivity.swift`
- Modify: `ios/App/KairoApp.swift`
- Modify: `ios/App/Features/Today/TodayView.swift`
- Modify: `ios/UITests/KairoDeepLinkTest.swift`

- [x] Extend the focused contract/XCTest assertions so they fail while widget
  source still uses hard-coded `String(format:)` clock text and cache writers
  omit hour cycle.
- [x] Replace widget-local date/selection/clock behavior with the shared
  helpers, and pass `KairoPrefs.hourCycle` through every day-cache write.
- [x] Add explicit combined accessibility labels for small, medium, large,
  and accessory widget content plus the Live Activity open-app action.
- [x] Keep all extension actions as `Link` deep links. Do not add authenticated
  transport or optimistic local mutation.
- [x] Re-run the focused Swift and Vitest suites and an unsigned Kairo build.

### Task 4: Add deterministic real-extension QA

**Files:**

- Modify: `ios/App/KairoApp.swift`
- Create: `ios/UITests/KairoRound22GlanceTour.swift`
- Create: `scripts/ios-round22-glance-qa.sh`

- [x] Write a debug-only fixture contract test that fails until a synthetic
  current-day snapshot can be installed without a network account.
- [x] Add `-kairoRound22GlanceFixture` to seed a current protected day with
  deterministic category, completion, and 12/24-hour data. The flag must be
  compiled only in Debug.
- [x] Add an XCUITest that launches the fixture, backgrounds to SpringBoard,
  adds or locates the real Kairo widget, captures at least two widget families,
  verifies the deep link, starts the deterministic focus surface, and captures
  the real Live Activity/Dynamic Island.
- [x] Add a bounded shell runner that prepares the project, selects or boots a
  disposable simulator, runs only the Round 22 tour, copies screenshots/result
  metadata under ignored `browser-qa/round22-ios-glance-surfaces/`, and reports
  the `.xcresult` path.
- [x] Run the tour. Fix only reproducible product/test defects; retain truthful
  notes if the simulator cannot expose a system family.

### Task 5: Verify release readiness and close Phase 8A

**Files:**

- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/parity-checklist.md`
- Modify: `docs/plans/progress.md`
- Modify: `docs/plans/2026-07-29-round22-ios-glance-surfaces.md`

- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
  `node scripts/parity.mjs`.
- [x] Run `pnpm api:check-ios`, `pnpm api:check-ios-adoption`,
  `swift test --package-path ios/Kairo --only-use-versions-from-resolved-file`,
  the full app unit-test gate, and an unsigned Release build that embeds
  `KairoWidget.appex`.
- [x] Run `pnpm ios:release:preflight`, inspect the built app/extension
  Info.plists and entitlements, and verify the extension contains no network or
  AppIntent symbol path.
- [x] Review every requirement in the Round 22 design against fresh evidence.
  Check Phase 8A only if the read-only widgets and Live Activity genuinely
  ship; keep H03/H04 partial and retain the secure-session-bridge caveat.
- [x] Update progress with exact test counts, simulator/result-bundle paths,
  evidence paths, parity output, commit, push, and explicit remaining blockers.
- [x] Commit the verified tranche, push `main`, and confirm the remote exact
  SHA. Do not trigger or claim a Coolify deployment for native-only changes.
