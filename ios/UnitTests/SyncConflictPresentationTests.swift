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
        XCTAssertEqual(presentation.title, "Inbox capture not saved")
        XCTAssertEqual(
            presentation.message,
            "Kairo didn’t save this capture on the server. Retry, or dismiss to remove this saved recovery copy."
        )
        XCTAssertEqual(
            presentation.retryAccessibilityLabel,
            "Retry syncing Inbox capture"
        )
        XCTAssertTrue(presentation.canRetry)
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
        XCTAssertEqual(presentation.title, "Activity unavailable")
        XCTAssertEqual(
            presentation.message,
            "This activity is no longer available, so the status change wasn’t applied. Retry, or dismiss to remove this saved recovery copy."
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
                    conflict: makeConflict(
                        operation: operation,
                        payloadTitle: "Call Dr. Private"
                    ),
                    surface: surface
                )
            )
            let renderedCopy = [
                presentation.operationLabel,
                presentation.title,
                presentation.message,
                presentation.retryAccessibilityLabel,
                presentation.dismissAccessibilityLabel,
            ].compactMap { $0 }.joined(separator: " ")

            for sensitiveValue in sensitiveValues {
                XCTAssertFalse(renderedCopy.contains(sensitiveValue))
            }
        }
    }

    func testLegacyConflictHidesRetryAndUsesTruthfulDismissOnlyCopy()
        throws
    {
        let presentation = try XCTUnwrap(
            SyncConflictPresentation(
                conflict: makeConflict(
                    operation: .taskCreate,
                    retryAvailable: false
                ),
                surface: .inbox
            )
        )

        XCTAssertFalse(presentation.canRetry)
        XCTAssertNil(presentation.retryAccessibilityLabel)
        XCTAssertEqual(
            presentation.message,
            "Kairo didn’t save this capture on the server. This older recovery copy can’t be retried. Dismiss to remove it."
        )
        XCTAssertFalse(presentation.message.contains("Retry sync"))
        XCTAssertEqual(
            presentation.dismissAccessibilityLabel,
            "Dismiss Inbox capture conflict"
        )
    }

    func testCurrentConflictExposesFunctionalRetryPolicy() throws {
        let presentation = try XCTUnwrap(
            SyncConflictPresentation(
                conflict: makeConflict(
                    operation: .activityStatus,
                    retryAvailable: true
                ),
                surface: .today
            )
        )

        XCTAssertTrue(presentation.canRetry)
        XCTAssertEqual(
            presentation.retryAccessibilityLabel,
            "Retry syncing Activity status change"
        )
        XCTAssertEqual(presentation.title, "Status change not applied")
        XCTAssertEqual(
            presentation.message,
            "Kairo didn’t apply this status change. Retry, or dismiss to remove this saved recovery copy."
        )
    }

    func testRetryTargetsExactConflictWithoutAcknowledgingIt() async {
        let model = SyncConflictNoticeModel()
        let recorder = SyncConflictActionRecorder()
        let conflictID = UUID()

        let outcome = await model.retry(conflictID: conflictID) { id in
            await recorder.recordRetry(id)
            return .succeeded
        }

        let values = await recorder.values
        XCTAssertEqual(outcome, .succeeded)
        XCTAssertEqual(values.retriedIDs, [conflictID])
        XCTAssertEqual(values.acknowledgedIDs, [])
        XCTAssertFalse(model.isRetrying)
    }

    func testRetryFailureShowsPrivacySafeInlineStateAndAnnouncement() async {
        let model = SyncConflictNoticeModel()
        let conflictID = UUID()

        let outcome = await model.retry(conflictID: conflictID) { _ in
            .failed
        }

        XCTAssertEqual(outcome, .failed)
        XCTAssertEqual(
            model.retryFailureMessage,
            "Couldn’t retry this change. Your recovery copy is still saved here."
        )
        XCTAssertEqual(model.retryAnnouncementGeneration, 1)
        XCTAssertEqual(model.retryFailureConflictID, conflictID)
        XCTAssertEqual(
            SyncAccessibilityAnnouncementPolicy.retryFailure.message,
            model.retryFailureMessage
        )
    }

    func testCancelledRetryDoesNotShowOrAnnounceFailure() async {
        let model = SyncConflictNoticeModel()

        let outcome = await model.retry(conflictID: UUID()) { _ in
            .cancelled
        }

        XCTAssertEqual(outcome, .cancelled)
        XCTAssertNil(model.retryFailureMessage)
        XCTAssertEqual(model.retryAnnouncementGeneration, 0)
    }

    func testConflictCarouselReachesEveryConflictAndWraps() {
        let ids = [UUID(), UUID(), UUID()]
        let model = SyncConflictCarouselModel()

        model.update(ids: ids)
        XCTAssertEqual(model.selectedID, ids[0])
        XCTAssertEqual(model.position, 1)
        XCTAssertEqual(model.count, 3)

        model.next()
        XCTAssertEqual(model.selectedID, ids[1])
        model.next()
        XCTAssertEqual(model.selectedID, ids[2])
        model.next()
        XCTAssertEqual(model.selectedID, ids[0])
        model.previous()
        XCTAssertEqual(model.selectedID, ids[2])
    }

    func testConflictCarouselKeepsSelectionAcrossInsertion() {
        let inserted = UUID()
        let ids = [UUID(), UUID(), UUID()]
        let model = SyncConflictCarouselModel()
        model.update(ids: ids)
        model.next()

        model.update(ids: [inserted] + ids)

        XCTAssertEqual(model.selectedID, ids[1])
        XCTAssertEqual(model.position, 3)
    }

    func testConflictCarouselAdvancesAfterSelectedConflictDismissal() {
        let ids = [UUID(), UUID(), UUID()]
        let model = SyncConflictCarouselModel()
        model.update(ids: ids)
        model.next()

        model.update(ids: [ids[0], ids[2]])

        XCTAssertEqual(model.selectedID, ids[2])
        XCTAssertEqual(model.position, 2)
        XCTAssertEqual(model.count, 2)
    }

    func testInteractionBlocksNavigationDuringRetryAndKeepsFailureAttached()
        async
    {
        let ids = [UUID(), UUID()]
        let interaction = SyncConflictInteractionModel()
        interaction.update(ids: ids)
        let gate = SyncConflictRetryOutcomeGate()

        let retry = Task {
            await interaction.notice.retry(
                conflictID: ids[0]
            ) { _ in
                await gate.wait()
                return .failed
            }
        }
        await gate.waitUntilEntered()

        interaction.next()
        interaction.previous()
        XCTAssertEqual(interaction.carousel.selectedID, ids[0])
        XCTAssertTrue(interaction.notice.isRetrying)

        await gate.release()
        let outcome = await retry.value
        XCTAssertEqual(outcome, .failed)
        XCTAssertEqual(
            interaction.notice.retryFailureConflictID,
            ids[0]
        )
        XCTAssertEqual(
            interaction.notice.retryFailureMessage,
            "Couldn’t retry this change. Your recovery copy is still saved here."
        )
        XCTAssertEqual(
            interaction.notice.retryAnnouncementGeneration,
            1
        )
    }

    func testConflictActionsAdaptFromHorizontalToVertical() {
        XCTAssertEqual(
            SyncConflictActionLayoutPolicy.candidates,
            [.horizontal, .vertical]
        )
        XCTAssertEqual(
            SyncConflictActionLayoutPolicy.minimumTarget,
            44
        )
    }

    func testDismissAcknowledgesExactConflictWithoutRetrying() async {
        let model = SyncConflictNoticeModel()
        let recorder = SyncConflictActionRecorder()
        let conflictID = UUID()

        await model.dismiss(conflictID: conflictID) { id in
            await recorder.recordAcknowledgement(id)
        }

        let values = await recorder.values
        XCTAssertEqual(values.retriedIDs, [])
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
        XCTAssertEqual(
            SyncAccessibilityAnnouncementPolicy.replaySuccess(
                confirmation
            ).message,
            confirmation.accessibilityLabel
        )
    }

    func testConsecutiveReplaySuccessesRequestTwoAnnouncementsAndResetExpiry() {
        let model = SyncReplayConfirmationModel()
        var announcements: [String] = []

        let firstGeneration = model.show(
            operation: .taskCreate,
            announce: { announcements.append($0.message) }
        )
        let secondGeneration = model.show(
            operation: .taskCreate,
            announce: { announcements.append($0.message) }
        )

        XCTAssertEqual(firstGeneration, 1)
        XCTAssertEqual(secondGeneration, 2)
        XCTAssertEqual(model.expirationGeneration, 2)
        XCTAssertEqual(announcements.count, 2)
        XCTAssertFalse(model.clear(ifGeneration: firstGeneration))
        XCTAssertNotNil(model.presentation)
        XCTAssertTrue(model.clear(ifGeneration: secondGeneration))
        XCTAssertNil(model.presentation)
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
                createStatuses: [422, 422]
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

        let retryOutcome = await app.retrySyncConflict(id: conflict.id)
        XCTAssertEqual(retryOutcome, .failed)
        XCTAssertEqual(app.syncConflicts, [conflict])
        XCTAssertEqual(app.syncReplayConfirmationGeneration, 0)

        await app.acknowledgeSyncConflict(id: conflict.id)
        XCTAssertTrue(app.syncConflicts.isEmpty)
    }

    func testTargetedRetryReusesIdempotencyAndRemovesExactConflictOnSuccess()
        async throws
    {
        let transport = SyncConflictPresentationTransport(
            createStatuses: [422, nil]
        )
        let (app, _) = try makeApp(transport: transport)
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(
            title: "Synthetic retry",
            bucket: "inbox"
        )

        await app.synchronize()
        let conflict = try XCTUnwrap(app.syncConflicts.first)
        let retryOutcome = await app.retrySyncConflict(id: conflict.id)

        XCTAssertEqual(retryOutcome, .succeeded)
        XCTAssertTrue(app.syncConflicts.isEmpty)
        XCTAssertEqual(app.syncReplayConfirmationGeneration, 1)
        XCTAssertEqual(app.lastReplayedOperations, [.taskCreate])
        let events = await transport.createEvents
        XCTAssertEqual(events.count, 2)
        XCTAssertEqual(events[0].idempotencyKey, events[1].idempotencyKey)
        XCTAssertEqual(events[0].title, "Synthetic retry")
        XCTAssertEqual(events[1].title, "Synthetic retry")
    }

    func testTargetedRetryRejectsStaleScopeWithoutTransportCall() async throws {
        let transport = SyncConflictPresentationTransport(
            createStatuses: [422]
        )
        let (app, coordinator) = try makeApp(transport: transport)
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(
            title: "Account A",
            bucket: "inbox"
        )
        await app.synchronize()
        let conflictID = try XCTUnwrap(app.syncConflicts.first?.id)

        try await coordinator.activate(scope: "account-b")

        do {
            _ = try await coordinator.retryConflict(
                scope: "account-a",
                id: conflictID
            )
            XCTFail("Expected stale scope rejection")
        } catch let error as NativeSyncCoordinatorError {
            XCTAssertEqual(error, .inactiveScope)
        }
        let events = await transport.createEvents
        XCTAssertEqual(events.count, 1)
    }

    func testDuplicateConcurrentTargetedRetryReplaysOnce() async throws {
        let transport = SyncConflictPresentationTransport(
            createStatuses: [422, nil],
            suspendSuccessfulCreate: true
        )
        let (app, coordinator) = try makeApp(transport: transport)
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(
            title: "Only once",
            bucket: "inbox"
        )
        await app.synchronize()
        let conflictID = try XCTUnwrap(app.syncConflicts.first?.id)

        async let first = coordinator.retryConflict(
            scope: "account-a",
            id: conflictID
        )
        await transport.waitUntilSuccessfulCreateStarts()
        async let duplicate = coordinator.retryConflict(
            scope: "account-a",
            id: conflictID
        )
        await transport.resumeSuccessfulCreate()

        _ = try await first
        _ = try await duplicate
        let events = await transport.createEvents
        XCTAssertEqual(events.count, 2)
    }

    func testAccountSwitchCancellationDoesNotAnnounceRetryFailure()
        async throws
    {
        let transport = SyncConflictPresentationTransport(
            createStatuses: [422, nil],
            suspendSuccessfulCreate: true
        )
        let (app, _) = try makeApp(transport: transport)
        app.auth = .signedIn
        app.sessionScope = "account-a"
        try await app.activateSync(scope: "account-a")
        _ = try await app.enqueueTaskCreate(
            title: "Account A only",
            bucket: "inbox"
        )
        await app.synchronize()
        let conflictID = try XCTUnwrap(app.syncConflicts.first?.id)
        let model = SyncConflictNoticeModel()

        let retry = Task {
            await model.retry(conflictID: conflictID) { id in
                await app.retrySyncConflict(id: id)
            }
        }
        await transport.waitUntilSuccessfulCreateStarts()
        let accountSwitch = Task {
            await app.prepareForAccountSwitch(newScope: "account-b")
        }
        await transport.waitUntilSuccessfulCreateIsCancelled()
        await transport.resumeSuccessfulCreate()

        let outcome = await retry.value
        let switched = await accountSwitch.value
        XCTAssertTrue(switched)
        XCTAssertEqual(outcome, .cancelled)
        XCTAssertNil(model.retryFailureMessage)
        XCTAssertEqual(model.retryAnnouncementGeneration, 0)
    }

    func testLegacyConflictWithoutRetryPayloadStillDecodes() throws {
        let legacyJSON = """
        {
          "id":"00000000-0000-0000-0000-000000000101",
          "mutationID":"00000000-0000-0000-0000-000000000102",
          "operation":"taskCreate",
          "reason":"clientError",
          "recordedAt":1000
        }
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970

        let conflict = try decoder.decode(
            NativeSyncConflict.self,
            from: Data(legacyJSON.utf8)
        )

        XCTAssertNil(conflict.retryMutation)
        XCTAssertEqual(conflict.operation, .taskCreate)
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
        reason: NativeSyncConflict.Reason? = .clientError,
        retryAvailable: Bool = true,
        payloadTitle: String = "Synthetic payload"
    ) -> NativeSyncConflict {
        .init(
            id: id,
            mutationID: mutationID,
            operation: operation,
            reason: reason,
            recordedAt: Date(timeIntervalSince1970: 1_000),
            retryMutation:
                retryAvailable
                    ? makeMutation(
                        id: mutationID,
                        operation: operation,
                        payloadTitle: payloadTitle
                    )
                    : nil
        )
    }

    private func makeMutation(
        id: UUID,
        operation: NativeSyncConflict.Operation,
        payloadTitle: String
    ) -> NativeSyncMutation {
        let kind: NativeSyncMutation.Kind
        switch operation {
        case .taskCreate:
            kind = .taskCreate(
                .init(
                    idempotencyKey: "private-idempotency-key",
                    title: payloadTitle,
                    bucket: "inbox"
                )
            )
        case .activityStatus:
            kind = .activityStatus(
                .init(
                    idempotencyKey: "private-idempotency-key",
                    activityID: "private-activity-id",
                    status: ActivityStatus.completed.rawValue,
                    occurredAt: Date(timeIntervalSince1970: 900),
                    occurrenceKey: "private-occurrence-key"
                )
            )
        }
        return .init(
            id: id,
            createdAt: Date(timeIntervalSince1970: 900),
            nextAttemptAt: nil,
            kind: kind
        )
    }
}

private actor SyncConflictPresentationTransport: NativeSyncTransport {
    struct CreateEvent: Equatable {
        let title: String
        let idempotencyKey: String?
    }

    private var createStatuses: [Int?]
    private let suspendSuccessfulCreate: Bool
    private var didSuspendSuccessfulCreate = false
    private var successfulCreateStarted = false
    private var successfulCreateWaiters:
        [CheckedContinuation<Void, Never>] = []
    private var successfulCreateResume:
        CheckedContinuation<Void, Never>?
    private var successfulCreateCancellationObserved = false
    private var successfulCreateCancellationWaiters:
        [CheckedContinuation<Void, Never>] = []
    private(set) var createEvents: [CreateEvent] = []

    init(
        createStatuses: [Int?] = [],
        suspendSuccessfulCreate: Bool = false
    ) {
        self.createStatuses = createStatuses
        self.suspendSuccessfulCreate = suspendSuccessfulCreate
    }

    func createTask(
        title: String,
        bucket: String,
        idempotencyKey: String?
    ) async throws -> TaskItem {
        createEvents.append(
            .init(title: title, idempotencyKey: idempotencyKey)
        )
        let status = createStatuses.isEmpty
            ? nil
            : createStatuses.removeFirst()
        if let status {
            throw APIError.http(
                status,
                .init(
                    code: "VALIDATION_ERROR",
                    message: "raw server response",
                    retryable: false,
                    details: nil
                )
            )
        }
        if suspendSuccessfulCreate, !didSuspendSuccessfulCreate {
            didSuspendSuccessfulCreate = true
            successfulCreateStarted = true
            let waiters = successfulCreateWaiters
            successfulCreateWaiters.removeAll()
            waiters.forEach { $0.resume() }
            await withTaskCancellationHandler {
                await withCheckedContinuation {
                    successfulCreateResume = $0
                }
            } onCancel: {
                Task {
                    await self.observeSuccessfulCreateCancellation()
                }
            }
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

    func waitUntilSuccessfulCreateStarts() async {
        guard !successfulCreateStarted else { return }
        await withCheckedContinuation {
            successfulCreateWaiters.append($0)
        }
    }

    func resumeSuccessfulCreate() {
        successfulCreateResume?.resume()
        successfulCreateResume = nil
    }

    func waitUntilSuccessfulCreateIsCancelled() async {
        guard !successfulCreateCancellationObserved else { return }
        await withCheckedContinuation {
            successfulCreateCancellationWaiters.append($0)
        }
    }

    private func observeSuccessfulCreateCancellation() {
        successfulCreateCancellationObserved = true
        let waiters = successfulCreateCancellationWaiters
        successfulCreateCancellationWaiters.removeAll()
        waiters.forEach { $0.resume() }
    }
}

private actor SyncConflictActionRecorder {
    private var retriedIDs: [UUID] = []
    private var acknowledgedIDs: [UUID] = []

    func recordRetry(_ id: UUID) {
        retriedIDs.append(id)
    }

    func recordAcknowledgement(_ id: UUID) {
        acknowledgedIDs.append(id)
    }

    var values: (retriedIDs: [UUID], acknowledgedIDs: [UUID]) {
        (retriedIDs, acknowledgedIDs)
    }
}

private actor SyncConflictRetryOutcomeGate {
    private var entered = false
    private var enteredWaiters:
        [CheckedContinuation<Void, Never>] = []
    private var continuation: CheckedContinuation<Void, Never>?

    func wait() async {
        entered = true
        let waiters = enteredWaiters
        enteredWaiters.removeAll()
        waiters.forEach { $0.resume() }
        await withCheckedContinuation {
            continuation = $0
        }
    }

    func waitUntilEntered() async {
        guard !entered else { return }
        await withCheckedContinuation {
            enteredWaiters.append($0)
        }
    }

    func release() {
        continuation?.resume()
        continuation = nil
    }
}
