import Foundation
import XCTest
@testable import Kairo

final class NativeSyncCoordinatorTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_785_326_400)

    func testActivateCreatesAnEmptyScopedSnapshot() async throws {
        let (coordinator, _, _) = try makeCoordinator()

        try await coordinator.activate(scope: "account-a")

        let snapshot = try await coordinator.snapshot(scope: "account-a")
        XCTAssertEqual(
            snapshot,
            NativeSyncPresentationSnapshot(
                pendingCount: 0,
                conflicts: [],
                lastSuccessfulSyncAt: nil
            )
        )
    }

    func testColdActivationRestoresExistingSameScopeQueue() async throws {
        let (firstCoordinator, store, transport) = try makeCoordinator()
        try await firstCoordinator.activate(scope: "account-a")
        _ = try await firstCoordinator.enqueueTaskCreate(
            title: "Survives relaunch",
            bucket: "inbox"
        )
        let currentTime = now
        let relaunchedCoordinator = NativeSyncCoordinator(
            store: store,
            transport: transport,
            clock: { currentTime },
            uuidProvider: { UUID() },
            idempotencyKeyProvider: { "new-key" }
        )

        try await relaunchedCoordinator.activate(scope: "account-a")

        let restored = try await relaunchedCoordinator.snapshot(scope: "account-a")
        XCTAssertEqual(restored.pendingCount, 1)
    }

    func testTaskCreateIsDurableBeforeReturnThenReplaysWithOriginalKey() async throws {
        let (coordinator, store, transport) = try makeCoordinator(
            idempotencyKey: "task-key"
        )
        try await coordinator.activate(scope: "account-a")

        let mutation = try await coordinator.enqueueTaskCreate(
            title: "Capture this",
            bucket: "inbox"
        )

        XCTAssertEqual(
            mutation.id,
            UUID(uuidString: "00000000-0000-0000-0000-000000000007")!
        )
        XCTAssertEqual(
            try store.read(scope: "account-a")?.pendingMutations,
            [mutation]
        )
        let result = try await coordinator.synchronize(scope: "account-a")

        XCTAssertTrue(result.refreshRequired)
        let events = await transport.events
        XCTAssertEqual(
            events,
            [
                .taskCreate("Capture this", "inbox", "task-key"),
                .changes(nil),
            ]
        )
        let snapshot = try await coordinator.snapshot(scope: "account-a")
        XCTAssertEqual(snapshot.pendingCount, 0)
        XCTAssertEqual(snapshot.lastSuccessfulSyncAt, now)
    }

    func testActivityStatusRebasesOnFreshRevisionAndPreservesDurableValues() async throws {
        let (coordinator, _, transport) = try makeCoordinator(
            idempotencyKey: "status-key",
            activityRevisions: [9]
        )
        try await coordinator.activate(scope: "account-a")

        _ = try await coordinator.enqueueActivityStatus(
            activityID: "activity-1",
            status: .completed,
            occurredAt: now,
            occurrenceKey: "2026-07-29T12:00:00Z"
        )
        _ = try await coordinator.synchronize(scope: "account-a")

        let events = await transport.events
        XCTAssertEqual(
            events,
            [
                .activity("activity-1"),
                .status(
                    "activity-1",
                    9,
                    "2026-07-29T12:00:00Z",
                    .completed,
                    "2026-07-29T12:00:00Z",
                    "status-key"
                ),
                .changes(nil),
            ]
        )
    }

    func testStatusConflictStaysPendingAndRereadsOnNextSynchronization() async throws {
        let (coordinator, store, transport) = try makeCoordinator(
            activityRevisions: [4, 5],
            statusOutcomes: [.http(409), .success]
        )
        try await coordinator.activate(scope: "account-a")
        _ = try await coordinator.enqueueActivityStatus(
            activityID: "activity-1",
            status: .completed,
            occurredAt: now,
            occurrenceKey: "2026-07-29T12:00:00Z"
        )

        let first = try await coordinator.synchronize(scope: "account-a")
        XCTAssertFalse(first.refreshRequired)
        let afterConflict = try await coordinator.snapshot(scope: "account-a")
        let pendingMutation = try XCTUnwrap(
            try store.read(scope: "account-a")?.pendingMutations.first
        )
        XCTAssertEqual(afterConflict.pendingCount, 1)
        XCTAssertEqual(pendingMutation.nextAttemptAt, now.addingTimeInterval(60))

        _ = try await coordinator.synchronize(scope: "account-a")
        let automaticEvents = await transport.events
        XCTAssertEqual(
            automaticEvents.filter { $0 == .activity("activity-1") }.count,
            1
        )

        _ = try await coordinator.synchronize(
            scope: "account-a",
            explicitRetry: true
        )
        let afterSuccess = try await coordinator.snapshot(scope: "account-a")
        let events = await transport.events
        XCTAssertEqual(afterSuccess.pendingCount, 0)
        XCTAssertEqual(events.filter { $0 == .activity("activity-1") }.count, 2)
    }

    func testMissingStatusActivityBecomesSafeDurableConflictUntilAcknowledged() async throws {
        let (coordinator, _, _) = try makeCoordinator(
            activityOutcomes: [.http(404)]
        )
        try await coordinator.activate(scope: "account-a")
        let mutation = try await coordinator.enqueueActivityStatus(
            activityID: "activity-1",
            status: .completed,
            occurredAt: now,
            occurrenceKey: "2026-07-29T12:00:00Z"
        )

        _ = try await coordinator.synchronize(scope: "account-a")
        let snapshot = try await coordinator.snapshot(scope: "account-a")
        let conflict = try XCTUnwrap(snapshot.conflicts.first)
        XCTAssertEqual(conflict.mutationID, mutation.id)
        XCTAssertEqual(conflict.operation, .activityStatus)
        XCTAssertEqual(conflict.reason, .activityMissing)
        XCTAssertEqual(snapshot.pendingCount, 0)

        try await coordinator.acknowledgeConflict(scope: "account-a", id: conflict.id)
        let acknowledged = try await coordinator.snapshot(scope: "account-a")
        XCTAssertTrue(acknowledged.conflicts.isEmpty)
    }

    func testRetryableFailuresPersistCappedBackoffAndExplicitRetryBypassesIt() async throws {
        let (coordinator, store, transport) = try makeCoordinator(
            taskOutcomes: [.network, .success]
        )
        try await coordinator.activate(scope: "account-a")
        _ = try await coordinator.enqueueTaskCreate(title: "Retry me", bucket: "inbox")

        let first = try await coordinator.synchronize(scope: "account-a")
        XCTAssertFalse(first.refreshRequired)
        let pending = try XCTUnwrap(
            try store.read(scope: "account-a")?.pendingMutations.first
        )
        XCTAssertEqual(pending.attemptCount, 1)
        XCTAssertEqual(pending.nextAttemptAt, now.addingTimeInterval(60))

        _ = try await coordinator.synchronize(scope: "account-a")
        let automaticEvents = await transport.events
        XCTAssertEqual(automaticEvents.filter(\.isTaskCreate).count, 1)

        _ = try await coordinator.synchronize(scope: "account-a", explicitRetry: true)
        let explicitEvents = await transport.events
        let replayed = try await coordinator.snapshot(scope: "account-a")
        XCTAssertEqual(explicitEvents.filter(\.isTaskCreate).count, 2)
        XCTAssertEqual(replayed.pendingCount, 0)
    }

    func testNonAuthentication4xxBecomesConflictBut401RethrowsUntouched() async throws {
        let (conflictCoordinator, _, _) = try makeCoordinator(
            taskOutcomes: [.http(422)]
        )
        try await conflictCoordinator.activate(scope: "account-a")
        _ = try await conflictCoordinator.enqueueTaskCreate(title: "Bad", bucket: "inbox")
        _ = try await conflictCoordinator.synchronize(scope: "account-a")
        let conflictSnapshot = try await conflictCoordinator.snapshot(scope: "account-a")
        let conflict = try XCTUnwrap(conflictSnapshot.conflicts.first)
        XCTAssertEqual(conflict.operation, .taskCreate)
        XCTAssertEqual(conflict.reason, .clientError)

        let (authCoordinator, _, _) = try makeCoordinator(
            taskOutcomes: [.http(401)]
        )
        try await authCoordinator.activate(scope: "account-b")
        _ = try await authCoordinator.enqueueTaskCreate(title: "Keep", bucket: "inbox")

        do {
            _ = try await authCoordinator.synchronize(scope: "account-b")
            XCTFail("Expected the structured 401 to reach the auth boundary")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 401)
        }
        let authSnapshot = try await authCoordinator.snapshot(scope: "account-b")
        XCTAssertEqual(authSnapshot.pendingCount, 1)
        XCTAssertTrue(authSnapshot.conflicts.isEmpty)
    }

    func testScopeIsolationRejectsWrongScopeAndAccountSwitchPurgesQueue() async throws {
        let (coordinator, _, _) = try makeCoordinator()
        try await coordinator.activate(scope: "account-a")
        _ = try await coordinator.enqueueTaskCreate(title: "A", bucket: "inbox")

        try await coordinator.activate(scope: "account-b")

        do {
            _ = try await coordinator.snapshot(scope: "account-a")
            XCTFail("A stale account must not read or remove the active scope")
        } catch {}
        let activeSnapshot = try await coordinator.snapshot(scope: "account-b")
        XCTAssertEqual(activeSnapshot.pendingCount, 0)
    }

    func testPurgeDeletesDurableStateAndDeactivatesTheCoordinator() async throws {
        let (coordinator, store, _) = try makeCoordinator()
        try await coordinator.activate(scope: "account-a")
        _ = try await coordinator.enqueueTaskCreate(title: "Purge", bucket: "inbox")

        try await coordinator.purge()

        XCTAssertFalse(FileManager.default.fileExists(atPath: store.fileURL.path))
        do {
            _ = try await coordinator.snapshot(scope: "account-a")
            XCTFail("Purged coordinators must not expose stale state")
        } catch {}
    }

    func testChangesUseCheckpointForDurableProgressAndNextCursorOnlyForPaging() async throws {
        let pages = (0 ..< 12).map {
            ChangesPage(
                entries: [],
                nextCursor: "next-\($0)",
                checkpointCursor: "checkpoint-\($0)"
            )
        }
        let (coordinator, store, transport) = try makeCoordinator(changes: pages)
        try await coordinator.activate(scope: "account-a")

        let result = try await coordinator.synchronize(scope: "account-a")

        XCTAssertTrue(result.refreshRequired)
        let events = await transport.events
        XCTAssertEqual(
            events.filter(\.isChanges).map(\.changesCursor),
            [nil, "next-0", "next-1", "next-2", "next-3", "next-4", "next-5", "next-6", "next-7", "next-8"]
        )
        XCTAssertEqual(try store.read(scope: "account-a")?.cursor, "checkpoint-9")
    }

    func testFailedChangesPageDoesNotAdvanceItsCursor() async throws {
        let (coordinator, store, _) = try makeCoordinator(
            changes: [
                .init(entries: [], nextCursor: "second", checkpointCursor: "first"),
            ],
            changeOutcomes: [.success, .network]
        )
        try await coordinator.activate(scope: "account-a")

        do {
            _ = try await coordinator.synchronize(scope: "account-a")
            XCTFail("Expected changes transport failure")
        } catch let error as APIError {
            guard case .network = error else {
                return XCTFail("Expected network error, received \(error)")
            }
        }
        XCTAssertEqual(try store.read(scope: "account-a")?.cursor, "first")
    }

    func testConcurrentSynchronizationJoinsOneInFlightReplay() async throws {
        let (coordinator, _, transport) = try makeCoordinator(suspendTaskCreate: true)
        try await coordinator.activate(scope: "account-a")
        _ = try await coordinator.enqueueTaskCreate(title: "One", bucket: "inbox")

        let first = Task { try await coordinator.synchronize(scope: "account-a") }
        await transport.waitUntilTaskCreateStarts()
        let second = Task { try await coordinator.synchronize(scope: "account-a") }
        await transport.resumeTaskCreate()

        _ = try await first.value
        _ = try await second.value
        let events = await transport.events
        XCTAssertEqual(events.filter(\.isTaskCreate).count, 1)
    }

    private func makeCoordinator(
        idempotencyKey: String = "key-1",
        taskOutcomes: [TransportOutcome] = [],
        activityOutcomes: [TransportOutcome] = [],
        activityRevisions: [Int] = [1],
        statusOutcomes: [TransportOutcome] = [],
        changes: [ChangesPage] = [],
        changeOutcomes: [TransportOutcome] = [],
        suspendTaskCreate: Bool = false
    ) throws -> (NativeSyncCoordinator, NativeSyncStore, SyncTransport) {
        let directory = FileManager.default.temporaryDirectory.appending(
            path: "KairoNativeSyncCoordinatorTests-\(UUID())"
        )
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        let store = NativeSyncStore(directory: directory)
        let transport = SyncTransport(
            taskOutcomes: taskOutcomes,
            activityOutcomes: activityOutcomes,
            statusOutcomes: statusOutcomes,
            changeOutcomes: changeOutcomes,
            activityRevisions: activityRevisions,
            changes: changes,
            suspendTaskCreate: suspendTaskCreate
        )
        return (
            NativeSyncCoordinator(
                store: store,
                transport: transport,
                clock: { self.now },
                uuidProvider: {
                    UUID(uuidString: "00000000-0000-0000-0000-000000000007")!
                },
                idempotencyKeyProvider: { idempotencyKey }
            ),
            store,
            transport
        )
    }
}

