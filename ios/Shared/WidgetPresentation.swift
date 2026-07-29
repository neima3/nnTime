import Foundation

enum WidgetClock {
    static func text(
        minutes: Int,
        hourCycle: String?,
        localeUses12Hour: Bool = localePrefersTwelveHour
    ) -> String {
        let normalized = ((minutes % 1_440) + 1_440) % 1_440
        let hour = normalized / 60
        let minute = normalized % 60
        let usesTwelveHour: Bool
        switch hourCycle {
        case "h12":
            usesTwelveHour = true
        case "h24":
            usesTwelveHour = false
        default:
            usesTwelveHour = localeUses12Hour
        }

        guard usesTwelveHour else {
            return String(format: "%02d:%02d", hour, minute)
        }
        let displayHour = hour % 12 == 0 ? 12 : hour % 12
        return String(
            format: "%d:%02d %@",
            displayHour,
            minute,
            hour < 12 ? "AM" : "PM"
        )
    }

    private static var localePrefersTwelveHour: Bool {
        let format = DateFormatter.dateFormat(
            fromTemplate: "j",
            options: 0,
            locale: .current
        ) ?? ""
        return format.contains("a")
    }
}

struct WidgetDayState {
    let blocks: [CachedBlock]
    let selected: CachedBlock?
    let isCurrent: Bool
    let nowMin: Int
}

enum WidgetSelection {
    static func state(
        snapshot: DayCacheStore.Snapshot,
        at date: Date
    ) -> WidgetDayState {
        guard let zone = TimeZone(identifier: snapshot.zone) else {
            return empty
        }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        guard dayKey(date, calendar: calendar) == snapshot.date else {
            return empty
        }

        let components = calendar.dateComponents(
            [.hour, .minute],
            from: date
        )
        let nowMin =
            (components.hour ?? 0) * 60 + (components.minute ?? 0)
        let blocks = snapshot.blocks.sorted {
            if $0.startMin == $1.startMin {
                return $0.title < $1.title
            }
            return $0.startMin < $1.startMin
        }
        if let current = blocks.first(where: {
            !$0.done
                && $0.startMin <= nowMin
                && nowMin < $0.endMin
        }) {
            return WidgetDayState(
                blocks: blocks,
                selected: current,
                isCurrent: true,
                nowMin: nowMin
            )
        }
        let next = blocks.first {
            !$0.done && $0.startMin > nowMin
        }
        return WidgetDayState(
            blocks: blocks,
            selected: next,
            isCurrent: false,
            nowMin: nowMin
        )
    }

    private static var empty: WidgetDayState {
        WidgetDayState(
            blocks: [],
            selected: nil,
            isCurrent: false,
            nowMin: 0
        )
    }

    private static func dayKey(
        _ date: Date,
        calendar: Calendar
    ) -> String {
        let components = calendar.dateComponents(
            [.year, .month, .day],
            from: date
        )
        return String(
            format: "%04d-%02d-%02d",
            components.year ?? 0,
            components.month ?? 0,
            components.day ?? 0
        )
    }
}
