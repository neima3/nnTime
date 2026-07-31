import Foundation

/// The web Daily Brief's contract (src/components/DailyBrief.tsx): a warm
/// morning orientation — one glance that answers "what is today?" —
/// morning-only, once per day, dismissible for the day.
enum DailyBriefPolicy {
    static func shouldShow(hour: Int, dismissedDay: String?, today: String) -> Bool {
        hour < 12 && dismissedDay != today
    }

    static func greeting(hour: Int) -> String {
        hour < 5 ? "Still up" : hour < 12 ? "Good morning" : "Hello"
    }

    static func summary(total: Int, done: Int) -> String {
        if total == 0 { return "Nothing scheduled yet — a blank, gentle day." }
        let things = total == 1 ? "1 thing" : "\(total) things"
        let doneSuffix = done > 0 ? ", \(done) already done" : ""
        return "\(things) on today\(doneSuffix)."
    }
}
