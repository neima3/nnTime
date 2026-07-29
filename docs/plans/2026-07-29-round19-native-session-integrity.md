# Round 19 Native Session and Offline Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:executing-plans and strict superpowers:test-driven-development.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shipping SwiftUI app preserve valid sessions through
transient failures, render a protected user-scoped day cache honestly, and
purge all account-local state on logout, account switch, or 401.

**Architecture:** A shipping `NativeSessionController` persists only configured
Better Auth cookies in Keychain, restores them before the first generated-client
probe, and exposes an opaque local account scope. A protected app-group day
store uses that scope. Explicit bootstrap policy distinguishes unauthorized
from transient failure; cached Today is read-only. One purge boundary owns
cookies, Keychain, cache, notifications, URL cache, preferences, and in-memory
state.

**Tech stack:** Swift 5.9/SwiftUI, Security, CryptoKit, Foundation URLSession,
WidgetKit, XCTest, XcodeGen, generated `KairoAPIClient`.

**Binding design:**
`docs/plans/2026-07-29-round19-native-session-integrity-design.md`

---

## Task 1: Replace false prototype coverage with shipping-session tests

**Files:**

- Create: `ios/UnitTests/NativeSessionControllerTests.swift`
- Modify: `ios/UnitTests/KairoAPITransportTests.swift`
- Delete or narrow: `ios/Kairo/Sources/Kairo/Auth.swift`
- Delete or narrow: `ios/Kairo/Sources/Kairo/Sync.swift`
- Delete or narrow: matching package tests

- [x] Add failing app-hosted tests for configured-cookie filtering, persist,
  restore, scope change, local invalidation, and revoke-failure cleanup.
- [x] Prove RED with the focused Xcode test command.
- [x] Remove the unwired package prototypes or reduce them to generated-client
  concerns; no dead type may continue to imply shipping auth/offline support.

## Task 2: Implement the Keychain session boundary

**Files:**

- Create: `ios/App/API/NativeSessionController.swift`
- Modify: `ios/App/API/KairoAPI.swift`
- Modify: `ios/Kairo/Sources/Kairo/Kairo.swift`

- [x] Define injectable secure-envelope and cookie-storage protocols with a
  production Keychain implementation using
  `kSecAttrAccessibleAfterFirstUnlock`.
- [x] Restore before bootstrap; persist after sign-in/sign-up; use the same
  cookie storage for auth and generated planner transport.
- [x] Derive an opaque local scope with SHA-256 and never log or transmit it.
- [x] On generated/auth 401, clear the local session and publish one
  `kairoSessionInvalidated` signal. Other failures must not clear it.
- [x] Keep cancellation as `CancellationError`.

## Task 3: Build the protected scoped day store

**Files:**

- Modify: `ios/Shared/DayCache.swift`
- Create: `ios/UnitTests/DayCacheTests.swift`
- Modify: widget cache consumers as required

- [x] Write failing tests for round-trip, scope/date rejection, legacy
  rejection, clear, atomic replacement, and file protection.
- [x] Replace the unscoped defaults blob with a versioned app-group file using
  `NSFileProtectionCompleteUntilFirstUserAuthentication`.
- [x] Preserve only the fields required for read-only Today/widget rendering;
  never store credentials.
- [x] Purge a prior scope before accepting a new session scope.

## Task 4: Make bootstrap and 401 semantics honest

**Files:**

- Modify: `ios/App/KairoApp.swift`
- Create: `ios/UnitTests/AppSessionPolicyTests.swift`
- Modify: auth view only if a recoverable connection state needs copy

- [x] Drive a pure bootstrap-decision policy RED for success, 401, network,
  429, retryable 5xx, decoding, cancellation, restored-session, and cache
  combinations.
- [x] Make only 401 signed-out evidence. Transient failure with a restorable
  scoped cache enters signed-in/offline-read-only.
- [x] Listen for later session invalidation and run the same purge boundary.
- [x] Prevent overlapping bootstrap/sign-out tasks from restoring stale state.

## Task 5: Render Today cache read-only and correct offline copy

**Files:**

- Modify: `ios/App/Features/Today/TodayView.swift`
- Modify: timeline action components as required
- Modify: `ios/App/KairoApp.swift`
- Create or modify app-hosted/UI tests

- [x] Add failing coverage that a matching cache reconstructs blocks and that
  wrong scope/date does not.
- [x] Render a compact token-only cached-day notice.
- [x] Remove the false “changes sync when you're back” claim.
- [x] Hide or disable completion, delete, move, edit, and focus mutation
  affordances while cached. Preserve scrolling and reading.
- [x] Verify VoiceOver copy clearly says the view is saved/read-only.

## Task 6: Complete logout/account-switch purge

**Files:**

- Modify: `ios/App/KairoApp.swift`
- Modify: `ios/Shared/Preferences.swift`
- Modify: `ios/App/Services/NotificationManager.swift`
- Modify: focused tests

- [x] Add focused purge assertions before the release gate.
- [x] Revoke remotely best-effort, then unconditionally clear Keychain,
  configured cookies, day cache, URL cache, pending local activity reminders,
  account-derived preferences, category maps, and transient offline state.
- [x] Preserve explicit device-consent/onboarding settings.
- [x] Prove a second account cannot observe the first account's cache or
  presentation preferences.

## Task 7: Native verification and adversarial review

- [x] Run generated Swift package tests.
- [x] Run app-hosted unit tests and the main-thread gate.
- [x] Build the unsigned shipping app.
- [ ] Run a fresh simulator flow: signed-in online → cached Today → offline
  relaunch remains in the app/read-only → reconnect → logout → relaunch is
  signed out with no prior-day cache.
- [x] Save screenshots/video under ignored
  `browser-qa/round19-native-session-integrity/`.
- [x] Review exact diff for privacy, stale-account, 401, cancellation, and
  concurrency failures; fix every verified Critical/Important issue with RED
  coverage.

## Task 8: Truthful handoff and integration

- [x] Update roadmap, parity evidence, and `docs/plans/progress.md`; do not
  claim magic-link completion, Sign in with Apple, widget credential sharing,
  a mutation queue, or physical-device proof.
- [x] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`,
  OpenAPI/native contract gates, and `git diff --check`.
- [x] Commit, integrate to `main`, push, and require exact-SHA CI.
- [x] Verify exact-SHA Coolify deployment and live web health read-only even
  though this tranche changes native code.

## Definition of done

- Transient network/server failure never masquerades as logout.
- Shipping auth cookies survive relaunch through Keychain restoration.
- Structured 401 and logout both purge all account-local state.
- Cached Today is protected, user-scoped, date-scoped, and explicitly
  read-only.
- Native copy does not promise an unwired offline mutation queue.
- Dead prototypes no longer count as shipping evidence.
- Exact native, repository, CI, deployment, and handoff evidence is recorded.
