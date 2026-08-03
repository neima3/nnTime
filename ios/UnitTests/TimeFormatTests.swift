import XCTest
@testable import Kairo

/// Pins the wall-clock format contract.
///
/// Written because of a real bug: `KTime.hhmm` hardcoded 24-hour, so Settings →
/// Formatting → Time saved and synced to the server but every label on screen
/// stayed 24-hour. These cases must stay identical to `formatTime` in
/// src/lib/time-format.ts so the two platforms never drift.
final class TimeFormatTests: XCTestCase {
    func testHourLabelMirrorsWeb() {
        XCTAssertEqual(KTime.hourLabel(9, hourCycle: "h24"), "9:00")
        XCTAssertEqual(KTime.hourLabel(9, hourCycle: "h12"), "9 AM")
        XCTAssertEqual(KTime.hourLabel(0, hourCycle: "h12"), "12 AM")
        XCTAssertEqual(KTime.hourLabel(12, hourCycle: "h12"), "12 PM")
        XCTAssertEqual(KTime.hourLabel(25, hourCycle: "h24"), "1:00")
    }

    func testTimelineHourMarksHonorTheSavedHourCycle() {
        XCTAssertEqual(
            TimelineCanvas.hourMark(for: 13 * 60, hourCycle: "h12"),
            "1 PM"
        )
        XCTAssertEqual(
            TimelineCanvas.hourMark(for: 13 * 60, hourCycle: "h24"),
            "13:00"
        )
    }

    func test24HourIsUnchanged() {
        XCTAssertEqual(KTime.hhmm(9 * 60, hourCycle: "h24"), "9:00")
        XCTAssertEqual(KTime.hhmm(13 * 60 + 30, hourCycle: "h24"), "13:30")
        XCTAssertEqual(KTime.hhmm(0, hourCycle: "h24"), "0:00")
        XCTAssertEqual(KTime.hhmm(23 * 60 + 59, hourCycle: "h24"), "23:59")
    }

    func test12HourUsesAmPm() {
        XCTAssertEqual(KTime.hhmm(9 * 60, hourCycle: "h12"), "9:00 AM")
        XCTAssertEqual(KTime.hhmm(13 * 60 + 30, hourCycle: "h12"), "1:30 PM")
        XCTAssertEqual(KTime.hhmm(7 * 60 + 5, hourCycle: "h12"), "7:05 AM")
    }

    /// The two that trip every hand-rolled 12-hour formatter.
    func test12HourMidnightAndNoonAreTwelve() {
        XCTAssertEqual(KTime.hhmm(0, hourCycle: "h12"), "12:00 AM")
        XCTAssertEqual(KTime.hhmm(12 * 60, hourCycle: "h12"), "12:00 PM")
        XCTAssertEqual(KTime.hhmm(12 * 60 + 30, hourCycle: "h12"), "12:30 PM")
        XCTAssertEqual(KTime.hhmm(23 * 60 + 59, hourCycle: "h12"), "11:59 PM")
    }

    /// Block end times can run past midnight; they should wrap, not read "25:00".
    func testMinutesPastMidnightWrap() {
        XCTAssertEqual(KTime.hhmm(24 * 60, hourCycle: "h24"), "0:00")
        XCTAssertEqual(KTime.hhmm(25 * 60 + 15, hourCycle: "h24"), "1:15")
        XCTAssertEqual(KTime.hhmm(25 * 60 + 15, hourCycle: "h12"), "1:15 AM")
        XCTAssertEqual(KTime.hhmm(-30, hourCycle: "h24"), "23:30")
    }

    func testFallsBackToTheStoredPreference() {
        let original = KairoPrefs.hourCycle
        defer { KairoPrefs.hourCycle = original }

        KairoPrefs.hourCycle = "h24"
        XCTAssertEqual(KTime.hhmm(13 * 60), "13:00")
        KairoPrefs.hourCycle = "h12"
        XCTAssertEqual(KTime.hhmm(13 * 60), "1:00 PM")
    }

    func testAdoptTakesTheAccountHourCycle() {
        let original = KairoPrefs.hourCycle
        defer { KairoPrefs.hourCycle = original }

        KairoPrefs.hourCycle = "h12"
        KairoPrefs.adopt(notificationPrefs: [:], reducedStimulation: false, hourCycle: "h24")
        XCTAssertEqual(KairoPrefs.hourCycle, "h24")

        // Garbage from the wire must not clobber a good local value.
        KairoPrefs.adopt(notificationPrefs: [:], reducedStimulation: false, hourCycle: "nonsense")
        XCTAssertEqual(KairoPrefs.hourCycle, "h24")
        KairoPrefs.adopt(notificationPrefs: [:], reducedStimulation: false, hourCycle: nil)
        XCTAssertEqual(KairoPrefs.hourCycle, "h24")
    }

    func testDurationIsNotATimeOfDay() {
        // Durations must stay unit-labelled regardless of hour cycle.
        XCTAssertEqual(KTime.duration(45), "45 min")
        XCTAssertEqual(KTime.duration(90), "1 h 30 min")
    }
}
