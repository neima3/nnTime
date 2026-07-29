import Foundation
import XCTest
@testable import Kairo

@MainActor
final class OfflineInboxMutationTests: XCTestCase {
    func testWhitespaceOnlyDraftDoesNotSubmit() async {
        let model = InboxCaptureSubmissionModel(draft: " \n\t ")
        var onlineCalls = 0
        var offlineCalls = 0

        let outcome = await model.submit(
            isOnline: false,
            createOnline: { _ in
                onlineCalls += 1
                return makeInboxTask(title: "Unexpected")
            },
            enqueueOffline: { _ in offlineCalls += 1 }
        )

        XCTAssertNil(outcome)
        XCTAssertEqual(onlineCalls, 0)
        XCTAssertEqual(offlineCalls, 0)
        XCTAssertEqual(model.draft, " \n\t ")
    }

    func testOfflineSubmissionClearsOnlyAfterDurableEnqueue() async {
        let model = InboxCaptureSubmissionModel(draft: "  Call the dentist  ")
        var draftDuringEnqueue: String?

        let outcome = await model.submit(
            isOnline: false,
            createOnline: { _ in makeInboxTask(title: "Unexpected") },
            enqueueOffline: { title in
                XCTAssertEqual(title, "Call the dentist")
                draftDuringEnqueue = model.draft
            }
        )

        XCTAssertEqual(draftDuringEnqueue, "  Call the dentist  ")
        guard case .queued = outcome else {
            return XCTFail("expected queued capture")
        }
        XCTAssertEqual(model.draft, "")
        XCTAssertNil(model.errorMessage)
    }

    func testOfflineStoreFailurePreservesDraftAndShowsSafeError() async {
        let model = InboxCaptureSubmissionModel(draft: "Keep this thought")

        let outcome = await model.submit(
            isOnline: false,
            createOnline: { _ in makeInboxTask(title: "Unexpected") },
            enqueueOffline: { _ in throw InboxTestError.storeUnavailable }
        )

        XCTAssertNil(outcome)
        XCTAssertEqual(model.draft, "Keep this thought")
        XCTAssertEqual(
            model.errorMessage,
            "Couldn’t save that thought yet. It’s still here so you can try again."
        )
    }

    func testDuplicateSubmissionIsIgnoredWhileSaving() async {
        let model = InboxCaptureSubmissionModel(draft: "Only once")
        let gate = InboxSubmissionGate()

        let first = Task {
            await model.submit(
                isOnline: false,
                createOnline: { _ in makeInboxTask(title: "Unexpected") },
                enqueueOffline: { _ in await gate.wait() }
            )
        }
        await gate.waitUntilEntered()
        XCTAssertTrue(model.isSaving)

        let duplicate = await model.submit(
            isOnline: false,
            createOnline: { _ in makeInboxTask(title: "Unexpected") },
            enqueueOffline: { _ in XCTFail("duplicate enqueue") }
        )
        XCTAssertNil(duplicate)

        await gate.release()
        guard case .queued = await first.value else {
            return XCTFail("expected queued capture")
        }
        XCTAssertFalse(model.isSaving)
    }

    func testOnlineSubmissionUsesGeneratedCreateAndPreservesNewTyping() async {
        let model = InboxCaptureSubmissionModel(draft: "First thought")
        let gate = InboxSubmissionGate()

        let submission = Task {
            await model.submit(
                isOnline: true,
                createOnline: { title in
                    XCTAssertEqual(title, "First thought")
                    await gate.wait()
                    return makeInboxTask(title: title)
                },
                enqueueOffline: { _ in XCTFail("offline enqueue") }
            )
        }
        await gate.waitUntilEntered()
        model.draft = "Second thought"
        await gate.release()

        let outcome = await submission.value
        guard case let .created(item) = outcome else {
            return XCTFail("expected created task")
        }
        XCTAssertEqual(item.title, "First thought")
        XCTAssertEqual(model.draft, "Second thought")
    }

