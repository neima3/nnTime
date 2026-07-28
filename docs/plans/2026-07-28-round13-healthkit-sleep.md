# Round 13 Private Sleep-Aware Wind-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate, device-local Apple Health sleep opt-in that infers a
typical bedtime and schedules a gentle wind-down suggestion without uploading
or retaining Health samples.

**Architecture:** A pure `SleepScheduleInference` unit owns all calendar math.
`HealthKitManager` remains the permission/query boundary behind an injectable
client, while `NotificationManager` owns only the local request and preserves
unrelated activity reminders. The existing Settings card exposes independent
read and write controls; app activation refreshes the opt-in suggestion.

**Tech Stack:** Swift 5.9, SwiftUI, HealthKit, UserNotifications, XCTest,
XCUITest, XcodeGen, Next.js verification gates.

---

### Task 1: Pure sleep-schedule inference

**Files:**
- Create: `ios/App/Services/SleepScheduleInference.swift`
- Create: `ios/UnitTests/SleepScheduleInferenceTests.swift`

- [ ] **Step 1: Write failing inference tests.**

Create tests covering:

```swift
func testRejectsInBedAndAwakeStages()
func testCollapsesSleepStagesIntoOneLocalNight()
func testRequiresFourDistinctNights()
func testMedianHandlesMidnightAndLateOutlier()
func testWindDownIsFortyFiveMinutesBeforeSleep()
func testNextWindDownUsesCalendarAndAlwaysReturnsFutureDate()
```

Use a fixed Gregorian calendar with
`TimeZone(identifier: "America/New_York")!`. Construct staged samples around
11:45 PM–12:15 AM plus one 3:30 AM outlier. Assert the inferred sleep minute is
near midnight, never noon, and that only four distinct local nights satisfy
the evidence threshold.

- [ ] **Step 2: Run the focused tests and verify RED.**

```bash
cd ios
xcodegen generate
xcodebuild test \
  -project Kairo.xcodeproj \
  -scheme Kairo \
  -destination 'platform=iOS Simulator,id=3BB225A2-F2B5-4E4D-BE65-2A387A2E0708' \
  -only-testing:KairoUnitTests/SleepScheduleInferenceTests \
  -parallel-testing-enabled NO \
  CODE_SIGNING_ALLOWED=NO
```

Expected: compilation fails because `SleepSample`, `SleepStage`,
`SleepSchedule`, and `SleepScheduleInference` do not exist.

- [ ] **Step 3: Implement the pure types and inference.**

Define:

```swift
enum SleepStage: Equatable {
    case inBed, awake, asleepUnspecified, asleepCore, asleepDeep, asleepREM
    var isAsleep: Bool { /* true only for the four asleep cases */ }
}

struct SleepSample: Equatable {
    let start: Date
    let end: Date
    let stage: SleepStage
}

struct SleepSchedule: Equatable {
    let sleepStartMinute: Int
    let windDownMinute: Int
    let nights: Int
}

enum SleepScheduleInference {
    static let lookbackDays = 28
    static let minimumNights = 4
    static let windDownLeadMinutes = 45

    static func infer(
        samples: [SleepSample],
        calendar: Calendar
    ) -> SleepSchedule?

    static func nextWindDownDate(
        for schedule: SleepSchedule,
        after now: Date,
        calendar: Calendar
    ) -> Date?
}
```

Group each asleep start by `calendar.startOfDay(for: start - 12 hours)`, keep
the earliest start per key, map clock minutes before noon to `minute + 1440`,
sort, take the median, and normalize modulo 1440. Derive wind-down by
subtracting 45 minutes modulo 1440. Use `calendar.nextDate` for the next
notification so DST behavior belongs to the user's calendar.

- [ ] **Step 4: Re-run the focused tests and verify GREEN.**

Expected: all six tests pass with zero failures.

- [ ] **Step 5: Commit the pure unit.**

```bash
git add ios/App/Services/SleepScheduleInference.swift \
  ios/UnitTests/SleepScheduleInferenceTests.swift
git commit -m "feat(R13): infer private sleep wind-down schedule"
```

