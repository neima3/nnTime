import XCTest
@testable import Kairo

final class OfflineTodayMutationTests: XCTestCase {
    func testCachedDayPolicyAllowsOnlyCompletionStatus() {
        let policy = OfflineTodayMutationPolicy.cachedDay

        XCTAssertTrue(policy.canChangeCompletion)
        XCTAssertFalse(policy.canEdit)
        XCTAssertFalse(policy.canMove)
        XCTAssertFalse(policy.canDelete)
        XCTAssertFalse(policy.canFocus)
        XCTAssertFalse(policy.canReview)
        XCTAssertFalse(policy.canBrowseTemplates)
        XCTAssertFalse(policy.canCreate)
    }

    func testOccurrenceIdentityIncludesActivityIDAndOccurrenceKey() throws {
        let first = try XCTUnwrap(
            OfflineTodayOccurrenceIdentity(block: Self.block())
        )
        let second = try XCTUnwrap(
            OfflineTodayOccurrenceIdentity(
                activityID: "activity-2",
                occurrenceKey: "2026-07-29T09:00:00"
            )
        )

        XCTAssertNotEqual(first, second)
        XCTAssertEqual(Set([first, second]).count, 2)
    }

    func testPendingOccurrenceCannotBeginASecondSubmission() throws {
        let identity = try XCTUnwrap(
            OfflineTodayOccurrenceIdentity(block: Self.block())
        )

        XCTAssertTrue(
            OfflineTodayMutationPolicy.cachedDay.canBegin(
                identity,
                pending: []
            )
        )
        XCTAssertFalse(
            OfflineTodayMutationPolicy.cachedDay.canBegin(
                identity,
                pending: [identity]
            )
        )
    }

    func testPendingStatusOverlayUsesLatestDurableDesiredStatus() throws {
        let block = Self.block()
        let overlaid = CachedDayAdapter.overlayPendingStatuses(
            [
                .init(
                    mutationID: UUID(),
                    activityID: block.id,
                    occurrenceKey: try XCTUnwrap(block.occurrenceKey),
                    status: .completed
                ),
                .init(
                    mutationID: UUID(),
                    activityID: block.id,
                    occurrenceKey: try XCTUnwrap(block.occurrenceKey),
                    status: .pending
                ),
            ],
            on: [block]
        )

        XCTAssertFalse(overlaid[0].done)
    }

    func testLoadResultsApplyOnlyToCurrentRequestedDate() {
        XCTAssertTrue(
            TodayLoadPolicy.shouldApply(
                responseDate: "2026-07-29",
                requestedDate: "2026-07-29"
            )
        )
        XCTAssertFalse(
            TodayLoadPolicy.shouldApply(
                responseDate: "2026-07-29",
                requestedDate: "2026-07-30"
            )
        )
    }

    func testUncachedFailureClearsStaleBlocksAndLocksMutations() {
        let state = TodayLoadPolicy.failureState(cachedBlocks: nil)

        XCTAssertTrue(state.blocks.isEmpty)
        XCTAssertTrue(state.mutationsLocked)
        XCTAssertFalse(state.usingCachedDay)
    }

    func testVisiblePendingOccurrencesExcludeAnotherDay() throws {
        let today = Self.block(
            activityID: "today",
            occurrenceKey: "today-occurrence"
        )
        let statuses = [
            NativeSyncPendingActivityStatus(
                mutationID: UUID(),
                activityID: "tomorrow",
                occurrenceKey: "tomorrow-occurrence",
                status: .completed
            ),
        ]

        let visible = CachedDayAdapter.visiblePendingOccurrences(
            statuses,
            inFlight: [],
            blocks: [today]
        )

        XCTAssertTrue(visible.isEmpty)
    }

    func testOnlineVisiblePendingRowStillShowsSavedOnDeviceNotice() {
        XCTAssertEqual(
            TodayLoadPolicy.noticeMode(
                mutationsLocked: false,
                usingCachedDay: false,
                hasVisiblePending: true
            ),
            .savedOnDevice
        )
    }

    func testPendingOnlineRowOmitsCompletionAccessibilityAction() {
        XCTAssertFalse(
            TodayBlockActionPolicy.canExposeCompletionAction(
                readOnly: false,
                pending: true,
                offlineCompletionEligible: true
            )
        )
        XCTAssertTrue(
            TodayBlockActionPolicy.canExposeCompletionAction(
                readOnly: false,
                pending: false,
                offlineCompletionEligible: true
            )
        )
    }