    func testOnlineUnauthorizedFailureUsesSessionBoundaryCallback() async {
        let model = InboxCaptureSubmissionModel(draft: "Keep me")
        var handledUnauthorized = false

        let outcome = await model.submit(
            isOnline: true,
            createOnline: { _ in
                throw APIError.unauthorized(
                    401,
                    .init(
                        code: "UNAUTHORIZED",
                        message: "Expired",
                        retryable: false,
                        details: nil
                    )
                )
            },
            enqueueOffline: { _ in XCTFail("offline enqueue") },
            onFailure: { error in
                handledUnauthorized =
                    AppSessionFailure.classify(error) == .unauthorized
            }
        )

        XCTAssertNil(outcome)
        XCTAssertTrue(handledUnauthorized)
        XCTAssertEqual(model.draft, "Keep me")
    }

    func testCreatedTaskRemainsVisibleWhenAuthoritativeReloadFails() async {
        let data = InboxDataModel()
        let created = makeInboxTask(title: "Captured online")
        data.adoptCreated(created)

        await data.load(
            fetch: { throw InboxTestError.storeUnavailable },
            onUnauthorized: {}
        )

        XCTAssertEqual(data.items.map(\.title), ["Captured online"])
        XCTAssertFalse(data.loading)
    }

    func testUnauthorizedReloadInvokesSessionBoundaryWithoutClearingItems() async {
        let data = InboxDataModel()
        data.adoptCreated(makeInboxTask(title: "Already visible"))
        var invalidated = false

        await data.load(
            fetch: {
                throw APIError.unauthorized(
                    401,
                    .init(
                        code: "UNAUTHORIZED",
                        message: "Expired",
                        retryable: false,
                        details: nil
                    )
                )
            },
            onUnauthorized: { invalidated = true }
        )

        XCTAssertTrue(invalidated)
        XCTAssertEqual(data.items.map(\.title), ["Already visible"])
    }

    func testStaleReloadCannotOverwriteNewerCreatedTask() async {
        let data = InboxDataModel()
        let gate = InboxTaskFetchGate()
        let stale = Task {
            await data.load(
                fetch: {
                    await gate.wait()
                    return [makeInboxTask(title: "Stale")]
                },
                onUnauthorized: {}
            )
        }
        await gate.waitUntilEntered()

        data.adoptCreated(makeInboxTask(title: "New"))
        await gate.release()
        await stale.value

        XCTAssertEqual(data.items.map(\.title), ["New"])
    }

    func testSameScopeRelaunchPublishesTypedPendingCapture() async throws {
        let directory = temporaryDirectory()
        let store = NativeSyncStore(directory: directory)
        let first = NativeSyncCoordinator(
            store: store,
            transport: InboxSyncTransport()
        )
        try await first.activate(scope: "account-a")
        let mutation = try await first.enqueueTaskCreate(
            title: "Pack lunch",
            bucket: "inbox"
        )

        let relaunched = NativeSyncCoordinator(
            store: store,
            transport: InboxSyncTransport()
        )
        let app = AppState(syncCoordinator: relaunched)
        try await app.activateSync(scope: "account-a")
        let snapshot = try await relaunched.snapshot(scope: "account-a")

        XCTAssertEqual(
            app.pendingTaskCreates.map(\.mutationID),
            [mutation.id]
        )
        XCTAssertEqual(snapshot.pendingTaskCreates.count, 1)
        XCTAssertEqual(snapshot.pendingTaskCreates.first?.mutationID, mutation.id)
        XCTAssertEqual(snapshot.pendingTaskCreates.first?.title, "Pack lunch")
        XCTAssertEqual(snapshot.pendingTaskCreates.first?.bucket, "inbox")
        XCTAssertEqual(
            snapshot.pendingTaskCreates.first?.createdAt,
            mutation.createdAt
        )
    }

