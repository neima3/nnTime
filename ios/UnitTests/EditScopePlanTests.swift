import XCTest
@testable import Kairo

/// ADR-001 edit scopes, as the native editor decides them.
///
/// The single most important fact about the editor sheet is which answer is
/// preselected: before this, `EditorSheet` had no `editScope` at all, so a
/// rename on one Tuesday rewrote every occurrence of the series. These pin the
/// default so a future refactor cannot quietly restore that.
final class EditScopePlanTests: XCTestCase {
    private let key = "2026-08-14T13:00:00.000Z"

    // MARK: Defaults

    func testRepeatingOccurrenceAsksAndDefaultsToJustThisTime() {
        let plan = EditScopePlan(repeats: true, occurrenceKey: key)
        XCTAssertTrue(plan.asksScope)
        XCTAssertNil(plan.silentScope)
        XCTAssertEqual(plan.defaultChoice, .this)
        XCTAssertFalse(plan.scopedChoicesDisabled)
        XCTAssertTrue(plan.allows(.this))
        XCTAssertTrue(plan.allows(.thisAndFuture))
        XCTAssertTrue(plan.allows(.all))
    }

    func testOneOffWritesTheWholeSeriesWithoutAsking() {
        let plan = EditScopePlan(repeats: false, occurrenceKey: key)
        XCTAssertFalse(plan.asksScope)
        XCTAssertEqual(plan.silentScope, .all)
        XCTAssertEqual(plan.defaultChoice, .all)
    }

    func testOneOffWithoutAnOccurrenceKeyStillNeedsNoPrompt() {
        let plan = EditScopePlan(repeats: false, occurrenceKey: nil)
        XCTAssertFalse(plan.asksScope)
        XCTAssertEqual(plan.silentScope, .all)
    }

    /// No day identity → the scoped rows are disabled and NOTHING is
    /// preselected, so the whole-series answer needs an explicit tap.
    func testMissingOccurrenceKeyDisablesScopedChoicesAndPreselectsNothing() {
        let plan = EditScopePlan(repeats: true, occurrenceKey: nil)
        XCTAssertTrue(plan.asksScope)
        XCTAssertNil(plan.silentScope)
        XCTAssertNil(plan.defaultChoice)
        XCTAssertTrue(plan.scopedChoicesDisabled)
        XCTAssertFalse(plan.allows(.this))
        XCTAssertFalse(plan.allows(.thisAndFuture))
        XCTAssertTrue(plan.allows(.all))
    }

    func testPlanReadsRepeatAndKeyOffTheBlockBeingEdited() {
        XCTAssertEqual(
            EditScopePlan(block: Self.block(recurring: true, key: key)),
            EditScopePlan(repeats: true, occurrenceKey: key)
        )
        XCTAssertEqual(
            EditScopePlan(block: Self.block(recurring: false, key: nil)),
            EditScopePlan(repeats: false, occurrenceKey: nil)
        )
        // Creating: no block at all, so no prompt.
        XCTAssertFalse(EditScopePlan(block: nil).asksScope)
        XCTAssertEqual(EditScopePlan(block: nil).silentScope, .all)
    }

    // MARK: Today swipe-to-delete

    /// Today's swipe-delete used to call `deleteActivity` with the default
    /// `.all`, so removing one day of a repeating block tombstoned every future
    /// occurrence — the same ADR-001 bug the editor lost, on a third surface.
    /// `remove(_:)` now branches on `silentScope`: nil means it MUST raise the
    /// prompt instead of writing. Pin that a recurring block never yields a
    /// scope to delete with on its own.
    func testRecurringTodayBlockCannotBeDeletedWithoutAChoice() {
        let plan = EditScopePlan(block: Self.block(recurring: true, key: key))
        XCTAssertNil(
            plan.silentScope,
            "a repeating Today block must raise the prompt, not delete silently"
        )
        XCTAssertTrue(plan.asksScope)
        // And when the user does answer, "just this time" is what is offered first.
        XCTAssertEqual(plan.defaultChoice, .this)
    }

