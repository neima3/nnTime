import XCTest
@testable import Kairo

final class ReviewWindowTests: XCTestCase {
    private func block(start: Int, duration: Int, title: String) -> DayBlock {
        DayBlock(
            id: title,
            title: title,
            emoji: "📋",
            startMin: start,
            durationMin: duration,
            category: .sky,
            done: false,
            recurring: false,
            revision: 1,
            occurrenceKey: "2026-09-14T13:00:00.000Z",
            checklist: []
        )
    }

    func testMiddayListsOnlyEndedUnfinishedBlocks() {
        let items = [
            block(start: 9 * 60, duration: 30, title: "done-at-9:30"),
            block(start: 13 * 60, duration: 60, title: "running-now"),
            block(start: 19 * 60, duration: 45, title: "tonight"),
        ]
        let result = ReviewWindow.partition(items, nowMin: 13 * 60 + 20)
        XCTAssertEqual(result.past.map(\.title), ["done-at-9:30"])
        XCTAssertEqual(result.upcoming, 2)
    }

    func testBlockEndingExactlyNowIsOver() {
        let result = ReviewWindow.partition(
            [block(start: 10 * 60, duration: 30, title: "noon")],
            nowMin: 10 * 60 + 30
        )
        XCTAssertEqual(result.past.count, 1)
    }

    func testOtherDaysReviewEverything() {
        let items = [
            block(start: 9 * 60, duration: 30, title: "morning"),
            block(start: 21 * 60, duration: 30, title: "night"),
        ]
        let result = ReviewWindow.partition(items, nowMin: nil)
        XCTAssertEqual(result.past.map(\.title), ["morning", "night"])
        XCTAssertEqual(result.upcoming, 0)
    }
}
