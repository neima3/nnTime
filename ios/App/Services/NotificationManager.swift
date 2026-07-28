import Foundation
import UserNotifications

// MARK: - Local reminders (T2 + T4)
// Schedules on-device notifications for today's upcoming activities: a gentle
// "time to shift" cushion a few minutes before, and an on-time "starting now."
// No server round-trip, works offline, and respects the Settings toggle.

enum NotificationManager {
    private static let center = UNUserNotificationCenter.current()
    static let sleepWindDownIdentifier = "kairo-sleep-wind-down"

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
        let pending = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(
            withIdentifiers: activityRequestIdentifiers(
                from: pending.map(\.identifier)
            )
        )
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
            // Quiet hours — skip reminders that would fire while resting.
            if KairoPrefs.inQuietHours(cal.component(.hour, from: startDate)) { continue }

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
        Task { await cancelActivityReminders() }
    }

    static func cancelActivityReminders() async {
        let pending = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(
            withIdentifiers: activityRequestIdentifiers(
                from: pending.map(\.identifier)
            )
        )
    }

    static func cancelSleepWindDown() {
        center.removePendingNotificationRequests(
            withIdentifiers: [sleepWindDownIdentifier]
        )
    }

    static func scheduleSleepWindDown(
        schedule: SleepSchedule,
        now: Date,
        calendar: Calendar
    ) async -> SleepWindDownScheduleResult {
        cancelSleepWindDown()
        guard let fireDate = SleepScheduleInference.nextWindDownDate(
            for: schedule,
            after: now,
            calendar: calendar
        ) else {
            return .failed
        }

        let fireHour = calendar.component(.hour, from: fireDate)
        let decision = windDownScheduleDecision(
            authorizationStatus: await authorizationStatus(),
            isQuietHour: KairoPrefs.inQuietHours(fireHour)
        )
        guard decision == .scheduled else { return decision }

        do {
            try await center.add(sleepWindDownRequest(
                at: fireDate,
                calendar: calendar
            ))
            return .scheduled
        } catch {
            return .failed
        }
    }

    static func activityRequestIdentifiers(from identifiers: [String]) -> [String] {
        identifiers.filter {
            $0.hasPrefix("start-") || $0.hasPrefix("cushion-")
        }
    }

    static func windDownScheduleDecision(
        authorizationStatus: UNAuthorizationStatus,
        isQuietHour: Bool
    ) -> SleepWindDownScheduleResult {
        switch authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return isQuietHour ? .quietHours : .scheduled
        case .notDetermined, .denied:
            return .notificationsOff
        @unknown default:
            return .notificationsOff
        }
    }

    static func sleepWindDownRequest(
        at date: Date,
        calendar: Calendar
    ) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = "🌙 A softer landing?"
        content.body = "Your usual sleep time is getting close. Wind down now, or ignore this and keep your evening."
        content.sound = .default
        let components = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: date
        )
        let trigger = UNCalendarNotificationTrigger(
            dateMatching: components,
            repeats: false
        )
        return UNNotificationRequest(
            identifier: sleepWindDownIdentifier,
            content: content,
            trigger: trigger
        )
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
