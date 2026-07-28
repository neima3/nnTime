import XCTest
@testable import Kairo

private enum FakeHealthError: Error {
    case denied
    case saveFailed
    case sleepQueryFailed
}

private final class EnabledBox {
    var value: Bool

    init(_ value: Bool) {
        self.value = value
    }
}

private final class FakeHealthKitClient: HealthKitClient {
    struct Saved: Equatable {
        let sessionId: String
        let minutes: Int
        let endedAt: Date
    }

    var isAvailable = true
    var authorizationResult = true
    var authorizationError: Error?
    var saveError: Error?
    var sleepAuthorizationError: Error?
    var sleepQueryError: Error?
    var sleepSamples: [SleepSample] = []
    private(set) var authorizationRequests = 0
    private(set) var sleepAuthorizationRequests = 0
    private(set) var sleepQueryWindows: [(start: Date, end: Date)] = []
    private(set) var saved: [Saved] = []

    func requestMindfulAuthorization() async throws -> Bool {
        authorizationRequests += 1
        if let authorizationError { throw authorizationError }
        return authorizationResult
    }

    func saveMindfulSession(
        sessionId: String,
        minutes: Int,
        endedAt: Date
    ) async throws {
        if let saveError { throw saveError }
        saved.append(.init(sessionId: sessionId, minutes: minutes, endedAt: endedAt))
    }

    func requestSleepAuthorization() async throws {
        sleepAuthorizationRequests += 1
        if let sleepAuthorizationError { throw sleepAuthorizationError }
    }

    func fetchSleepSamples(start: Date, end: Date) async throws -> [SleepSample] {
        sleepQueryWindows.append((start, end))
        if let sleepQueryError { throw sleepQueryError }
        return sleepSamples
    }
}

