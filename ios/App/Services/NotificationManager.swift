import Foundation
import UserNotifications

// MARK: - Local reminders (T2 + T4)
// Schedules on-device notifications for today's upcoming activities: a gentle
// "time to shift" cushion a few minutes before, and an on-time "starting now."
// No server round-trip, works offline, and respects the Settings toggle.

enum NotificationManager {
    private static let center = UNUserNotificationCenter.current()

    /// Ask once. Returns whether we're authorized after the prompt.
    @discardableResult
    static func requestAuthorization() async -> Bool {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            return granted
        } catch {
            return false
        }
    }

    static func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    /// Replace all scheduled reminders with fresh ones for today's blocks.
    /// Only future starts are scheduled; past blocks are skipped. Safe to call
    /// on every day-load — it fully reconciles.
    static func reschedule(blocks: [DayBlock], zone: TimeZone) async {
        center.removeAllPendingNotificationRequests()
        guard KairoPrefs.remindersEnabled else { return }
        guard await authorizationStatus() == .authorized else { return }

        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = zone
        let now = Date()
        let lead = max(0, KairoPrefs.transitionLeadMin)

        // Cap the number of scheduled requests well under the iOS 64 limit.
        var scheduled = 0
        for block in blocks.sorted(by: { $0.startMin < $1.startMin }) where !block.done {
            guard scheduled < 56 else { break }
            guard let startDate = dateFor(minute: block.startMin, calendar: cal, now: now),
                  startDate > now else { continue }

            // Transition cushion — a few minutes before.
            if lead > 0, let cushionDate = cal.date(byAdding: .minute, value: -lead, to: startDate),
               cushionDate > now {
                add(
                    id: "cushion-\(block.id)",
                    title: "\(block.emoji) \(block.title)",
                    body: "Starts in \(lead) min — a good moment to wrap up and shift.",
                    date: cushionDate, calendar: cal
                )
                scheduled += 1
            }

            // On-time — starting now.
            if scheduled < 56 {
                add(
                    id: "start-\(block.id)",
                    title: "\(block.emoji) \(block.title)",
                    body: "Starting now — no rush, just a nudge.",
                    date: startDate, calendar: cal
                )
                scheduled += 1
            }
        }
    }

    static func cancelAll() {
        center.removeAllPendingNotificationRequests()
    }

    // MARK: Internals

    private static func dateFor(minute: Int, calendar: Calendar, now: Date) -> Date? {
        var comps = calendar.dateComponents([.year, .month, .day], from: now)
        comps.hour = minute / 60
        comps.minute = minute % 60
        comps.second = 0
        return calendar.date(from: comps)
    }

    private static func add(id: String, title: String, body: String, date: Date, calendar: Calendar) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let comps = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }
}
