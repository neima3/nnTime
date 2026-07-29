import Foundation
import XCTest
@testable import Kairo

@MainActor
final class SyncConflictPresentationTests: XCTestCase {
    func testTaskConflictUsesPrivacySafeInboxCopy() throws {
        let conflict = makeConflict(
            operation: .taskCreate,
            reason: .clientError
        )

        let presentation = try XCTUnwrap(
            SyncConflictPresentation(
                conflict: conflict,
                surface: .inbox
            )
        )

        XCTAssertEqual(presentation.operationLabel, "Inbox capture")
        XCTAssertEqual(presentation.title, "Server version kept")
        XCTAssertEqual(
            presentation.message,
            "Your Inbox capture couldn’t be saved. Retry sync, or dismiss this notice."
        )
        XCTAssertEqual(
            presentation.retryAccessibilityLabel,
            "Retry syncing Inbox capture"
        )
        XCTAssertEqual(
            presentation.dismissAccessibilityLabel,
            "Dismiss Inbox capture conflict"
        )
    }

    func testActivityConflictUsesPrivacySafeTodayCopy() throws {
        let presentation = try XCTUnwrap(
            SyncConflictPresentation(
                conflict: makeConflict(
                    operation: .activityStatus,
                    reason: .activityMissing
                ),
                surface: .today
            )
        )

        XCTAssertEqual(
            presentation.operationLabel,
            "Activity status change"
        )
        XCTAssertEqual(
            presentation.message,
            "Your activity status change couldn’t be applied. Retry sync, or dismiss this notice."
        )
    }

    func testConflictsOnlyRouteToTheirRelevantSurface() {
        let task = makeConflict(operation: .taskCreate)
        let status = makeConflict(operation: .activityStatus)

        XCTAssertNotNil(
            SyncConflictPresentation(conflict: task, surface: .inbox)
        )
        XCTAssertNil(
            SyncConflictPresentation(conflict: task, surface: .today)
        )
        XCTAssertNotNil(
            SyncConflictPresentation(conflict: status, surface: .today)
        )
        XCTAssertNil(
            SyncConflictPresentation(conflict: status, surface: .inbox)
        )
    }

    func testCopyCannotDisclosePayloadOrServerErrorBody() throws {
        let sensitiveValues = [
            "Call Dr. Private",
            "patient@example.test",
            "Bearer secret-token",
            "raw server response",
        ]

        for operation in [
            NativeSyncConflict.Operation.taskCreate,
            .activityStatus,
        ] {
            let surface: SyncConflictSurface =
                operation == .taskCreate ? .inbox : .today
            let presentation = try XCTUnwrap(
                SyncConflictPresentation(
                    conflict: makeConflict(operation: operation),
                    surface: surface
                )
            )
            let renderedCopy = [
                presentation.operationLabel,
                presentation.title,
                presentation.message,
                presentation.retryAccessibilityLabel,
                presentation.dismissAccessibilityLabel,
            ].joined(separator: " ")

            for sensitiveValue in sensitiveValues {
                XCTAssertFalse(renderedCopy.contains(sensitiveValue))
            }
        }
    }

    func testRetryRunsExplicitSynchronizationWithoutAcknowledgingConflict() async {
        let model = SyncConflictNoticeModel()
        let recorder = SyncConflictActionRecorder()

        await model.retry { explicit in
            await recorder.recordRetry(explicit: explicit)
        }

        let values = await recorder.values
        XCTAssertEqual(values.retryFlags, [true])
        XCTAssertEqual(values.acknowledgedIDs, [])
        XCTAssertFalse(model.isRetrying)
    }

    func testDismissAcknowledgesExactConflictWithoutRetrying() async {
        let model = SyncConflictNoticeModel()
        let recorder = SyncConflictActionRecorder()
        let conflictID = UUID()

        await model.dismiss(conflictID: conflictID) { id in
            await recorder.recordAcknowledgement(id)
        }

        let values = await recorder.values
        XCTAssertEqual(values.retryFlags, [])
        XCTAssertEqual(values.acknowledgedIDs, [conflictID])
    }

    func testReplayConfirmationOnlyIncludesSuccessfullyRemovedMutations() {
        let replayedTaskID = UUID()
        let terminalStatusID = UUID()
        let stillPendingID = UUID()

        let operations = SyncReplayConfirmationPolicy.operations(
            before: [
                replayedTaskID: .taskCreate,
                terminalStatusID: .activityStatus,
                stillPendingID: .activityStatus,
            ],
            afterPendingIDs: [stillPendingID],
            conflicts: [
                makeConflict(
                    mutationID: terminalStatusID,
                    operation: .activityStatus
                ),
            ]
        )

        XCTAssertEqual(operations, [.taskCreate])
    }