    /// The swipe on a one-off stays instant — its single occurrence is the
    /// whole series, so a prompt would be noise.
    func testOneOffTodayBlockDeletesImmediately() {
        let plan = EditScopePlan(block: Self.block(recurring: false, key: key))
        XCTAssertEqual(plan.silentScope, .all)
        XCTAssertFalse(plan.asksScope)
    }

    /// A repeating block with no day identity must not degrade into `.all`:
    /// the scoped answers are refused, so the caller cannot write one.
    func testRecurringTodayBlockWithoutADayIdentityRefusesScopedDeletes() {
        let plan = EditScopePlan(block: Self.block(recurring: true, key: nil))
        XCTAssertNil(plan.silentScope)
        XCTAssertFalse(plan.allows(.this))
        XCTAssertFalse(plan.allows(.thisAndFuture))
        XCTAssertTrue(plan.allows(.all), "only an explicit whole-series tap remains")
        XCTAssertNil(plan.defaultChoice, "nothing preselected — `.all` is never silent")
    }

    // MARK: Request bodies

    func testScopedWriteCarriesANonNilOccurrenceKey() throws {
        let occurrence = try XCTUnwrap(EditScopeWrite.occurrenceDate(key))

        let this = try XCTUnwrap(Self.update(scope: .this, occurrenceKey: occurrence))
        XCTAssertEqual(this.editScope, .this)
        XCTAssertEqual(this.occurrenceKey, occurrence)

        let future = try XCTUnwrap(
            Self.update(scope: .thisAndFuture, occurrenceKey: occurrence)
        )
        XCTAssertEqual(future.editScope, .thisAndFuture)
        XCTAssertEqual(future.occurrenceKey, occurrence)
    }

    /// A per-day scope without a day identity is refused outright — the caller
    /// must surface the error rather than fall back to `.all`.
    func testScopedWriteWithoutAnOccurrenceKeyIsRefused() {
        XCTAssertNil(Self.update(scope: .this, occurrenceKey: nil))
        XCTAssertNil(Self.update(scope: .thisAndFuture, occurrenceKey: nil))
        XCTAssertNotNil(Self.update(scope: .all, occurrenceKey: nil))
    }

    /// `editScope=this` writes an occurrence override, and the route rejects
    /// master-only fields on it (`"<field> is not valid for editScope=this"`).
    func testJustThisTimeSendsOnlyOccurrenceLegalFields() throws {
        let occurrence = try XCTUnwrap(EditScopeWrite.occurrenceDate(key))
        let update = try XCTUnwrap(
            Self.update(scope: .this, occurrenceKey: occurrence)
        )
        XCTAssertEqual(update.title, "Stretch")
        XCTAssertEqual(update.durationMin, 30)
        XCTAssertEqual(update.startAt, Self.instant)
        XCTAssertEqual(update.checklistOverride, .value([.init(label: "Neck", done: false)]))
        // Master-only fields must be absent.
        XCTAssertNil(update.tz)
        XCTAssertNil(update.dtstartLocal)
        XCTAssertEqual(update.emoji, .unchanged)
        XCTAssertEqual(update.categoryId, .unchanged)
        XCTAssertEqual(update.rrule, .unchanged)
        XCTAssertNil(update.priority)
        XCTAssertEqual(update.notes, .unchanged)
    }

    /// The wider scopes edit the master, so they may not carry the
    /// occurrence-only fields (`startAt`, `checklistOverride`, `status`).
    func testWiderScopesSendMasterFieldsAndNoOccurrenceOverrides() throws {
        let occurrence = try XCTUnwrap(EditScopeWrite.occurrenceDate(key))
        for scope in [ActivityEditScope.thisAndFuture, .all] {
            let update = try XCTUnwrap(
                Self.update(scope: scope, occurrenceKey: occurrence)
            )
            XCTAssertEqual(update.tz, "America/New_York")
            XCTAssertEqual(update.dtstartLocal, Self.instant)
            XCTAssertEqual(update.emoji, .value("🧘"))
            XCTAssertEqual(update.categoryId, .value("category-1"))
            XCTAssertNil(update.startAt)
            XCTAssertEqual(update.checklistOverride, .unchanged)
            XCTAssertNil(update.status)
        }
    }