final class HealthKitManagerTests: XCTestCase {
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
        XCTAssertEqual(client.authorizationRequests, 0)
    }

    func testEnableReturnsUnavailableWithoutRequestingPermission() async {
        let client = FakeHealthKitClient()
        client.isAvailable = false
        let enabled = EnabledBox(false)
        let manager = makeManager(client: client, enabled: enabled)

        let result = await manager.setEnabled(true)

        XCTAssertEqual(result, .unavailable)
        XCTAssertFalse(enabled.value)
        XCTAssertEqual(client.authorizationRequests, 0)
    }

    func testEnableKeepsPreferenceOffWhenPermissionIsDenied() async {
        let client = FakeHealthKitClient()
        client.authorizationResult = false
        let enabled = EnabledBox(false)
        let manager = makeManager(client: client, enabled: enabled)

        let result = await manager.setEnabled(true)

        XCTAssertEqual(result, .denied)
        XCTAssertFalse(enabled.value)
        XCTAssertEqual(client.authorizationRequests, 1)
    }

    func testEnableKeepsPreferenceOffWhenAuthorizationFails() async {
        let client = FakeHealthKitClient()
        client.authorizationError = FakeHealthError.denied
        let enabled = EnabledBox(false)
        let manager = makeManager(client: client, enabled: enabled)

        let result = await manager.setEnabled(true)

        XCTAssertEqual(result, .failed)
        XCTAssertFalse(enabled.value)
        XCTAssertEqual(client.authorizationRequests, 1)
    }

    func testEnableStoresPreferenceAfterAuthorization() async {
        let client = FakeHealthKitClient()
        let enabled = EnabledBox(false)
        let manager = makeManager(client: client, enabled: enabled)

        let result = await manager.setEnabled(true)

        XCTAssertEqual(result, .enabled)
        XCTAssertTrue(enabled.value)
        XCTAssertEqual(client.authorizationRequests, 1)
    }

    func testDisableStoresPreferenceWithoutRequestingPermission() async {
        let client = FakeHealthKitClient()
        let enabled = EnabledBox(true)
        let manager = makeManager(client: client, enabled: enabled)

        let result = await manager.setEnabled(false)

        XCTAssertEqual(result, .disabled)
        XCTAssertFalse(enabled.value)
        XCTAssertEqual(client.authorizationRequests, 0)
    }

    func testEnabledSyncWritesExactCompletedDuration() async {
        let client = FakeHealthKitClient()
        let enabled = EnabledBox(true)
        let manager = makeManager(client: client, enabled: enabled)
        let endedAt = Date(timeIntervalSince1970: 8_000)

        let saved = await manager.recordCompletedFocus(
            sessionId: "focus-42",
            minutes: 37,
            endedAt: endedAt
        )

        XCTAssertTrue(saved)
        XCTAssertEqual(
            client.saved,
            [.init(sessionId: "focus-42", minutes: 37, endedAt: endedAt)]
        )
    }

    func testNonPositiveDurationDoesNotWrite() async {
        let client = FakeHealthKitClient()
        let enabled = EnabledBox(true)
        let manager = makeManager(client: client, enabled: enabled)

        let saved = await manager.recordCompletedFocus(
            sessionId: "focus-0",
            minutes: 0,
            endedAt: Date()
        )

        XCTAssertFalse(saved)
        XCTAssertTrue(client.saved.isEmpty)
    }

    func testSaveFailureIsNonBlockingAndReturnsFalse() async {
        let client = FakeHealthKitClient()
        client.saveError = FakeHealthError.saveFailed
        let enabled = EnabledBox(true)
        let manager = makeManager(client: client, enabled: enabled)

        let saved = await manager.recordCompletedFocus(
            sessionId: "focus-fail",
            minutes: 10,
            endedAt: Date()
        )

        XCTAssertFalse(saved)
        XCTAssertTrue(client.saved.isEmpty)
        XCTAssertTrue(enabled.value)
    }

    func testSleepWindDownPreferenceIsIndependentFromMindfulSync() async {
        let client = FakeHealthKitClient()
        client.sleepSamples = fourNightSamples()
        let mindfulEnabled = EnabledBox(false)
        let sleepEnabled = EnabledBox(false)
        let manager = makeManager(
            client: client,
            enabled: mindfulEnabled,
            sleepEnabled: sleepEnabled
        )

        let result = await manager.setSleepWindDownEnabled(
            true,
            now: fixedNow,
            calendar: fixedCalendar
        )

        XCTAssertTrue(sleepEnabled.value)
        XCTAssertFalse(mindfulEnabled.value)
        guard case .enabled = result else {
            return XCTFail("expected enabled sleep wind-down, got \(result)")
        }
    }

    func testEnableSleepReturnsUnavailableWithoutAuthorization() async {
        let client = FakeHealthKitClient()
        client.isAvailable = false
        let sleepEnabled = EnabledBox(false)
        let manager = makeManager(
            client: client,
            enabled: EnabledBox(false),
            sleepEnabled: sleepEnabled
        )

        let result = await manager.setSleepWindDownEnabled(
            true,
            now: fixedNow,
            calendar: fixedCalendar
        )

        XCTAssertEqual(result, .unavailable)
        XCTAssertFalse(sleepEnabled.value)
        XCTAssertEqual(client.sleepAuthorizationRequests, 0)
    }

    func testEnableSleepStoresPreferenceAfterAuthorization() async {
        let client = FakeHealthKitClient()
        client.sleepSamples = fourNightSamples()
        let sleepEnabled = EnabledBox(false)
        let manager = makeManager(
            client: client,
            enabled: EnabledBox(false),
            sleepEnabled: sleepEnabled
        )

        _ = await manager.setSleepWindDownEnabled(
            true,
            now: fixedNow,
            calendar: fixedCalendar
        )

        XCTAssertTrue(sleepEnabled.value)
        XCTAssertEqual(client.sleepAuthorizationRequests, 1)
        XCTAssertEqual(client.sleepQueryWindows.count, 1)
    }

    func testEnableSleepReturnsNoPatternWithoutPretendingPermissionWasDenied() async {
        let client = FakeHealthKitClient()
        let sleepEnabled = EnabledBox(false)
        let cancelled = EnabledBox(false)
        let manager = makeManager(
            client: client,
            enabled: EnabledBox(false),
            sleepEnabled: sleepEnabled,
            cancelSleep: { cancelled.value = true }
        )

        let result = await manager.setSleepWindDownEnabled(
            true,
            now: fixedNow,
            calendar: fixedCalendar
        )

        XCTAssertEqual(result, .noPattern)
        XCTAssertTrue(sleepEnabled.value)
        XCTAssertTrue(cancelled.value)
    }

    func testEnableSleepReturnsScheduleForFourNights() async {
        let client = FakeHealthKitClient()
        client.sleepSamples = fourNightSamples()
        var scheduled: SleepSchedule?
        let manager = makeManager(
            client: client,
            enabled: EnabledBox(false),
            sleepEnabled: EnabledBox(false),
            scheduleSleep: { schedule, _, _ in
                scheduled = schedule
                return .scheduled
            }
        )

        let result = await manager.setSleepWindDownEnabled(
            true,
            now: fixedNow,
            calendar: fixedCalendar
        )

        let expected = SleepSchedule(
            sleepStartMinute: 23 * 60 + 30,
            windDownMinute: 22 * 60 + 45,
            nights: 4
        )
        XCTAssertEqual(scheduled, expected)
        XCTAssertEqual(result, .enabled(expected))
    }

    func testSleepQueryFailureKeepsOptInAndReturnsFailed() async {
        let client = FakeHealthKitClient()
        client.sleepQueryError = FakeHealthError.sleepQueryFailed
        let sleepEnabled = EnabledBox(false)
        let cancelled = EnabledBox(false)
        let manager = makeManager(
            client: client,
            enabled: EnabledBox(false),
            sleepEnabled: sleepEnabled,
            cancelSleep: { cancelled.value = true }
        )

        let result = await manager.setSleepWindDownEnabled(
            true,
            now: fixedNow,
            calendar: fixedCalendar
        )

        XCTAssertEqual(result, .failed)
        XCTAssertTrue(sleepEnabled.value)
        XCTAssertTrue(cancelled.value)
    }

    func testDisableSleepCancelsOnlyWindDown() async {
        let client = FakeHealthKitClient()
        let mindfulEnabled = EnabledBox(true)
        let sleepEnabled = EnabledBox(true)
        let cancelled = EnabledBox(false)
        let manager = makeManager(
            client: client,
            enabled: mindfulEnabled,
            sleepEnabled: sleepEnabled,
            cancelSleep: { cancelled.value = true }
        )

        let result = await manager.setSleepWindDownEnabled(false)

        XCTAssertEqual(result, .disabled)
        XCTAssertFalse(sleepEnabled.value)
        XCTAssertTrue(mindfulEnabled.value)
        XCTAssertTrue(cancelled.value)
        XCTAssertEqual(client.sleepAuthorizationRequests, 0)
    }

    func testRefreshDoesNothingWhileSleepFeatureIsOff() async {
        let client = FakeHealthKitClient()
        let manager = makeManager(
            client: client,
            enabled: EnabledBox(false),
            sleepEnabled: EnabledBox(false)
        )

        let result = await manager.refreshSleepWindDown(
            now: fixedNow,
            calendar: fixedCalendar
        )

        XCTAssertEqual(result, .disabled)
        XCTAssertEqual(client.sleepAuthorizationRequests, 0)
        XCTAssertTrue(client.sleepQueryWindows.isEmpty)
    }

    private func makeManager(
        client: FakeHealthKitClient,
        enabled: EnabledBox,
        sleepEnabled: EnabledBox = EnabledBox(false),
        scheduleSleep: @escaping (
            SleepSchedule,
            Date,
            Calendar
        ) async -> SleepWindDownScheduleResult = { _, _, _ in .scheduled },
        cancelSleep: @escaping () -> Void = {}
    ) -> HealthKitManager {
        HealthKitManager(
            client: client,
            isEnabled: { enabled.value },
            setEnabled: { enabled.value = $0 },
            isSleepWindDownEnabled: { sleepEnabled.value },
            setSleepWindDownEnabled: { sleepEnabled.value = $0 },
            scheduleSleepWindDown: scheduleSleep,
            cancelSleepWindDown: cancelSleep
        )
    }

    private var fixedCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        return calendar
    }

    private var fixedNow: Date {
        fixedCalendar.date(from: DateComponents(
            year: 2026,
            month: 7,
            day: 28,
            hour: 12
        ))!
    }

    private func fourNightSamples() -> [SleepSample] {
        (20...23).map { day in
            let start = fixedCalendar.date(from: DateComponents(
                year: 2026,
                month: 7,
                day: day,
                hour: 23,
                minute: 30
            ))!
            return SleepSample(
                start: start,
                end: fixedCalendar.date(byAdding: .hour, value: 7, to: start)!,
                stage: .asleepUnspecified
            )
        }
    }
}