    func testReplayConfirmationCopyAndAccessibilityAreExplicit() {
        let confirmation = SyncReplayConfirmationPresentation(
            operation: .activityStatus
        )

        XCTAssertEqual(confirmation.title, "Synced")
        XCTAssertEqual(
            confirmation.message,
            "Your activity status change is up to date."
        )
        XCTAssertEqual(
            confirmation.accessibilityLabel,
            "Sync complete. Your activity status change is up to date."
        )
    }

    func testAppPublishesMintStateOnlyAfterSuccessfulReplay() async throws {
        let (app, _) = try makeApp(
            transport: SyncConflictPresentationTransport()
        )
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(
            title: "Synthetic capture",
            bucket: "inbox"
        )

        await app.synchronize(explicitRetry: true)

        XCTAssertEqual(app.syncReplayConfirmationGeneration, 1)
        XCTAssertEqual(app.lastReplayedOperations, [.taskCreate])
        XCTAssertEqual(app.pendingSyncCount, 0)
    }

    func testTerminalConflictSurvivesRetryUntilExactDismiss() async throws {
        let (app, _) = try makeApp(
            transport: SyncConflictPresentationTransport(
                createError: APIError.http(
                    422,
                    .init(
                        code: "VALIDATION_ERROR",
                        message: "raw server response",
                        retryable: false,
                        details: nil
                    )
                )
            )
        )
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(
            title: "Patient-private synthetic title",
            bucket: "inbox"
        )

        await app.synchronize()
        let conflict = try XCTUnwrap(app.syncConflicts.first)
        XCTAssertEqual(app.syncReplayConfirmationGeneration, 0)

        await app.synchronize(explicitRetry: true)
        XCTAssertEqual(app.syncConflicts, [conflict])
        XCTAssertEqual(app.syncReplayConfirmationGeneration, 0)

        await app.acknowledgeSyncConflict(id: conflict.id)
        XCTAssertTrue(app.syncConflicts.isEmpty)
    }

    private func makeApp(
        transport: SyncConflictPresentationTransport
    ) throws -> (AppState, NativeSyncCoordinator) {
        let directory = FileManager.default.temporaryDirectory.appending(
            path: "KairoSyncConflictPresentationTests-\(UUID())"
        )
        addTeardownBlock {
            try? FileManager.default.removeItem(at: directory)
        }
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

    private func makeConflict(
        id: UUID = UUID(),
        mutationID: UUID = UUID(),
        operation: NativeSyncConflict.Operation,
        reason: NativeSyncConflict.Reason? = .clientError
    ) -> NativeSyncConflict {
        .init(
            id: id,
            mutationID: mutationID,
            operation: operation,
            reason: reason,
            recordedAt: Date(timeIntervalSince1970: 1_000)
        )
    }
}

private actor SyncConflictPresentationTransport: NativeSyncTransport {
    let createError: APIError?

    init(createError: APIError? = nil) {
        self.createError = createError
    }

    func createTask(
        title: String,
        bucket: String,
        idempotencyKey: String?
    ) async throws -> TaskItem {
        if let createError {
            throw createError
        }
        return .init(
            id: "synthetic-task",
            title: title,
            emoji: nil,
            bucket: bucket,
            priority: nil,
            revision: 1,
            createdAt: nil
        )
    }

    func activity(id: String) async throws -> Activity {
        fatalError("Unused by presentation tests")
    }

    func setStatus(
        activityId: String,
        revision: Int,
        occurrenceKey: String?,
        status: ActivityStatus,
        completedAt: String?,
        idempotencyKey: String?
    ) async throws -> Activity {
        fatalError("Unused by presentation tests")
    }

    func changes(
        cursor: String?,
        limit: Int?
    ) async throws -> ChangesPage {
        .init(
            entries: [],
            nextCursor: nil,
            checkpointCursor: nil
        )
    }
}

private actor SyncConflictActionRecorder {
    private var retryFlags: [Bool] = []
    private var acknowledgedIDs: [UUID] = []

    func recordRetry(explicit: Bool) {
        retryFlags.append(explicit)
    }

    func recordAcknowledgement(_ id: UUID) {
        acknowledgedIDs.append(id)
    }

    var values: (retryFlags: [Bool], acknowledgedIDs: [UUID]) {
        (retryFlags, acknowledgedIDs)
    }
}
