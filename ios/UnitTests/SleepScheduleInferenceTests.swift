import XCTest
@testable import Kairo

final class SleepScheduleInferenceTests: XCTestCase {
    private var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "America/New_York")!
        value.locale = Locale(identifier: "en_US_POSIX")
        return value
    }

    func testRejectsInBedAndAwakeStages() {
        var samples: [SleepSample] = []
        for day in 1...4 {
            samples.append(sample(day: day, hour: 22, minute: 0, stage: .inBed))
            samples.append(sample(day: day, hour: 23, minute: 0, stage: .awake))
            samples.append(sample(day: day, hour: 23, minute: 30, stage: .asleepUnspecified))
        }

        let result = SleepScheduleInference.infer(samples: samples, calendar: calendar)

        XCTAssertEqual(
            result,
            SleepSchedule(sleepStartMinute: 23 * 60 + 30, windDownMinute: 22 * 60 + 45, nights: 4)
        )
    }

    func testCollapsesSleepStagesIntoOneLocalNight() {
        var samples: [SleepSample] = []
        for day in 1...4 {
            samples.append(sample(day: day, hour: 23, minute: 30, stage: .asleepCore))
            samples.append(sample(day: day + 1, hour: 0, minute: 10, stage: .asleepDeep))
            samples.append(sample(day: day + 1, hour: 1, minute: 5, stage: .asleepREM))
        }

        let result = SleepScheduleInference.infer(samples: samples, calendar: calendar)

        XCTAssertEqual(result?.nights, 4)
        XCTAssertEqual(result?.sleepStartMinute, 23 * 60 + 30)
    }

    func testRequiresFourDistinctNights() {
        let samples = (1...3).map {
            sample(day: $0, hour: 23, minute: 45, stage: .asleepCore)
        }

        XCTAssertNil(SleepScheduleInference.infer(samples: samples, calendar: calendar))
    }

    func testMedianHandlesMidnightAndLateOutlier() {
        let samples = [
            sample(day: 1, hour: 23, minute: 50, stage: .asleepCore),
            sample(day: 3, hour: 0, minute: 10, stage: .asleepCore),
            sample(day: 3, hour: 23, minute: 55, stage: .asleepCore),
            sample(day: 5, hour: 0, minute: 5, stage: .asleepCore),
            sample(day: 6, hour: 3, minute: 30, stage: .asleepCore),
        ]

        let result = SleepScheduleInference.infer(samples: samples, calendar: calendar)

        XCTAssertEqual(result?.sleepStartMinute, 5)
        XCTAssertEqual(result?.nights, 5)
    }

    func testWindDownIsFortyFiveMinutesBeforeSleep() {
        let samples = (1...4).map {
            sample(day: $0, hour: 0, minute: 5, stage: .asleepUnspecified)
        }

        let result = SleepScheduleInference.infer(samples: samples, calendar: calendar)

        XCTAssertEqual(result?.sleepStartMinute, 5)
        XCTAssertEqual(result?.windDownMinute, 23 * 60 + 20)
    }

    func testNextWindDownUsesCalendarAndAlwaysReturnsFutureDate() {
        let now = date(day: 8, hour: 23, minute: 0)
        let schedule = SleepSchedule(
            sleepStartMinute: 23 * 60 + 15,
            windDownMinute: 22 * 60 + 30,
            nights: 7
        )

        let next = SleepScheduleInference.nextWindDownDate(
            for: schedule,
            after: now,
            calendar: calendar
        )

        XCTAssertNotNil(next)
        XCTAssertGreaterThan(next!, now)
        let components = calendar.dateComponents([.day, .hour, .minute], from: next!)
        XCTAssertEqual(components.day, 9)
        XCTAssertEqual(components.hour, 22)
        XCTAssertEqual(components.minute, 30)
    }

    private func sample(
        day: Int,
        hour: Int,
        minute: Int,
        stage: SleepStage
    ) -> SleepSample {
        let start = date(day: day, hour: hour, minute: minute)
        return SleepSample(
            start: start,
            end: calendar.date(byAdding: .minute, value: 40, to: start)!,
            stage: stage
        )
    }

    private func date(day: Int, hour: Int, minute: Int) -> Date {
        calendar.date(from: DateComponents(
            year: 2026,
            month: 3,
            day: day,
            hour: hour,
            minute: minute
        ))!
    }
}