    func testSuccessfulReplayRemovesOnlyExactPendingCapture() async throws {
        let directory = temporaryDirectory()
        let transport = InboxSyncTransport()
        let coordinator = NativeSyncCoordinator(
            store: NativeSyncStore(directory: directory),
            transport: transport
        )
        try await coordinator.activate(scope: "account-a")
        let first = try await coordinator.enqueueTaskCreate(
            title: "First",
            bucket: "inbox"
        )
        let second = try await coordinator.enqueueTaskCreate(
            title: "Second",
            bucket: "inbox"
        )
        await transport.setTaskOutcomes([.success, .serverError])

        _ = try await coordinator.synchronize(scope: "account-a")
        let snapshot = try await coordinator.snapshot(scope: "account-a")

        XCTAssertEqual(
            snapshot.pendingTaskCreates.map(\.mutationID),
            [second.id]
        )
        XCTAssertFalse(
            snapshot.pendingTaskCreates.contains {
                $0.mutationID == first.id
            }
        )
    }

    private func temporaryDirectory() -> URL {
        let directory = FileManager.default.temporaryDirectory.appending(
            path: "OfflineInboxMutationTests-\(UUID())"
        )
        addTeardownBlock {
            try? FileManager.default.removeItem(at: directory)
        }
        return directory
    }

}

private enum InboxTestError: Error {
    case storeUnavailable
}

private actor InboxSubmissionGate {
    private var entered = false
    private var released = false
    private var enteredContinuation: CheckedContinuation<Void, Never>?
    private var releaseContinuation: CheckedContinuation<Void, Never>?

    func wait() async {
        entered = true
        enteredContinuation?.resume()
        enteredContinuation = nil
        guard !released else { return }
        await withCheckedContinuation { releaseContinuation = $0 }
    }

    func waitUntilEntered() async {
        guard !entered else { return }
        await withCheckedContinuation { enteredContinuation = $0 }
    }

    func release() {
        released = true
        releaseContinuation?.resume()
        releaseContinuation = nil
    }
}

private actor InboxTaskFetchGate {
    private var entered = false
    private var released = false
    private var enteredContinuation: CheckedContinuation<Void, Never>?
    private var releaseContinuation: CheckedContinuation<Void, Never>?

    func wait() async -> [TaskItem] {
        entered = true
        enteredContinuation?.resume()
        enteredContinuation = nil
        guard !released else { return [] }
        await withCheckedContinuation { releaseContinuation = $0 }
        return []
    }

    func waitUntilEntered() async {
        guard !entered else { return }
        await withCheckedContinuation { enteredContinuation = $0 }
    }

    func release() {
        released = true
        releaseContinuation?.resume()
        releaseContinuation = nil
    }
}

private actor InboxSyncTransport: NativeSyncTransport {
    enum TaskOutcome {
        case success
        case serverError
    }

    private var taskOutcomes: [TaskOutcome] = []

    func setTaskOutcomes(_ outcomes: [TaskOutcome]) {
        taskOutcomes = outcomes
    }

    func createTask(
        title: String,
        bucket: String,
        idempotencyKey: String?
    ) async throws -> TaskItem {
        let outcome = taskOutcomes.isEmpty
            ? .success
            : taskOutcomes.removeFirst()
        if outcome == .serverError {
            throw APIError.http(
                500,
                .init(
                    code: "SERVER_ERROR",
                    message: "Unavailable",
                    retryable: true,
                    details: nil
                )
            )
        }
        return makeInboxTask(title: title)
    }

    func activity(id: String) async throws -> Activity {
        throw InboxTestError.storeUnavailable
    }

    func setStatus(
        activityId: String,
        revision: Int,
        occurrenceKey: String?,
        status: ActivityStatus,
        completedAt: String?,
        idempotencyKey: String?
    ) async throws -> Activity {
        throw InboxTestError.storeUnavailable
    }

    func changes(cursor: String?, limit: Int?) async throws -> ChangesPage {
        .init(entries: [], nextCursor: nil, checkpointCursor: cursor)
    }
}

private func makeInboxTask(title: String) -> TaskItem {
    try! JSONDecoder().decode(
        TaskItem.self,
        from: Data(
            """
            {
              "id": "task-1",
              "title": "\(title)",
              "emoji": null,
              "bucket": "inbox",
              "priority": null,
              "revision": 1,
              "createdAt": null
            }
            """.utf8
        )
    )
}