### Task 2: HealthKit read boundary and independent consent

**Files:**
- Modify: `ios/App/Services/HealthKitManager.swift`
- Modify: `ios/Shared/Preferences.swift`
- Modify: `ios/UnitTests/HealthKitManagerTests.swift`

- [ ] **Step 1: Extend the fake client and write failing manager tests.**

Add protocol expectations for:

```swift
func requestSleepAuthorization() async throws
func fetchSleepSamples(start: Date, end: Date) async throws -> [SleepSample]
```

Add tests proving:

```swift
func testSleepWindDownDefaultsIndependentFromMindfulSync()
func testEnableSleepReturnsUnavailableWithoutAuthorization()
func testEnableSleepStoresPreferenceAfterAuthorization()
func testEnableSleepReturnsNoPatternWithoutPretendingPermissionWasDenied()
func testEnableSleepReturnsScheduleForFourNights()
func testSleepQueryFailureKeepsOptInAndReturnsFailed()
func testDisableSleepCancelsOnlyWindDown()
func testRefreshDoesNothingWhileSleepFeatureIsOff()
```

Inject a scheduling closure and cancel closure into `HealthKitManager`; record
calls in test boxes. Existing mindful-session tests must continue passing
without coupling the two preferences.

- [ ] **Step 2: Run the manager bundle and verify RED.**

Use the Task 1 command with
`-only-testing:KairoUnitTests/HealthKitManagerTests`.

Expected: compilation fails on the missing sleep protocol and result APIs.

- [ ] **Step 3: Add the device-local preference and manager result model.**

Add:

```swift
static var sleepWindDownEnabled: Bool {
    get { store.bool(forKey: "kairo-sleep-wind-down") }
    set { store.set(newValue, forKey: "kairo-sleep-wind-down") }
}

enum SleepWindDownEnableResult: Equatable {
    case enabled(SleepSchedule)
    case disabled
    case unavailable
    case noPattern
    case notificationsOff(SleepSchedule)
    case quietHours(SleepSchedule)
    case failed
}
```

Extend the manager initializer with defaulted sleep preference, scheduler, and
cancel dependencies so existing focused-minute callers remain unchanged.

- [ ] **Step 4: Implement HealthKit authorization and query.**

In `AppleHealthKitClient`:

```swift
private let sleepType = HKCategoryType(.sleepAnalysis)

func requestSleepAuthorization() async throws {
    try await store.requestAuthorization(toShare: [], read: [sleepType])
}
```

Fetch the previous 28 days with an `HKSampleQuery`, sorted ascending. Map
`HKCategoryValueSleepAnalysis` values to `SleepStage`, ignore unknown future
values safely, and return value-only `SleepSample` structs. Do not expose
source metadata, save samples, or log query contents.

Implement:

```swift
func setSleepWindDownEnabled(
    _ enabled: Bool,
    now: Date = Date(),
    calendar: Calendar = .current
) async -> SleepWindDownEnableResult

func refreshSleepWindDown(
    now: Date = Date(),
    calendar: Calendar = .current
) async -> SleepWindDownEnableResult
```

An empty query maps to `.noPattern`, not `.denied`, because HealthKit does not
reveal read denial.

- [ ] **Step 5: Re-run all HealthKit and inference tests.**

Expected: all new and existing HealthKit tests pass.

- [ ] **Step 6: Commit the HealthKit boundary.**

```bash
git add ios/App/Services/HealthKitManager.swift \
  ios/Shared/Preferences.swift \
  ios/UnitTests/HealthKitManagerTests.swift
git commit -m "feat(R13): add private HealthKit sleep read"
```

### Task 3: Notification coexistence and foreground refresh

**Files:**
- Modify: `ios/App/Services/NotificationManager.swift`
- Modify: `ios/App/KairoApp.swift`
- Create: `ios/UnitTests/NotificationManagerTests.swift`