    /// `all` edits the master directly, so it does not identify a day.
    func testWholeSeriesDoesNotSendAnOccurrenceKey() throws {
        let occurrence = try XCTUnwrap(EditScopeWrite.occurrenceDate(key))
        let update = try XCTUnwrap(Self.update(scope: .all, occurrenceKey: occurrence))
        XCTAssertEqual(update.editScope, .all)
        XCTAssertNil(update.occurrenceKey)
    }

    func testOccurrenceKeyParsesWithAndWithoutFractionalSeconds() {
        XCTAssertNotNil(EditScopeWrite.occurrenceDate("2026-08-14T13:00:00.000Z"))
        XCTAssertNotNil(EditScopeWrite.occurrenceDate("2026-08-14T13:00:00Z"))
        XCTAssertNil(EditScopeWrite.occurrenceDate(nil))
        XCTAssertNil(EditScopeWrite.occurrenceDate("not a date"))
    }

    // MARK: Copy — must stay word for word with the web editor

    func testPromptCopyMatchesTheWebEditor() {
        XCTAssertEqual(
            ActivityEditScope.promptOrder,
            [.this, .thisAndFuture, .all]
        )
        XCTAssertEqual(ActivityEditScope.this.promptLabel, "Just this time")
        XCTAssertEqual(
            ActivityEditScope.thisAndFuture.promptLabel,
            "This and every one after"
        )
        XCTAssertEqual(ActivityEditScope.all.promptLabel, "The whole series")

        XCTAssertEqual(
            ActivityEditScope.this.promptHint(for: .save),
            "Every other day stays exactly as it is."
        )
        XCTAssertEqual(
            ActivityEditScope.this.promptHint(for: .delete),
            "It still shows up on all the other days."
        )
        XCTAssertEqual(
            ActivityEditScope.thisAndFuture.promptHint(for: .save),
            "Days before this one stay as they are."
        )
        XCTAssertEqual(
            ActivityEditScope.thisAndFuture.promptHint(for: .delete),
            "Days before this one stay as they are."
        )
        XCTAssertEqual(
            ActivityEditScope.all.promptHint(for: .save),
            "Every day this happens, past and future."
        )
        XCTAssertEqual(
            ActivityEditScope.all.promptHint(for: .delete),
            "Removes it from every day, past and future."
        )

        XCTAssertEqual(
            EditScopeIntent.save.question,
            "Which days should the change land on?"
        )
        XCTAssertEqual(
            EditScopeIntent.delete.question,
            "Which days should it come off?"
        )
    }

    func testSharedFieldsNoteNamesWhatJustThisTimeWontCarry() {
        let sky = Self.block(recurring: true, key: key).category
        XCTAssertTrue(
            EditScopeWrite.sharedFields(
                emoji: "🧘", savedEmoji: "🧘", category: sky, savedCategory: sky
            ).isEmpty
        )
        XCTAssertNil(EditScopeWrite.sharedFieldsNote([]))
        XCTAssertEqual(
            EditScopeWrite.sharedFieldsNote(["the icon"]),
            "The icon is shared by every day, so it won’t change here."
        )
        XCTAssertEqual(
            EditScopeWrite.sharedFieldsNote(["the icon", "the category"]),
            "The icon and the category are shared by every day, "
                + "so they won’t change here."
        )
    }

    // MARK: Fixtures

    private static let instant = Date(timeIntervalSince1970: 1_786_000_000)

    private static func update(
        scope: ActivityEditScope,
        occurrenceKey: Date?
    ) -> ActivityUpdate? {
        EditScopeWrite.update(
            scope: scope,
            occurrenceKey: occurrenceKey,
            tz: "America/New_York",
            instant: instant,
            title: "Stretch",
            emoji: "🧘",
            categoryId: "category-1",
            checklist: [.init(label: "Neck", done: false)],
            durationMin: 30
        )
    }

    private static func block(recurring: Bool, key: String?) -> DayBlock {
        DayBlock(
            id: "activity-1",
            title: "Stretch",
            emoji: "🧘",
            startMin: 9 * 60,
            durationMin: 30,
            category: .sky,
            done: false,
            recurring: recurring,
            revision: 3,
            occurrenceKey: key,
            checklist: []
        )
    }
}
