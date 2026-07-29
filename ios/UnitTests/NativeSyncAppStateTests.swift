import Foundation
import SwiftUI
import XCTest
@testable import Kairo

@MainActor
final class NativeSyncAppStateTests: XCTestCase {
    func testActivationRestoresPersistedPresentation() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(
            path: "KairoNativeSyncAppStateTests-\(UUID())"
        )
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        let store = NativeSyncStore(directory: directory)
        let transport = AppStateSyncTransport()
        let seeded = NativeSyncCoordinator(store: store, transport: transport)
        try await seeded.activate(scope: "account-a")
        _ = try await seeded.enqueueTaskCreate(
            title: "Restored capture",
            bucket: "inbox"
        )

        let app = AppState(
            syncCoordinator: NativeSyncCoordinator(
                store: store,
                transport: transport
            )
        )

        try await app.activateSync(scope: "account-a")

        XCTAssertEqual(app.pendingSyncCount, 1)
        XCTAssertTrue(app.syncConflicts.isEmpty)
        XCTAssertNil(app.lastSuccessfulSyncAt)
    }

    func testLogoutPurgesCoordinatorAndPresentation() async throws {
        let (app, coordinator) = try makeApp()
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "Remove me", bucket: "inbox")

        await app.handleSessionInvalidation()

        XCTAssertEqual(app.auth, .signedOut)
        XCTAssertNil(app.sessionScope)
        XCTAssertEqual(app.pendingSyncCount, 0)
        XCTAssertTrue(app.syncConflicts.isEmpty)
        await assertInactive(coordinator, scope: "account-a")
    }

    func testAccountSwitchPurgesOldCoordinatorPresentation() async throws {
        let (app, coordinator) = try makeApp()
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "Old account", bucket: "inbox")

        await app.prepareForAccountSwitch(newScope: "account-b")

        XCTAssertEqual(app.sessionScope, "account-b")
        XCTAssertEqual(app.pendingSyncCount, 0)
        XCTAssertTrue(app.syncConflicts.isEmpty)
        await assertInactive(coordinator, scope: "account-a")
    }

    func testStructured401UsesExistingFullSessionInvalidationBoundary() async throws {
        let transport = AppStateSyncTransport(taskOutcomes: [.http(401)])
        let (app, coordinator) = try makeApp(transport: transport)
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "Expired", bucket: "inbox")

        await app.synchronize()

        XCTAssertEqual(app.auth, .signedOut)
        XCTAssertNil(app.sessionScope)
        XCTAssertEqual(app.pendingSyncCount, 0)
        await assertInactive(coordinator, scope: "account-a")
    }

    func testSynchronizationPublishesConflictPresentation() async throws {
        let transport = AppStateSyncTransport(taskOutcomes: [.http(422)])
        let (app, _) = try makeApp(transport: transport)
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "Conflict", bucket: "inbox")

        await app.synchronize()

        XCTAssertFalse(app.isSyncing)
        XCTAssertEqual(app.pendingSyncCount, 0)
        XCTAssertEqual(app.syncConflicts.count, 1)
    }

    func testSynchronizationResetsSyncingAfterThrownNetworkError() async throws {
        let transport = AppStateSyncTransport(changeOutcomes: [.network])
        let (app, _) = try makeApp(transport: transport)
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")

        await app.synchronize()

        XCTAssertFalse(app.isSyncing)
        XCTAssertEqual(app.pendingSyncCount, 0)
        XCTAssertNil(app.lastSuccessfulSyncAt)
    }

    func testCompletionNotificationPostsOnlyWhenSynchronizationNeedsRefresh() async throws {
        let (app, _) = try makeApp()
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        var notificationCount = 0
        let observer = NotificationCenter.default.addObserver(
            forName: .kairoSyncCompleted,
            object: nil,
            queue: nil
        ) { _ in
            notificationCount += 1
        }
        defer { NotificationCenter.default.removeObserver(observer) }

        await app.synchronize()
        XCTAssertNotNil(app.lastSuccessfulSyncAt)
        _ = try await app.enqueueTaskCreate(title: "Refresh", bucket: "inbox")
        await app.synchronize()
        await app.synchronize()

        XCTAssertEqual(notificationCount, 1)
    }

    func testConcurrentSyncTriggersPostOneCompletionNotification() async throws {
        let transport = AppStateSyncTransport(suspendChanges: true)
        let (app, _) = try makeApp(transport: transport)
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "One refresh", bucket: "inbox")
        var notificationCount = 0
        let observer = NotificationCenter.default.addObserver(
            forName: .kairoSyncCompleted,
            object: nil,
            queue: nil
        ) { _ in
            notificationCount += 1
        }
        defer { NotificationCenter.default.removeObserver(observer) }

        async let first: Void = app.synchronize()
        await transport.waitUntilChangesStarts()
        async let second: Void = app.synchronize()
        await transport.resumeChanges()
        await first
        await second

        XCTAssertEqual(notificationCount, 1)
    }

    func testReconnectTransitionOnlyTriggersForOfflineToOnline() {
        XCTAssertFalse(NetworkMonitor.didReconnect(from: true, to: true))
        XCTAssertFalse(NetworkMonitor.didReconnect(from: true, to: false))
        XCTAssertFalse(NetworkMonitor.didReconnect(from: false, to: false))
        XCTAssertTrue(NetworkMonitor.didReconnect(from: false, to: true))
    }

    func testForegroundSyncPolicyIsIndependentFromHealthKitSetting() {
        XCTAssertTrue(AppState.shouldSynchronize(for: .active))
        XCTAssertFalse(AppState.shouldSynchronize(for: .background))
    }

    func testActivationWriteFailureDoesNotClearExistingPresentation() async throws {
        let parentFile = FileManager.default.temporaryDirectory.appending(
            path: "KairoNativeSyncActivationWriteFailure-\(UUID())"
        )
        addTeardownBlock { try? FileManager.default.removeItem(at: parentFile) }
        try Data().write(to: parentFile)
        let app = AppState(
            syncCoordinator: NativeSyncCoordinator(
                store: NativeSyncStore(directory: parentFile),
                transport: AppStateSyncTransport()
            ),
            signOutAction: {},
            invalidateSessionAction: {}
        )
        app.sessionScope = "account-a"
        app.pendingSyncCount = 3

        do {
            try await app.activateSync(scope: "account-a")
            XCTFail("Expected protected sync-store activation to fail")
        } catch {}

        XCTAssertEqual(app.sessionScope, "account-a")
        XCTAssertEqual(app.pendingSyncCount, 3)
        XCTAssertFalse(app.syncStorageUnavailable)
    }

    func testActivationReadFailureDoesNotClearExistingPresentation() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(
            path: "KairoNativeSyncActivationReadFailure-\(UUID())"
        )
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        let store = NativeSyncStore(directory: directory)
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        try Data("not json".utf8).write(to: store.fileURL)
        let app = AppState(
            syncCoordinator: NativeSyncCoordinator(
                store: store,
                transport: AppStateSyncTransport()
            ),
            signOutAction: {},
            invalidateSessionAction: {}
        )
        app.sessionScope = "account-a"
        app.pendingSyncCount = 2

        do {
            try await app.activateSync(scope: "account-a")
            XCTFail("Expected corrupt protected sync store to fail activation")
        } catch {}

        XCTAssertEqual(app.sessionScope, "account-a")
        XCTAssertEqual(app.pendingSyncCount, 2)
        XCTAssertFalse(app.syncStorageUnavailable)
    }

    func testSignOutPurgeFailureKeepsOldScopeAndPresentation() async throws {
        let (app, _) = try await makePurgeFailureApp()

        await app.signOut()

        XCTAssertEqual(app.auth, .connectionRequired)
        XCTAssertEqual(app.sessionScope, "account-a")
        XCTAssertEqual(app.pendingSyncCount, 1)
        XCTAssertTrue(app.syncStorageUnavailable)
    }

    func testStructured401PurgeFailureKeepsOldScopeAndPresentation() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(
            path: "KairoNativeSync401PurgeFailure-\(UUID())"
        )
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        let store = NativeSyncStore(directory: directory)
        let fileURL = store.fileURL
        let transport = AppStateSyncTransport(
            taskOutcomes: [.http(401)],
            beforeTaskOutcome: {
                try? FileManager.default.removeItem(at: fileURL)
                try? FileManager.default.createDirectory(
                    at: fileURL,
                    withIntermediateDirectories: false
                )
                try? Data("blocker".utf8).write(
                    to: fileURL.appending(path: "child")
                )
            }
        )
        let coordinator = NativeSyncCoordinator(store: store, transport: transport)
        let app = AppState(
            syncCoordinator: coordinator,
            signOutAction: {},
            invalidateSessionAction: {}
        )
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "Keep me", bucket: "inbox")

        await app.synchronize()

        XCTAssertEqual(app.auth, .connectionRequired)
        XCTAssertEqual(app.sessionScope, "account-a")
        XCTAssertEqual(app.pendingSyncCount, 1)
        XCTAssertTrue(app.syncStorageUnavailable)
    }

    func testAccountSwitchPurgeFailureDoesNotExposeNewScope() async throws {
        let (app, coordinator) = try await makePurgeFailureApp()

        await app.prepareForAccountSwitch(newScope: "account-b")

        XCTAssertEqual(app.auth, .connectionRequired)
        XCTAssertEqual(app.sessionScope, "account-a")
        XCTAssertEqual(app.pendingSyncCount, 1)
        XCTAssertTrue(app.syncStorageUnavailable)
        await assertInactive(coordinator, scope: "account-b")
    }

    func testSuccessfulSignOutPurgesCoordinatorAndPresentation() async throws {
        let (app, coordinator) = try makeApp()
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "Remove me", bucket: "inbox")

        await app.signOut()

        XCTAssertEqual(app.auth, .signedOut)
        XCTAssertNil(app.sessionScope)
        XCTAssertEqual(app.pendingSyncCount, 0)
        XCTAssertFalse(app.syncStorageUnavailable)
        await assertInactive(coordinator, scope: "account-a")
    }

    private func makeApp(
        transport: AppStateSyncTransport = AppStateSyncTransport()
    ) throws -> (AppState, NativeSyncCoordinator) {
        let directory = FileManager.default.temporaryDirectory.appending(
            path: "KairoNativeSyncAppStateTests-\(UUID())"
        )
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        let coordinator = NativeSyncCoordinator(
            store: NativeSyncStore(directory: directory),
            transport: transport
        )
        return (
            AppState(
                syncCoordinator: coordinator,
                signOutAction: {},
                invalidateSessionAction: {}
            ),
            coordinator
        )
    }

    private func makePurgeFailureApp(
        transport: AppStateSyncTransport = AppStateSyncTransport()
    ) async throws -> (AppState, NativeSyncCoordinator) {
        let directory = FileManager.default.temporaryDirectory.appending(
            path: "KairoNativeSyncPurgeFailureAppStateTests-\(UUID())"
        )
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        let store = NativeSyncStore(directory: directory)
        let coordinator = NativeSyncCoordinator(store: store, transport: transport)
        let app = AppState(
            syncCoordinator: coordinator,
            signOutAction: {},
            invalidateSessionAction: {}
        )
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "Keep me", bucket: "inbox")
        try FileManager.default.removeItem(at: store.fileURL)
        try FileManager.default.createDirectory(
            at: store.fileURL,
            withIntermediateDirectories: false
        )
        try Data("blocker".utf8).write(to: store.fileURL.appending(path: "child"))
        return (app, coordinator)
    }

    private func assertInactive(
        _ coordinator: NativeSyncCoordinator,
        scope: String
    ) async {
        do {
            _ = try await coordinator.snapshot(scope: scope)
            XCTFail("Expected purged sync state to be inaccessible")
        } catch {}
    }
}