private enum TransportOutcome: Sendable {
    case success
    case http(Int)
    case network
}

private enum SyncEvent: Equatable, Sendable {
    case taskCreate(String, String, String?)
    case activity(String)
    case status(String, Int, String?, ActivityStatus, String?, String?)
    case changes(String?)

    var isTaskCreate: Bool {
        if case .taskCreate = self { return true }
        return false
    }

    var isChanges: Bool {
        if case .changes = self { return true }
        return false
    }

    var changesCursor: String? {
        if case let .changes(cursor) = self { return cursor }
        return nil
    }
}

private actor SyncTransport: NativeSyncTransport {
    private var taskOutcomes: [TransportOutcome]
    private var activityOutcomes: [TransportOutcome]
    private var statusOutcomes: [TransportOutcome]
    private var changeOutcomes: [TransportOutcome]
    private var activityRevisions: [Int]
    private var changesPages: [ChangesPage]
    private var suspendTaskCreate: Bool
    private var taskCreateStarted = false
    private var taskStartWaiters: [CheckedContinuation<Void, Never>] = []
    private var taskResume: CheckedContinuation<Void, Never>?
    private(set) var events: [SyncEvent] = []

    init(
        taskOutcomes: [TransportOutcome],
        activityOutcomes: [TransportOutcome],
        statusOutcomes: [TransportOutcome],
        changeOutcomes: [TransportOutcome],
        activityRevisions: [Int],
        changes: [ChangesPage],
        suspendTaskCreate: Bool
    ) {
        self.taskOutcomes = taskOutcomes
        self.activityOutcomes = activityOutcomes
        self.statusOutcomes = statusOutcomes
        self.changeOutcomes = changeOutcomes
        self.activityRevisions = activityRevisions
        changesPages = changes
        self.suspendTaskCreate = suspendTaskCreate
    }

    func createTask(
        title: String,
        bucket: String,
        idempotencyKey: String?
    ) async throws -> TaskItem {
        events.append(.taskCreate(title, bucket, idempotencyKey))
        taskCreateStarted = true
        let waiters = taskStartWaiters
        taskStartWaiters.removeAll()
        waiters.forEach { $0.resume() }
        if suspendTaskCreate {
            suspendTaskCreate = false
            await withCheckedContinuation { taskResume = $0 }
        }
        try resolve(&taskOutcomes)
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
        events.append(.activity(id))
        try resolve(&activityOutcomes)
        let revision = activityRevisions.isEmpty ? 1 : activityRevisions.removeFirst()
        return .init(
            id: id,
            title: "Activity",
            emoji: nil,
            tz: "America/New_York",
            dtstartLocal: .init(timeIntervalSince1970: 0),
            durationMin: 30,
            rrule: nil,
            categoryId: nil,
            checklistTemplate: nil,
            revision: revision,
            occurrenceKey: nil,
            status: "pending"
        )
    }

    func setStatus(
        activityId: String,
        revision: Int,
        occurrenceKey: String?,
        status: ActivityStatus,
        completedAt: String?,
        idempotencyKey: String?
    ) async throws -> Activity {
        events.append(.status(
            activityId,
            revision,
            occurrenceKey,
            status,
            completedAt,
            idempotencyKey
        ))
        try resolve(&statusOutcomes)
        return .init(
            id: activityId,
            title: "Activity",
            emoji: nil,
            tz: "America/New_York",
            dtstartLocal: .init(timeIntervalSince1970: 0),
            durationMin: 30,
            rrule: nil,
            categoryId: nil,
            checklistTemplate: nil,
            revision: revision,
            occurrenceKey: nil,
            status: status.rawValue
        )
    }

    func changes(cursor: String?, limit _: Int?) async throws -> ChangesPage {
        events.append(.changes(cursor))
        try resolve(&changeOutcomes)
        guard !changesPages.isEmpty else {
            return .init(entries: [], nextCursor: nil, checkpointCursor: nil)
        }
        return changesPages.removeFirst()
    }

    func waitUntilTaskCreateStarts() async {
        if taskCreateStarted { return }
        await withCheckedContinuation { taskStartWaiters.append($0) }
    }

    func resumeTaskCreate() {
        taskResume?.resume()
        taskResume = nil
    }

    private func resolve(_ outcomes: inout [TransportOutcome]) throws {
        let outcome = outcomes.isEmpty ? .success : outcomes.removeFirst()
        switch outcome {
        case .success:
            return
        case let .http(status):
            let data = ServerErrorData(
                code: "status_\(status)",
                message: "Sensitive server text must never persist",
                retryable: status == 429 || status >= 500,
                details: nil
            )
            switch status {
            case 401:
                throw APIError.unauthorized(status, data)
            case 409:
                throw APIError.conflict(status, data)
            default:
                throw APIError.http(status, data)
            }
        case .network:
            throw APIError.network(TestNetworkError())
        }
    }
}

private struct TestNetworkError: Error {}
