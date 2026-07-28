# Round 11 — HealthKit Mindful Minutes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:test-driven-development` and execute each checkbox in order. Do not expand this slice into sleep-data reads; that remains a separately scoped K04 follow-up.

**Goal:** Finish Round 10E by adding explicit, reversible Apple Health opt-in on iOS and exporting each successfully completed focus session as an idempotent HealthKit mindful-session sample.

**Architecture:** Put all HealthKit framework calls behind an injectable `HealthKitClient` and keep the device-local consent bit in `KairoPrefs`. `SettingsView` requests authorization and reports unavailable/denied/error states; `FocusView` asks the manager to save only after the server-authoritative completion transition succeeds. Use the focus-session UUID as `HKMetadataKeySyncIdentifier` so replay cannot create duplicate samples.

**Tech Stack:** SwiftUI, HealthKit, XCTest/XCUITest, XcodeGen, iOS 17+

---

## Binding scope and design

- Write-only HealthKit access in this slice: `HKCategoryType(.mindfulSession)`.
- No Health data is sent to Kairo's API, analytics, or logs.
- Opt-in defaults off and can be disabled locally at any time; disabling stops future writes but does not claim to revoke Apple's permission.
- A HealthKit failure must never roll back or obscure a focus session that Kairo's server already completed.
- Settings follows the existing grouped-card vocabulary: one `Apple Health` group, one toggle, one concise privacy/status line, Kairo tokens and typography only.
- Sleep-schedule reads named in roadmap K04 remain unshipped and must be recorded honestly as the next HealthKit tranche.

## Approaches considered

1. **Injectable device service (selected).** Clear privacy boundary, unit-testable authorization/save paths, and minimal view coupling.
2. **Direct `HKHealthStore` calls from `SettingsView`/`FocusView` (rejected).** Less code initially, but silent failures and authorization behavior become difficult to test.
3. **Server-side export queue (rejected).** HealthKit is device-local and the server must not receive health permissions or samples.

### Task 1: Pin consent and export behavior with failing tests

**Files:**
- Create: `ios/UnitTests/HealthKitManagerTests.swift`
- Create later: `ios/App/Services/HealthKitManager.swift`

- [x] **Step 1: Add a fake client and a test proving disabled sync performs no authorization or save.**

```swift
func testDisabledSyncDoesNotWrite() async {
    let client = FakeHealthKitClient()
    var enabled = false
    let manager = HealthKitManager(
        client: client,
        isEnabled: { enabled },
        setEnabled: { enabled = $0 }
    )

    let saved = await manager.recordCompletedFocus(
        sessionId: "focus-1",
        minutes: 25,
        endedAt: Date(timeIntervalSince1970: 1_000)
    )

    XCTAssertFalse(saved)
    XCTAssertTrue(client.saved.isEmpty)
}
```

- [x] **Step 2: Add tests for unavailable, denied, successful opt-in, successful save, save failure, and non-positive duration.**
- [x] **Step 3: Run the focused bundle and verify RED because `HealthKitManager`/`HealthKitClient` do not exist.**

Run:

```bash
xcodegen generate --spec ios/project.yml
xcodebuild test -project ios/Kairo.xcodeproj -scheme Kairo \
  -destination 'platform=iOS Simulator,id=4B9042A2-2352-4A2D-848F-6B1857F61839' \
  -only-testing:KairoUnitTests/HealthKitManagerTests CODE_SIGNING_ALLOWED=NO
```

Expected: compile failure naming the missing HealthKit types.

### Task 2: Implement the isolated HealthKit boundary

**Files:**
- Create: `ios/App/Services/HealthKitManager.swift`
- Modify: `ios/Shared/Preferences.swift`

- [x] **Step 1: Define the injectable contract and result states.**

```swift
protocol HealthKitClient: AnyObject {
    var isAvailable: Bool { get }
    func requestMindfulAuthorization() async throws -> Bool
    func saveMindfulSession(
        sessionId: String,
        minutes: Int,
        endedAt: Date
    ) async throws
}

enum HealthKitEnableResult: Equatable {
    case enabled
    case unavailable
    case denied
    case failed
}
```

- [x] **Step 2: Implement `AppleHealthKitClient` with `HKHealthStore`.**

Use:

```swift
let mindfulType = HKCategoryType(.mindfulSession)
try await store.requestAuthorization(toShare: [mindfulType], read: [])
let authorized = store.authorizationStatus(for: mindfulType) == .sharingAuthorized
```

Create the sample with value `HKCategoryValue.notApplicable.rawValue`, a duration ending at `endedAt`, and:

```swift
[
    HKMetadataKeySyncIdentifier: "kairo-focus-\(sessionId)",
    HKMetadataKeySyncVersion: 1,
]
```

