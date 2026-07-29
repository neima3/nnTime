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

    func testActivationPublishesDurablePendingActivityStatus() async throws {
        let (app, coordinator) = try makeApp()
        try await coordinator.activate(scope: "account-a")
        _ = try await coordinator.enqueueActivityStatus(
            activityID: "activity-1",
            status: .completed,
            occurredAt: Date(),
            occurrenceKey: "occurrence-1"
        )

        try await app.activateSync(scope: "account-a")

        XCTAssertEqual(app.pendingActivityStatuses.count, 1)
        XCTAssertEqual(
            app.pendingActivityStatuses.first?.activityID,
            "activity-1"
        )
    }

    func testDayCachePurgeFailureFailsClosedBeforeSyncPurge() async throws {
        let (baseApp, coordinator) = try makeApp()
        let app = AppState(
            syncCoordinator: coordinator,
            signOutAction: {},
            invalidateSessionAction: {},
            dayCachePurge: { throw TestDayCachePurgeError.denied }
        )
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueActivityStatus(
            activityID: "activity-1",
            status: .completed,
            occurredAt: Date(),
            occurrenceKey: "occurrence-1"
        )
        _ = baseApp

        await app.signOut()

        XCTAssertEqual(app.auth, .connectionRequired)
        XCTAssertEqual(app.sessionScope, "account-a")
        XCTAssertEqual(app.pendingActivityStatuses.count, 1)
        let retained = try await coordinator.snapshot(
            scope: "account-a"
        )
        XCTAssertEqual(retained.pendingCount, 1)
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
        app.auth = .signedIn
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
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")

        await app.synchronize()

        XCTAssertFalse(app.isSyncing)
        XCTAssertEqual(app.pendingSyncCount, 0)
        XCTAssertNil(app.lastSuccessfulSyncAt)
    }

    func testCompletionNotificationPostsOnlyWhenSynchronizationNeedsRefresh() async throws {
        let (app, _) = try makeApp()
        app.auth = .signedIn
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

    func testReplaySuccessStillPublishesCompletionWhenChangesFeedFails() async throws {
        let transport = AppStateSyncTransport(changeOutcomes: [.network])
        let (app, _) = try makeApp(transport: transport)
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(
            title: "Accepted before feed failure",
            bucket: "inbox"
        )
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

        XCTAssertEqual(app.pendingSyncCount, 0)
        XCTAssertTrue(app.pendingTaskCreates.isEmpty)
        XCTAssertEqual(notificationCount, 1)
        XCTAssertEqual(app.auth, .signedIn)
    }

    func testReplaySuccessThenChanges401StillUsesFullInvalidation() async throws {
        let transport = AppStateSyncTransport(changeOutcomes: [.http(401)])
        let (app, coordinator) = try makeApp(transport: transport)
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(
            title: "Accepted before auth failure",
            bucket: "inbox"
        )

        await app.synchronize()

        XCTAssertEqual(app.auth, .signedOut)
        XCTAssertNil(app.sessionScope)
        XCTAssertEqual(app.pendingSyncCount, 0)
        await assertInactive(coordinator, scope: "account-a")
    }

    func testCursorOnlyAdvancementPostsCompletionNotification() async throws {
        let transport = AppStateSyncTransport(
            changesPages: [
                .init(
                    entries: [
                        .init(
                            id: "change-1",
                            entityType: "activity",
                            entityID: "activity-1",
                            operation: "updated",
                            revision: 2,
                            occurredAt: Date()
                        ),
                    ],
                    nextCursor: nil,
                    checkpointCursor: "change-1"
                ),
            ]
        )
        let (app, _) = try makeApp(transport: transport)
        app.auth = .signedIn
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

        XCTAssertEqual(notificationCount, 1)
    }

    func testConcurrentSyncTriggersPostOneCompletionNotification() async throws {
        let transport = AppStateSyncTransport(suspendChanges: true)
        let (app, _) = try makeApp(transport: transport)
        app.auth = .signedIn
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
        XCTAssertFalse(
            NetworkMonitor.didReconnect(from: .unknown, to: .online)
        )
        XCTAssertFalse(
            NetworkMonitor.didReconnect(from: .online, to: .online)
        )
        XCTAssertFalse(
            NetworkMonitor.didReconnect(from: .online, to: .offline)
        )
        XCTAssertFalse(
            NetworkMonitor.didReconnect(from: .offline, to: .offline)
        )
        XCTAssertTrue(
            NetworkMonitor.didReconnect(from: .offline, to: .online)
        )
    }

    func testNetworkMonitorStartsUnresolvedWithoutOfflineBanner() {
        let monitor = NetworkMonitor(startMonitoring: false)

        XCTAssertEqual(monitor.status, .unknown)
        XCTAssertFalse(monitor.isOnline)
        XCTAssertFalse(monitor.isOffline)
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

    func testPurgeFailedAccountSwitchBlocksExplicitForegroundAndReconnectSync() async throws {
        let transport = AppStateSyncTransport()
        let (app, _) = try await makePurgeFailureApp(transport: transport)

        let prepared = await app.prepareForAccountSwitch(newScope: "account-b")
        XCTAssertFalse(prepared)

        await app.synchronize(explicitRetry: true)
        if AppState.shouldSynchronize(for: .active) {
            await app.synchronize()
        }
        if NetworkMonitor.didReconnect(from: .offline, to: .online) {
            await app.synchronize()
        }

        let blockedCallCount = await transport.callCount
        XCTAssertEqual(blockedCallCount, 0)
    }

    func testAuthCallbackFreezeWaitsForInFlightSyncBeforeReturning() async throws {
        let transport = AppStateSyncTransport(suspendTaskCreate: true)
        let (app, _) = try makeApp(transport: transport)
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "Keep me", bucket: "inbox")

        let synchronization = Task { await app.synchronize() }
        await transport.waitUntilTaskCreateStarts()
        let callbackFreeze = Task { await app.beginAuthCallback() }
        await transport.waitUntilTaskCreateWasCancelled()

        let callsBeforeRelease = await transport.callCount
        let changesBeforeRelease = await transport.changesCallCount
        XCTAssertEqual(callsBeforeRelease, 1)
        XCTAssertEqual(changesBeforeRelease, 0)

        await transport.resumeTaskCreate()
        await callbackFreeze.value
        await synchronization.value

        let changesAfterRelease = await transport.changesCallCount
        XCTAssertEqual(changesAfterRelease, 0)
        await app.synchronize()
        let callsAfterBlockedRetry = await transport.callCount
        XCTAssertEqual(callsAfterBlockedRetry, 1)
    }

    func testCompletedDuplicateLeavesLaterSynchronizationAvailable() async throws {
        let transport = AppStateSyncTransport()
        let (app, _) = try makeApp(transport: transport)
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "Keep me", bucket: "inbox")
        let authCoordinator = NativeAuthCoordinator()
        let url = URL(string: "kairo://auth?token=completed-duplicate")!

        _ = await authCoordinator.handle(
            url,
            currentScope: nil,
            prepareForAuthentication: {},
            redeem: { _ in .init(scope: "account-a", replacedScope: nil) },
            prepareForAccountSwitch: { _ in true },
            bootstrap: {}
        )
        let duplicate = await authCoordinator.handle(
            url,
            currentScope: nil,
            prepareForAuthentication: {
                await app.beginAuthCallback()
            },
            redeem: { _ in .init(scope: "account-a", replacedScope: nil) },
            prepareForAccountSwitch: { _ in true },
            bootstrap: {}
        )

        XCTAssertEqual(duplicate, .duplicate)
        await app.synchronize()
        let callCount = await transport.callCount
        XCTAssertEqual(callCount, 2)
    }

    func testCancelledAuthCallbackResumesLaterSynchronization() async throws {
        let transport = AppStateSyncTransport()
        let (app, _) = try makeApp(transport: transport)
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "Keep me", bucket: "inbox")
        let authCoordinator = NativeAuthCoordinator()

        let outcome = await authCoordinator.handle(
            URL(string: "kairo://auth?token=cancelled-transition")!,
            currentScope: "account-a",
            prepareForAuthentication: {
                await app.beginAuthCallback()
            },
            redeem: { _ in throw CancellationError() },
            prepareForAccountSwitch: { _ in true },
            bootstrap: {}
        )

        XCTAssertEqual(outcome, .cancelled)
        app.cancelAuthCallbackTransition()
        await app.synchronize()
        let callCount = await transport.callCount
        XCTAssertEqual(callCount, 2)
    }

    func testDistinctCallbackOverlapKeepsSyncSuspendedUntilOwnerCompletes() async throws {
        let transport = AppStateSyncTransport()
        let (app, _) = try makeApp(transport: transport)
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(title: "Keep me", bucket: "inbox")
        let coordinator = NativeAuthCoordinator()
        let gate = AppStateAuthCallbackGate()

        let first = Task { @MainActor in
            await coordinator.handle(
                URL(string: "kairo://auth?token=first-overlap")!,
                currentScope: "account-a",
                prepareForAuthentication: {
                    await app.beginAuthCallback()
                    await gate.enter()
                },
                redeem: { _ in .init(scope: "account-a", replacedScope: nil) },
                prepareForAccountSwitch: { _ in true },
                bootstrap: {
                    app.cancelAuthCallbackTransition()
                }
            )
        }
        await gate.waitUntilEntered()

        let second = await coordinator.handle(
            URL(string: "kairo://auth?token=second-overlap")!,
            currentScope: "account-a",
            prepareForAuthentication: {
                app.cancelAuthCallbackTransition()
            },
            redeem: { _ in .init(scope: "account-b", replacedScope: nil) },
            prepareForAccountSwitch: { _ in true },
            bootstrap: {}
        )

        XCTAssertEqual(second, .busy)
        await app.synchronize()
        let callsWhileFirstOwnsTransition = await transport.callCount
        XCTAssertEqual(callsWhileFirstOwnsTransition, 0)

        await gate.release()
        let firstOutcome = await first.value
        XCTAssertEqual(firstOutcome, .completed)
        await app.synchronize()
        let callsAfterOwnerCompletes = await transport.callCount
        XCTAssertEqual(callsAfterOwnerCompletes, 2)
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
    private var changesPages: [ChangesPage]
    private var suspendChanges = false
    private var suspendTaskCreate = false
    private var changesStarted = false
    private var taskCreateStarted = false
    private var taskCreateCancellationObserved = false
    private var changesStartWaiters: [CheckedContinuation<Void, Never>] = []
    private var taskCreateStartWaiters: [CheckedContinuation<Void, Never>] = []
    private var taskCreateCancellationWaiters: [CheckedContinuation<Void, Never>] = []
    private var changesResume: CheckedContinuation<Void, Never>?
    private var taskCreateResume: CheckedContinuation<Void, Never>?
    private var calls = 0
    private var changesCalls = 0

    init(
        taskOutcomes: [AppStateTransportOutcome] = [],
        changeOutcomes: [AppStateTransportOutcome] = [],
        changesPages: [ChangesPage] = [],
        suspendChanges: Bool = false,
        suspendTaskCreate: Bool = false,
        beforeTaskOutcome: @escaping @Sendable () -> Void = {}
    ) {
        self.taskOutcomes = taskOutcomes
        self.changeOutcomes = changeOutcomes
        self.changesPages = changesPages
        self.suspendChanges = suspendChanges
        self.suspendTaskCreate = suspendTaskCreate
        self.beforeTaskOutcome = beforeTaskOutcome
    }

    func createTask(
        title: String,
        bucket: String,
        idempotencyKey: String?
    ) async throws -> TaskItem {
        calls += 1
        taskCreateStarted = true
        let startWaiters = taskCreateStartWaiters
        taskCreateStartWaiters.removeAll()
        startWaiters.forEach { $0.resume() }
        if suspendTaskCreate {
            suspendTaskCreate = false
            await withTaskCancellationHandler {
                await withCheckedContinuation { taskCreateResume = $0 }
            } onCancel: {
                Task { await self.observeTaskCreateCancellation() }
            }
        }
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
        calls += 1
        changesCalls += 1
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
        guard !changesPages.isEmpty else {
            return .init(
                entries: [],
                nextCursor: nil,
                checkpointCursor: nil
            )
        }
        return changesPages.removeFirst()
    }

    func waitUntilChangesStarts() async {
        if changesStarted { return }
        await withCheckedContinuation { changesStartWaiters.append($0) }
    }

    func waitUntilTaskCreateStarts() async {
        if taskCreateStarted { return }
        await withCheckedContinuation { taskCreateStartWaiters.append($0) }
    }

    func waitUntilTaskCreateWasCancelled() async {
        if taskCreateCancellationObserved { return }
        await withCheckedContinuation {
            taskCreateCancellationWaiters.append($0)
        }
    }

    func resumeChanges() {
        changesResume?.resume()
        changesResume = nil
    }

    func resumeTaskCreate() {
        taskCreateResume?.resume()
        taskCreateResume = nil
    }

    var callCount: Int { calls }
    var changesCallCount: Int { changesCalls }

    private func observeTaskCreateCancellation() {
        taskCreateCancellationObserved = true
        let waiters = taskCreateCancellationWaiters
        taskCreateCancellationWaiters.removeAll()
        waiters.forEach { $0.resume() }
    }
}

private enum TestDayCachePurgeError: Error {
    case denied
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

private actor AppStateAuthCallbackGate {
    private var entered = false
    private var enteredWaiters: [CheckedContinuation<Void, Never>] = []
    private var continuation: CheckedContinuation<Void, Never>?

    func enter() async {
        entered = true
        let waiters = enteredWaiters
        enteredWaiters.removeAll()
        waiters.forEach { $0.resume() }
        await withCheckedContinuation { continuation = $0 }
    }

    func waitUntilEntered() async {
        if entered { return }
        await withCheckedContinuation { enteredWaiters.append($0) }
    }

    func release() {
        continuation?.resume()
        continuation = nil
    }
}
