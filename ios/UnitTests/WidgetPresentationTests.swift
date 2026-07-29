import XCTest
@testable import Kairo

final class WidgetPresentationTests: XCTestCase {
    func testTwelveHourClockFormatsMidnightNoonAndAfternoon() {
        XCTAssertEqual(
            WidgetClock.text(
                minutes: 0,
                hourCycle: "h12",
                localeUses12Hour: false
            ),
            "12:00 AM"
        )
        XCTAssertEqual(
            WidgetClock.text(
                minutes: 12 * 60,
                hourCycle: "h12",
                localeUses12Hour: false
            ),
            "12:00 PM"
        )
        XCTAssertEqual(
            WidgetClock.text(
                minutes: 13 * 60 + 5,
                hourCycle: "h12",
                localeUses12Hour: false
            ),
            "1:05 PM"
        )
    }

    func testTwentyFourHourClockFormatsMidnightNoonAndAfternoon() {
        XCTAssertEqual(
            WidgetClock.text(
                minutes: 0,
                hourCycle: "h24",
                localeUses12Hour: true
            ),
            "00:00"
        )
        XCTAssertEqual(
            WidgetClock.text(
                minutes: 12 * 60,
                hourCycle: "h24",
                localeUses12Hour: true
            ),
            "12:00"
        )
        XCTAssertEqual(
            WidgetClock.text(
                minutes: 13 * 60 + 5,
                hourCycle: "h24",
                localeUses12Hour: true
            ),
            "13:05"
        )
    }

    func testMissingOrInvalidHourCycleUsesLocaleFallback() {
        XCTAssertEqual(
            WidgetClock.text(
                minutes: 13 * 60 + 5,
                hourCycle: nil,
                localeUses12Hour: true
            ),
            "1:05 PM"
        )
        XCTAssertEqual(
            WidgetClock.text(
                minutes: 13 * 60 + 5,
                hourCycle: "unexpected",
                localeUses12Hour: false
            ),
            "13:05"
        )
    }

    func testSelectionPrefersCurrentThenNextAndExcludesCompleted() throws {
        let zone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let snapshot = snapshot(
            zone: zone.identifier,
            blocks: [
                block(title: "Done", start: 8 * 60, duration: 90, done: true),
                block(title: "Current", start: 9 * 60, duration: 60),
                block(title: "Next", start: 10 * 60 + 30, duration: 30),
            ]
        )
        let current = WidgetSelection.state(
            snapshot: snapshot,
            at: date(
                year: 2026,
                month: 7,
                day: 29,
                hour: 9,
                minute: 15,
                zone: zone
            )
        )
        let next = WidgetSelection.state(
            snapshot: snapshot,
            at: date(
                year: 2026,
                month: 7,
                day: 29,
                hour: 10,
                minute: 5,
                zone: zone
            )
        )

        XCTAssertEqual(current.selected?.title, "Current")
        XCTAssertTrue(current.isCurrent)
        XCTAssertEqual(next.selected?.title, "Next")
        XCTAssertFalse(next.isCurrent)
    }

    func testSelectionUsesPlanningZoneAndRejectsAnotherPlanningDate() throws {
        let tokyo = try XCTUnwrap(TimeZone(identifier: "Asia/Tokyo"))
        let snapshot = snapshot(
            zone: tokyo.identifier,
            blocks: [
                block(title: "Tokyo morning", start: 8 * 60, duration: 60),
            ]
        )
        let matching = WidgetSelection.state(
            snapshot: snapshot,
            at: date(
                year: 2026,
                month: 7,
                day: 29,
                hour: 8,
                minute: 15,
                zone: tokyo
            )
        )
        let stale = WidgetSelection.state(
            snapshot: snapshot,
            at: date(
                year: 2026,
                month: 7,
                day: 30,
                hour: 8,
                minute: 15,
                zone: tokyo
            )
        )

        XCTAssertEqual(matching.selected?.title, "Tokyo morning")
        XCTAssertTrue(stale.blocks.isEmpty)
        XCTAssertNil(stale.selected)
        XCTAssertFalse(stale.isCurrent)
    }

    private func snapshot(
        zone: String,
        blocks: [CachedBlock]
    ) -> DayCacheStore.Snapshot {
        DayCacheStore.Snapshot(
            version: DayCacheStore.version,
            scope: "widget-tests",
            date: "2026-07-29",
            zone: zone,
            blocks: blocks,
            savedAt: Date(timeIntervalSince1970: 0),
            hourCycle: "h12"
        )
    }

    private func block(
        title: String,
        start: Int,
        duration: Int,
        done: Bool = false
    ) -> CachedBlock {
        CachedBlock(
            title: title,
            emoji: "◔",
            startMin: start,
            durationMin: duration,
            done: done,
            category: "lilac"
        )
    }

    private func date(
        year: Int,
        month: Int,
        day: Int,
        hour: Int,
        minute: Int,
        zone: TimeZone
    ) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        return calendar.date(
            from: DateComponents(
                year: year,
                month: month,
                day: day,
                hour: hour,
                minute: minute
            )
        )!
    }
}