    func testCompletionUpdateChangesOnlyCompositeIdentity() throws {
        let first = Self.block()
        let second = Self.block(
            activityID: "activity-2",
            occurrenceKey: first.occurrenceKey
        )

        let updated = try CachedDayAdapter.settingCompletion(
            true,
            for: first,
            in: [first, second]
        )

        XCTAssertTrue(updated[0].done)
        XCTAssertFalse(updated[1].done)
    }

    func testCompletionUpdateRefusesAmbiguousCompositeIdentity() {
        let block = Self.block()

        XCTAssertThrowsError(
            try CachedDayAdapter.settingCompletion(
                true,
                for: block,
                in: [block, block]
            )
        )
    }

    func testCompletionUpdateRefusesMissingOccurrenceIdentity() {
        let block = Self.block(occurrenceKey: nil)

        XCTAssertThrowsError(
            try CachedDayAdapter.settingCompletion(
                true,
                for: block,
                in: [block]
            )
        )
    }

    @MainActor
    func testMutationEnqueuesBeforeOptimisticRenderAndPersistence() async throws {
        var events: [String] = []
        var renderedDone = false
        let mutation = OfflineTodayStatusMutation(
            enqueue: { _, _, _, _ in events.append("enqueue") },
            persist: { _, _, _, _, _ in events.append("persist") }
        )

        try await mutation.perform(
            scope: "account-a",
            date: "2026-07-29",
            block: Self.block(),
            done: true,
            render: {
                renderedDone = $0
                events.append("render")
            }
        )

        XCTAssertTrue(renderedDone)
        XCTAssertEqual(events, ["enqueue", "render", "persist"])
    }

    @MainActor
    func testMutationDoesNotRenderWhenProtectedEnqueueFails() async {
        var renderedValues: [Bool] = []
        let mutation = OfflineTodayStatusMutation(
            enqueue: { _, _, _, _ in throw TestError.enqueue },
            persist: { _, _, _, _, _ in XCTFail("must not persist") }
        )

        await XCTAssertThrowsErrorAsync(expectedStage: .enqueue) {
            try await mutation.perform(
                scope: "account-a",
                date: "2026-07-29",
                block: Self.block(),
                done: true,
                render: { renderedValues.append($0) }
            )
        }

        XCTAssertTrue(renderedValues.isEmpty)
    }

    @MainActor
    func testMutationRollsBackVisibleStateWhenCachePersistenceFails() async {
        var renderedValues: [Bool] = []
        let mutation = OfflineTodayStatusMutation(
            enqueue: { _, _, _, _ in },
            persist: { _, _, _, _, _ in throw TestError.persist }
        )

        await XCTAssertThrowsErrorAsync(expectedStage: .cachePersistence) {
            try await mutation.perform(
                scope: "account-a",
                date: "2026-07-29",
                block: Self.block(),
                done: true,
                render: { renderedValues.append($0) }
            )
        }

        XCTAssertEqual(renderedValues, [true, false])
    }

    @MainActor
    func testMutationRequiresExactOccurrenceIdentity() async {
        var enqueued = false
        let mutation = OfflineTodayStatusMutation(
            enqueue: { _, _, _, _ in enqueued = true },
            persist: { _, _, _, _, _ in }
        )
        var block = Self.block()
        block = DayBlock(
            id: block.id,
            title: block.title,
            emoji: block.emoji,
            startMin: block.startMin,
            durationMin: block.durationMin,
            category: block.category,
            done: block.done,
            recurring: block.recurring,
            revision: block.revision,
            occurrenceKey: nil,
            checklist: block.checklist
        )

        await XCTAssertThrowsErrorAsync {
            try await mutation.perform(
                scope: "account-a",
                date: "2026-07-29",
                block: block,
                done: true,
                render: { _ in }
            )
        }

        XCTAssertFalse(enqueued)
    }

    private static func block(
        activityID: String = "activity-1",
        occurrenceKey: String? = "2026-07-29T09:00:00"
    ) -> DayBlock {
        DayBlock(
            id: activityID,
            title: "Plan",
            emoji: "✨",
            startMin: 540,
            durationMin: 30,
            category: .butter,
            done: false,
            recurring: true,
            revision: 2,
            occurrenceKey: occurrenceKey,
            checklist: []
        )
    }
}

private enum TestError: Error {
    case enqueue
    case persist
}

@MainActor
private func XCTAssertThrowsErrorAsync(
    expectedStage: OfflineTodayStatusMutation.Failure.Stage? = nil,
    _ expression: () async throws -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
) async {
    do {
        try await expression()
        XCTFail("Expected error", file: file, line: line)
    } catch {
        if let expectedStage {
            XCTAssertEqual(
                (error as? OfflineTodayStatusMutation.Failure)?.stage,
                expectedStage,
                file: file,
                line: line
            )
        }
    }
}