- [x] **Step 3: Implement `HealthKitManager.setEnabled(_:)` and `recordCompletedFocus(...)`.**

Rules: unavailable/denied/failure keep the preference off; turning off never requests authorization; record only when opted in and `minutes > 0`; return `false` on any error.

- [x] **Step 4: Add `KairoPrefs.healthSyncEnabled`, stored under `kairo-health-sync`.**
- [x] **Step 5: Run the focused tests and verify GREEN with the exact executed count.**

### Task 3: Add the explicit Settings consent surface

**Files:**
- Modify: `ios/App/Features/More/SettingsView.swift`
- Create later: `ios/UITests/KairoRound11Tour.swift`

- [x] **Step 1: Add Settings state for toggle, busy state, and inline result copy.**
- [x] **Step 2: Add an `Apple Health` group between Reminders and Your data.**

Visible contract:

- Toggle title: `Save focused minutes`
- Supporting copy: `Completed focus sessions become mindful minutes in Apple Health. Kairo never reads your Health data.`
- Off footer: `Off by default. You choose if Kairo writes anything.`
- Enabled footer: `Connected · future completed sessions will be saved.`
- Unavailable footer: `Apple Health isn't available on this device.`
- Denied footer: `Permission wasn't granted. You can change it in the Health app.`
- Failure footer: `Apple Health couldn't connect. Nothing changed — try again.`

- [x] **Step 3: Disable the toggle while authorization is in flight and expose a VoiceOver hint describing the privacy behavior.**
- [x] **Step 4: Add an XCUITest that reaches More → Settings and asserts the group, toggle, and default-off privacy copy without invoking the system permission sheet.**

### Task 4: Export only after server-authoritative completion

**Files:**
- Modify: `ios/App/Features/Focus/FocusView.swift`
- Modify: `ios/UnitTests/HealthKitManagerTests.swift`

- [x] **Step 1: Keep the existing focused-minute calculation and call `recordCompletedFocus` only after `KairoAPI.focusAction(... completed)` returns successfully.**

```swift
_ = try await KairoAPI.shared.focusAction(
    id: current.id,
    body: ["action": "transition", "state": "completed"]
)
_ = await HealthKitManager.shared.recordCompletedFocus(
    sessionId: current.id,
    minutes: focused,
    endedAt: Date()
)
```

- [x] **Step 2: Confirm failed HealthKit writes do not prevent the existing done state, haptic, Live Activity teardown, or soundscape cleanup.**
- [x] **Step 3: Re-run focused unit tests.**

### Task 5: Add the required capability and privacy declaration

**Files:**
- Modify: `ios/App/Info.plist`
- Modify: `ios/App/Kairo.entitlements`
- Modify: `ios/project.yml`

- [x] **Step 1: Add `NSHealthUpdateUsageDescription`:**

`Kairo saves completed focus sessions as mindful minutes so your focused time can appear in Apple Health.`

- [x] **Step 2: Add `com.apple.developer.healthkit = true` to the app entitlements and XcodeGen source of truth. Do not add background delivery or clinical-record capabilities.**
- [x] **Step 3: Regenerate the Xcode project and inspect the built app's expanded Info.plist and entitlements.**

### Task 6: Verification, evidence, and handoff

**Files:**
- Modify: `docs/plans/2026-07-27-round10-ios-companion.md`
- Modify: `docs/plans/parity-checklist.md`
- Modify: `docs/plans/2026-07-24-round4-10phase.md`
- Modify: `docs/plans/2026-07-24-round5-10phase.md`
- Modify: `docs/plans/progress.md`

- [x] **Step 1: Run full web gates:**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
node scripts/parity.mjs
```

- [x] **Step 2: Run the full iOS unit and UI bundles and trust only the `Executed N tests, 0 failures` lines.**
- [x] **Step 3: Build a generic iOS device archive target with signing disabled to prove HealthKit compiles for device SDK.**
- [x] **Step 4: Capture Settings screenshots from the real simulator to `browser-qa/round11-healthkit/` and inspect hierarchy, accessibility labels, dark/light appearance, and 44-point hit targets.**
- [x] **Step 5: Tick Round 10E only after all local evidence is green. Reconcile F9/G9 as duplicates of the shipped T15 E2E suite with provenance.**
- [x] **Step 6: Update K04 honestly as partial: mindful-minute writes shipped; sleep-schedule reads remain.**
- [x] **Step 7: Append progress with tests, evidence, capability/privacy changes, the physical-device verification gap, parity output, and the exact next step.**

## Completion boundary

This slice can be code-complete and simulator-verified without a physical-device permission grant, but it may not be called physically verified. Final HealthKit authorization and a real sample appearing in Apple Health require a signed build on a physical iPhone with the HealthKit capability enabled for the App ID.
