import XCTest
@testable import Kairo

/// Pins the native Daily Brief to the web contract (src/components/DailyBrief.tsx).
final class DailyBriefPolicyTests: XCTestCase {

    func testMorningOnlyAndOncePerDay() {
        XCTAssertTrue(DailyBriefPolicy.shouldShow(hour: 8, dismissedDay: nil, today: "2026-07-31"))
        XCTAssertTrue(DailyBriefPolicy.shouldShow(hour: 0, dismissedDay: "2026-07-30", today: "2026-07-31"))
        XCTAssertFalse(DailyBriefPolicy.shouldShow(hour: 12, dismissedDay: nil, today: "2026-07-31"), "noon is not morning")
        XCTAssertFalse(DailyBriefPolicy.shouldShow(hour: 19, dismissedDay: nil, today: "2026-07-31"))
        XCTAssertFalse(DailyBriefPolicy.shouldShow(hour: 8, dismissedDay: "2026-07-31", today: "2026-07-31"), "dismissed for today stays gone")
    }

    func testGreetingMatchesTheWebTiers() {
        XCTAssertEqual(DailyBriefPolicy.greeting(hour: 3), "Still up")
        XCTAssertEqual(DailyBriefPolicy.greeting(hour: 5), "Good morning")
        XCTAssertEqual(DailyBriefPolicy.greeting(hour: 11), "Good morning")
        XCTAssertEqual(DailyBriefPolicy.greeting(hour: 14), "Hello")
    }

    func testSummaryMatchesTheWebCopy() {
        XCTAssertEqual(DailyBriefPolicy.summary(total: 0, done: 0), "Nothing scheduled yet — a blank, gentle day.")
        XCTAssertEqual(DailyBriefPolicy.summary(total: 1, done: 0), "1 thing on today.")
        XCTAssertEqual(DailyBriefPolicy.summary(total: 3, done: 0), "3 things on today.")
        XCTAssertEqual(DailyBriefPolicy.summary(total: 3, done: 2), "3 things on today, 2 already done.")
    }
}