private actor AppStateSyncTransport: NativeSyncTransport {
    private let taskOutcomes: [AppStateTransportOutcome]
    private let changeOutcomes: [AppStateTransportOutcome]
    private let beforeTaskOutcome: @Sendable () -> Void
    private var nextTaskOutcome = 0
    private var nextChangeOutcome = 0
    private var suspendChanges = false
    private var changesStarted = false
    private var changesStartWaiters: [CheckedContinuation<Void, Never>] = []
    private var changesResume: CheckedContinuation<Void, Never>?

    init(
        taskOutcomes: [AppStateTransportOutcome] = [],
        changeOutcomes: [AppStateTransportOutcome] = [],
        suspendChanges: Bool = false,
        beforeTaskOutcome: @escaping @Sendable () -> Void = {}
    ) {
        self.taskOutcomes = taskOutcomes
        self.changeOutcomes = changeOutcomes
        self.suspendChanges = suspendChanges
        self.beforeTaskOutcome = beforeTaskOutcome
    }

    func createTask(
        title: String,
        bucket: String,
        idempotencyKey: String?
    ) async throws -> TaskItem {
        if taskOutcomes.indices.contains(nextTaskOutcome) {
            let outcome = taskOutcomes[nextTaskOutcome]
            nextTaskOutcome += 1
            beforeTaskOutcome()
            try outcome.resolve()
        }
        return .init(
            id: "task-1",
            title: title,
            emoji: nil,
            bucket: bucket,
            priority: nil,
            revision: 1,
            createdAt: nil
        )
    }

    func activity(id: String) async throws -> Activity {
        fatalError("Not used by this test")
    }

    func setStatus(
        activityId: String,
        revision: Int,
        occurrenceKey: String?,
        status: ActivityStatus,
        completedAt: String?,
        idempotencyKey: String?
    ) async throws -> Activity {
        fatalError("Not used by this test")
    }

    func changes(cursor: String?, limit: Int?) async throws -> ChangesPage {
        changesStarted = true
        let waiters = changesStartWaiters
        changesStartWaiters.removeAll()
        waiters.forEach { $0.resume() }
        if suspendChanges {
            suspendChanges = false
            await withCheckedContinuation { changesResume = $0 }
        }
        if changeOutcomes.indices.contains(nextChangeOutcome) {
            let outcome = changeOutcomes[nextChangeOutcome]
            nextChangeOutcome += 1
            try outcome.resolve()
        }
        return .init(entries: [], nextCursor: nil, checkpointCursor: nil)
    }

    func waitUntilChangesStarts() async {
        if changesStarted { return }
        await withCheckedContinuation { changesStartWaiters.append($0) }
    }

    func resumeChanges() {
        changesResume?.resume()
        changesResume = nil
    }
}

private enum AppStateTransportOutcome: Sendable {
    case http(Int)
    case network

    func resolve() throws {
        if case .network = self {
            throw APIError.network(AppStateNetworkError())
        }
        guard case let .http(status) = self else { return }
        let data = ServerErrorData(
            code: "status_\(status)",
            message: "Synthetic test failure",
            retryable: false,
            details: nil
        )
        if status == 401 {
            throw APIError.unauthorized(status, data)
        }
        throw APIError.http(status, data)
    }
}

private struct AppStateNetworkError: Error {}