- [ ] **Step 1: Write failing notification-planning tests.**

Test internal pure helpers:

```swift
func testActivityRequestFilterPreservesWindDownIdentifier()
func testWindDownRequestUsesStableIdentifierAndGentleCopy()
func testWindDownReturnsNotificationsOffWithoutRequest()
func testWindDownRespectsQuietHours()
```

The activity filter input should include `start-a`, `cushion-a`,
`kairo-sleep-wind-down`, and an unrelated identifier; only the first two may
be returned for removal.

- [ ] **Step 2: Run the focused tests and verify RED.**

Expected: compilation fails on the missing filter/planner APIs.

- [ ] **Step 3: Preserve unrelated pending requests.**

Replace the activity path's blanket removal with:

```swift
let pending = await center.pendingNotificationRequests()
let activityIDs = activityRequestIdentifiers(
    from: pending.map(\.identifier)
)
center.removePendingNotificationRequests(withIdentifiers: activityIDs)
```

Expose:

```swift
static let sleepWindDownIdentifier = "kairo-sleep-wind-down"
static func cancelActivityReminders()
static func cancelSleepWindDown()
```

`cancelActivityReminders()` removes only `start-` and `cushion-` identifiers.
The existing Settings reminders-off flow must call this narrower API.

- [ ] **Step 4: Schedule exactly one sleep suggestion.**

Implement an async scheduler that first removes the stable sleep identifier,
checks notification authorization and quiet hours, builds the next local date
through `SleepScheduleInference`, then uses:

```swift
content.title = "🌙 A softer landing?"
content.body = "Your usual sleep time is getting close. Wind down now, or ignore this and keep your evening."
```

Return a typed result for scheduled, notifications off, quiet hours, or
failure. Never request notification permission implicitly from foreground
refresh.

- [ ] **Step 5: Refresh on app activation.**

Observe `scenePhase` in `KairoApp`. When it becomes `.active` and
`KairoPrefs.sleepWindDownEnabled` is true, call
`HealthKitManager.shared.refreshSleepWindDown()` in a task. The default-off
path must do no Health query.

- [ ] **Step 6: Re-run notification, HealthKit, and main-thread tests.**

Expected: focused tests pass and `./scripts/ios-main-thread-gate.sh` reports no
`Main Thread Checker:` match.

- [ ] **Step 7: Commit notification isolation.**

```bash
git add ios/App/Services/NotificationManager.swift \
  ios/App/KairoApp.swift \
  ios/UnitTests/NotificationManagerTests.swift
git commit -m "feat(R13): schedule isolated wind-down suggestions"
```

### Task 4: Accurate Settings consent surface

**Files:**
- Modify: `ios/App/Features/More/SettingsView.swift`
- Modify: `ios/App/Info.plist`
- Create: `ios/UITests/KairoRound13Tour.swift`

- [ ] **Step 1: Write the failing XCUITest.**

The test signs into the synthetic QA account, opens More → Settings, selects
Light, and scrolls to Apple Health. Assert:

```swift
app.switches["Save focused minutes"].value as? String == "0"
app.switches["Sleep-aware wind-down"].value as? String == "0"
app.staticTexts["Writes mindful minutes only. This setting never reads Health data."].exists
app.staticTexts[
  "Reads recent sleep times on this iPhone to suggest when to wind down. Nothing is uploaded."
].exists
```

Capture Light and Dark screenshots without tapping either toggle or opening a
system permission sheet.

- [ ] **Step 2: Run the focused UI test and verify RED.**

Expected: failure because the sleep control and corrected disclosures do not
exist.

- [ ] **Step 3: Add the read usage description.**

Add:

```xml
<key>NSHealthShareUsageDescription</key>
<string>Kairo reads recent sleep times to suggest a private wind-down reminder on this iPhone.</string>
```

Keep the existing mindful write description unchanged.

- [ ] **Step 4: Build the two-control Apple Health card.**

Add independent view state:

