import XCTest
@testable import Kairo

final class ReviewTomorrowTests: XCTestCase {
    private func block(id: String = "series-1", recurring: Bool) -> DayBlock {
        DayBlock(
            id: id,
            title: "Stretch",
            emoji: "🧘",
            startMin: 8 * 60,
            durationMin: 15,
            category: .sky,
            done: false,
            recurring: recurring,
            revision: 1,
            occurrenceKey: "2026-09-24T12:00:00.000Z",
            checklist: []
        )
    }

    func testNextDateCrossesMonthYearAndLeapDay() {
        XCTAssertEqual(ReviewTomorrow.nextDate("2026-09-24"), "2026-09-25")
        XCTAssertEqual(ReviewTomorrow.nextDate("2026-09-30"), "2026-10-01")
        XCTAssertEqual(ReviewTomorrow.nextDate("2026-12-31"), "2027-01-01")
        XCTAssertEqual(ReviewTomorrow.nextDate("2028-02-28"), "2028-02-29")
        XCTAssertEqual(ReviewTomorrow.nextDate("2026-02-28"), "2026-03-01")
    }

    func testNextDateIgnoresDaylightSavingTransitions() {
        // US fall-back (Nov 1 2026) and spring-forward (Mar 8 2026).
        XCTAssertEqual(ReviewTomorrow.nextDate("2026-10-31"), "2026-11-01")
        XCTAssertEqual(ReviewTomorrow.nextDate("2026-03-07"), "2026-03-08")
    }

    func testDailySeriesAlreadyOnTomorrowIsLetGo() {
        XCTAssertTrue(ReviewTomorrow.shouldLetGo(block(recurring: true), seriesOnTomorrow: ["series-1"]))
    }

    func testWeeklySeriesWithoutACopyTomorrowMoves() {
        XCTAssertFalse(ReviewTomorrow.shouldLetGo(block(recurring: true), seriesOnTomorrow: ["other"]))
        XCTAssertFalse(ReviewTomorrow.shouldLetGo(block(recurring: true), seriesOnTomorrow: []))
    }

    func testUnreadableTomorrowFallsBackToMoving() {
        XCTAssertFalse(ReviewTomorrow.shouldLetGo(block(recurring: true), seriesOnTomorrow: nil))
    }

    func testOneOffAlwaysMoves() {
        XCTAssertFalse(ReviewTomorrow.shouldLetGo(block(recurring: false), seriesOnTomorrow: ["series-1"]))
    }
}
