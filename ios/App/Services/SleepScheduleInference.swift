import Foundation

enum SleepStage: Equatable {
    case inBed
    case awake
    case asleepUnspecified
    case asleepCore
    case asleepDeep
    case asleepREM

    var isAsleep: Bool {
        switch self {
        case .asleepUnspecified, .asleepCore, .asleepDeep, .asleepREM:
            true
        case .inBed, .awake:
            false
        }
    }
}

struct SleepSample: Equatable {
    let start: Date
    let end: Date
    let stage: SleepStage
}

struct SleepSchedule: Equatable {
    let sleepStartMinute: Int
    let windDownMinute: Int
    let nights: Int
}

enum SleepScheduleInference {
    static let lookbackDays = 28
    static let minimumNights = 4
    static let windDownLeadMinutes = 45

    static func infer(
        samples: [SleepSample],
        calendar: Calendar
    ) -> SleepSchedule? {
        var earliestStartByNight: [Date: Date] = [:]

        for sample in samples where sample.stage.isAsleep {
            guard let shifted = calendar.date(
                byAdding: .hour,
                value: -12,
                to: sample.start
            ) else { continue }

            let night = calendar.startOfDay(for: shifted)
            if let existing = earliestStartByNight[night] {
                earliestStartByNight[night] = min(existing, sample.start)
            } else {
                earliestStartByNight[night] = sample.start
            }
        }

        guard earliestStartByNight.count >= minimumNights else { return nil }

        let eveningRelativeMinutes = earliestStartByNight.values.map { start in
            let components = calendar.dateComponents([.hour, .minute], from: start)
            let minute = (components.hour ?? 0) * 60 + (components.minute ?? 0)
            return minute < 12 * 60 ? minute + 24 * 60 : minute
        }.sorted()

        let middle = eveningRelativeMinutes.count / 2
        let median: Int
        if eveningRelativeMinutes.count.isMultiple(of: 2) {
            median = (
                eveningRelativeMinutes[middle - 1]
                    + eveningRelativeMinutes[middle]
            ) / 2
        } else {
            median = eveningRelativeMinutes[middle]
        }

        let sleepStartMinute = median % (24 * 60)
        let windDownMinute = (
            sleepStartMinute - windDownLeadMinutes + 24 * 60
        ) % (24 * 60)

        return SleepSchedule(
            sleepStartMinute: sleepStartMinute,
            windDownMinute: windDownMinute,
            nights: earliestStartByNight.count
        )
    }

    static func nextWindDownDate(
        for schedule: SleepSchedule,
        after now: Date,
        calendar: Calendar
    ) -> Date? {
        calendar.nextDate(
            after: now,
            matching: DateComponents(
                hour: schedule.windDownMinute / 60,
                minute: schedule.windDownMinute % 60,
                second: 0
            ),
            matchingPolicy: .nextTime,
            repeatedTimePolicy: .first,
            direction: .forward
        )
    }
}
