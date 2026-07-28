import XCTest
@testable import Kairo

private enum FakeHealthError: Error {
    case denied
    case saveFailed
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
    private(set) var authorizationRequests = 0
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

    private func makeManager(
        client: FakeHealthKitClient,
        enabled: EnabledBox
    ) -> HealthKitManager {
        HealthKitManager(
            client: client,
            isEnabled: { enabled.value },
            setEnabled: { enabled.value = $0 }
        )
    }
}