```swift
@State private var sleepWindDownOn = KairoPrefs.sleepWindDownEnabled
@State private var sleepWindDownBusy = false
@State private var sleepWindDownStatus: SleepWindDownEnableResult?
```

Use two existing toggle-row patterns separated by `divider`. Keep
`healthSyncMessage` specific to writes. Add a sleep status formatter using
`DateFormatter` configured from `KairoPrefs.hourCycle`:

- enabled: derived wind-down time and 45-minute explanation;
- no pattern: no recent pattern available; access may be limited or history
  may be insufficient;
- notifications off: pattern ready, notifications need iOS permission;
- quiet hours: pattern ready, quiet hours respected;
- failed/unavailable: retry-safe copy.

The sleep toggle invokes `setSleepWindDownEnabled`; disabling cancels only its
notification. Its accessibility hint explicitly says it reads Sleep Analysis
locally and uploads nothing.

- [ ] **Step 5: Re-run the focused UI test in Light and Dark.**

Expected: pass with both controls visible and screenshots attached.

- [ ] **Step 6: Commit the consent surface.**

```bash
git add ios/App/Features/More/SettingsView.swift \
  ios/App/Info.plist \
  ios/UITests/KairoRound13Tour.swift
git commit -m "feat(R13): expose sleep-aware wind-down consent"
```

### Task 5: Full verification, parity, and release handoff

**Files:**
- Modify: `docs/plans/2026-07-28-round13-healthkit-sleep.md`
- Modify: `docs/plans/parity-checklist.md`
- Modify: `docs/plans/progress.md`
- Modify: `ios/README.md`

- [ ] **Step 1: Run the full native suite serially.**

```bash
cd ios
xcodegen generate
xcodebuild test \
  -project Kairo.xcodeproj \
  -scheme Kairo \
  -destination 'platform=iOS Simulator,id=3BB225A2-F2B5-4E4D-BE65-2A387A2E0708' \
  -parallel-testing-enabled NO \
  CODE_SIGNING_ALLOWED=NO
```

Require every unit and UI test to pass and explicitly scan the complete log for
`Main Thread Checker:`.

- [ ] **Step 2: Build the generic arm64 device target.**

```bash
xcodebuild \
  -project ios/Kairo.xcodeproj \
  -scheme Kairo \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/kairo-r13-device \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Inspect the built app's Info.plist for both Health descriptions and its
expanded entitlements for `com.apple.developer.healthkit`.

- [ ] **Step 3: Run all web gates.**

```bash
pnpm lint
pnpm typecheck
pnpm test
BETTER_AUTH_SECRET='kairo-local-verification-only-2026-07-28' pnpm build
node scripts/parity.mjs
```

Expected: lint/typecheck/build green, 44+ files and 547+ tests pass, both parity
gates stay above 85%.

- [ ] **Step 4: Capture and inspect native visual evidence.**

Export the Round 13 XCUITest Light/Dark attachments to
`browser-qa/round13-healthkit-sleep/`, inspect both images, and keep them
git-ignored.

- [ ] **Step 5: Update documentation honestly.**

Document the new privacy boundary, the test counts, visual evidence, and exact
remaining device proof. Update K04 from “sleep read remains” to “sleep read
implemented; signed physical-iPhone authorization, mindful sample, real sleep
query, and local notification remain to be proven.” Keep K04 at partial credit
until that proof exists.

- [ ] **Step 6: Review and commit the coherent tranche.**

```bash
git diff --check
git status --short
git add docs/plans/2026-07-28-round13-healthkit-sleep.md \
  docs/plans/parity-checklist.md docs/plans/progress.md ios/README.md
git commit -m "docs(R13): record sleep wind-down verification"
```

- [ ] **Step 7: Integrate and release.**

Fast-forward `main`, push, wait for the exact SHA's Coolify deployment to reach
`finished`, then verify `running:healthy`, `/api/health`, security headers, and
desktop/mobile live browser smoke. This is native-only, so exact deployed SHA
plus live runtime health proves the web deployment; it does not replace the
physical HealthKit release proof.

