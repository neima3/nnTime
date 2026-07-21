import Foundation

// MARK: - Wire models (ADR-002 shapes, tolerant decoding)

struct AuthResponse: Decodable {
    let token: String?
}

struct Page<T: Decodable>: Decodable {
    let items: [T]
}

struct UserSettings: Decodable {
    let timezone: String
    let theme: String?
    let reducedStimulation: Bool?
    let hourCycle: String?
    let weekStart: Int?
    let revision: Int
}

struct DayResponse: Decodable {
    let date: String
    let zone: String
    let activities: [Activity]
    let occurrenceStatusBySeries: [String: String]?
}

struct Activity: Decodable, Identifiable {
    let id: String
    let title: String
    let emoji: String?
    let tz: String
    let dtstartLocal: Date
    let durationMin: Int
    let rrule: String?
    let categoryId: String?
    let checklistTemplate: [ChecklistItem]?
    let revision: Int
    /// Present on day-expanded occurrences.
    let occurrenceKey: Date?
    let status: String?

    struct ChecklistItem: Decodable, Hashable {
        let label: String
        let done: Bool?
    }
}

struct TaskItem: Decodable, Identifiable {
    let id: String
    let title: String
    let emoji: String?
    let bucket: String
    let priority: String?
    let revision: Int
    let createdAt: Date?
}

struct StatsResponse: Decodable {
    struct DayStat: Decodable { let completed: Int; let focusMin: Int; let mood: String? }
    struct Estimate: Decodable { let sessions: Int; let avgTargetMin: Int; let avgActualMin: Int; let ratio: Double }
    struct FocusHours: Decodable { let hours: [Int]; let peakHour: Int }

    struct Streak: Decodable { let current: Int; let best: Int }
    let byDate: [String: DayStat]
    let streak: Streak
    let totalCompleted: Int
    let totalFocusMin: Int
    let estimate: Estimate?
    let focusHours: FocusHours?
}

// MARK: - Routines (P3 iOS parity)

struct Routine: Decodable, Identifiable {
    let id: String
    let title: String
    let emoji: String?
    let notes: String?
    let steps: [Step]
    let schedules: [Schedule]
    let stepCount: Int
    let totalMin: Int
    let revision: Int

    struct Step: Decodable, Identifiable {
        let id: String
        let title: String
        let durationMin: Int?
        let sortOrder: Int
    }

    struct Schedule: Decodable, Identifiable {
        let id: String
        let rrule: String?
        let paused: Bool
    }

    /// Steps in play order, filling a default 5-min timer where none is set.
    var orderedSteps: [Step] {
        steps.sorted { $0.sortOrder < $1.sortOrder }
    }
}

struct FocusSnapshot: Decodable {
    let session: FocusSession?
    let remainingSec: Int?
}

struct FocusSession: Decodable, Identifiable {
    let id: String
    let state: String
    let targetDurationMin: Int
    let startedAt: Date?
}

// MARK: - View model shapes

/// A timeline block: an occurrence positioned in minutes-from-midnight.
struct DayBlock: Identifiable {
    let id: String
    let title: String
    let emoji: String
    let startMin: Int
    let durationMin: Int
    let category: KairoCategory
    let done: Bool
    let recurring: Bool
    let revision: Int
    let occurrenceKey: String?
    let checklist: [(label: String, done: Bool)]

    var endMin: Int { startMin + durationMin }
}

extension Activity {
    /// Convert to a positioned block in the given planning zone.
    func block(in zone: TimeZone, category: KairoCategory) -> DayBlock {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = zone
        let comps = cal.dateComponents([.hour, .minute], from: dtstartLocal)
        let startMin = (comps.hour ?? 0) * 60 + (comps.minute ?? 0)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return DayBlock(
            id: id,
            title: title,
            emoji: emoji ?? "📋",
            startMin: startMin,
            durationMin: durationMin,
            category: category,
            done: status == "completed",
            recurring: rrule != nil,
            revision: revision,
            occurrenceKey: occurrenceKey.map { iso.string(from: $0) },
            checklist: (checklistTemplate ?? []).map { ($0.label, $0.done ?? false) }
        )
    }
}

// MARK: - Time formatting

enum KTime {
    static func hhmm(_ minutes: Int) -> String {
        String(format: "%d:%02d", minutes / 60, minutes % 60)
    }

    static func duration(_ minutes: Int) -> String {
        if minutes < 60 { return "\(minutes) min" }
        let h = minutes / 60, m = minutes % 60
        return m == 0 ? "\(h) h" : "\(h) h \(m) min"
    }

    static func mmss(_ seconds: Int) -> String {
        String(format: "%02d:%02d", max(0, seconds) / 60, max(0, seconds) % 60)
    }

    /// YYYY-MM-DD in a zone.
    static func dateString(_ date: Date = Date(), zone: TimeZone = .current) -> String {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.timeZone = zone
        return df.string(from: date)
    }

    /// Local wall-clock minutes on a date in a zone → UTC ISO instant.
    static func instant(date: String, minutes: Int, zone: TimeZone) -> String {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd HH:mm"
        df.timeZone = zone
        let d = df.date(from: "\(date) \(String(format: "%02d:%02d", minutes / 60, minutes % 60))") ?? Date()
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return iso.string(from: d)
    }

    static func nowMinutes(in zone: TimeZone) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = zone
        let c = cal.dateComponents([.hour, .minute], from: Date())
        return (c.hour ?? 0) * 60 + (c.minute ?? 0)
    }
}
