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
    let notificationPrefs: NotificationPreferences?
    let revision: Int
}

struct DayResponse: Decodable {
    let date: String
    let zone: String
    let activities: [Activity]
    let anytimeTasks: [TaskItem]?
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

/// GET /api/v1/search (H3). One row per matched activity series or task.
struct SearchResponse: Decodable {
    let query: String
    /// Today in the user's planning zone — the client labels dates against this.
    let today: String
    let zone: String
    let items: [Hit]

    struct Hit: Decodable, Identifiable {
        let id: String
        /// "activity" or "task".
        let kind: String
        let title: String
        let emoji: String?
        /// nil for inbox tasks (no date).
        let date: String?
        /// Minutes from midnight; nil for tasks.
        let startMin: Int?
        let categoryId: String?
        /// "title" or "notes" — the UI says so when a note produced the match.
        let matchedOn: String
        let repeats: Bool

        var isTask: Bool { kind == "task" }
    }
}

struct StatsResponse: Decodable {
    struct DayStat: Decodable { let completed: Int; let focusMin: Int; let mood: String? }
    struct Estimate: Decodable { let sessions: Int; let avgTargetMin: Int; let avgActualMin: Int; let ratio: Double }
    struct FocusHours: Decodable { let hours: [Int]; let peakHour: Int }
    struct EnergyPattern: Decodable {
        struct Window: Decodable { let start: Int; let end: Int }
        let byHour: [Int]
        let sampled: Int
        let window: Window?
    }

    struct Streak: Decodable { let current: Int; let best: Int }
    let byDate: [String: DayStat]
    let streak: Streak
    let totalCompleted: Int
    let totalFocusMin: Int
    let estimate: Estimate?
    let focusHours: FocusHours?
    let energyPattern: EnergyPattern?
    let days: Int?
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

// MARK: - Typed mutation models

typealias NotificationPreferences = [String: NotificationPreferenceValue]

indirect enum NotificationPreferenceValue:
    Codable,
    Equatable,
    Sendable
{
    case string(String)
    case integer(Int)
    case number(Double)
    case boolean(Bool)
    case object(NotificationPreferences)
    case array([NotificationPreferenceValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .boolean(value)
        } else if let value = try? container.decode(Int.self) {
            self = .integer(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode(NotificationPreferences.self) {
            self = .object(value)
        } else {
            self = .array(
                try container.decode([NotificationPreferenceValue].self)
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case let .string(value): try container.encode(value)
        case let .integer(value): try container.encode(value)
        case let .number(value): try container.encode(value)
        case let .boolean(value): try container.encode(value)
        case let .object(value): try container.encode(value)
        case let .array(value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}

enum UpdateField<Value: Equatable & Sendable>: Equatable, Sendable {
    case unchanged
    case null
    case value(Value)
}

struct SettingsUpdate: Equatable, Sendable {
    var timezone: String?
    var locale: String?
    var weekStart: WeekStart?
    var hourCycle: HourCyclePreference?
    var theme: ThemePreference?
    var reducedStimulation: Bool?
    var notificationPrefs: NotificationPreferences?

    init(
        timezone: String? = nil,
        locale: String? = nil,
        weekStart: WeekStart? = nil,
        hourCycle: HourCyclePreference? = nil,
        theme: ThemePreference? = nil,
        reducedStimulation: Bool? = nil,
        notificationPrefs: NotificationPreferences? = nil
    ) {
        self.timezone = timezone
        self.locale = locale
        self.weekStart = weekStart
        self.hourCycle = hourCycle
        self.theme = theme
        self.reducedStimulation = reducedStimulation
        self.notificationPrefs = notificationPrefs
    }
}

enum WeekStart: Int, Equatable, Sendable {
    case sunday = 0
    case monday
    case tuesday
    case wednesday
    case thursday
    case friday
    case saturday
}

enum HourCyclePreference: String, Equatable, Sendable {
    case h12
    case h24
}

enum ThemePreference: String, Equatable, Sendable {
    case system
    case light
    case dark
}

enum ActivityEditScope: String, Equatable, Sendable {
    case this
    case thisAndFuture = "this_and_future"
    case all
}

enum ActivityEnergy: String, Equatable, Sendable {
    case low
    case medium
    case high
}

enum ActivityPriority: String, Equatable, Sendable {
    case none
    case low
    case high
}

enum ActivityStatus: String, Equatable, Sendable {
    case pending
    case completed
    case skipped
    case cancelled
}

enum ActivitySource: String, Equatable, Sendable {
    case manual
    case routine
    case calendar
}

struct ChecklistUpdateItem: Codable, Equatable, Hashable, Sendable {
    var label: String
    var done: Bool?
}

struct ActivityUpdate: Equatable, Sendable {
    var editScope: ActivityEditScope?
    var occurrenceKey: Date?
    var tz: String?
    var dtstartLocal: Date?
    var rrule: UpdateField<String>
    var exdate: UpdateField<[String]>
    var rdate: UpdateField<[Date]>
    var title: String?
    var emoji: UpdateField<String>
    var categoryId: UpdateField<String>
    var durationMin: Int?
    var checklistTemplate: [ChecklistUpdateItem]?
    var energy: UpdateField<ActivityEnergy>
    var priority: ActivityPriority?
    var tags: UpdateField<[String]>
    var notes: UpdateField<String>
    var source: ActivitySource?
    var sourceRef: UpdateField<String>
    var status: ActivityStatus?
    var startAt: Date?
    var completedAt: UpdateField<Date>
    var checklistOverride: UpdateField<[ChecklistUpdateItem]>

    init(
        editScope: ActivityEditScope? = nil,
        occurrenceKey: Date? = nil,
        tz: String? = nil,
        dtstartLocal: Date? = nil,
        rrule: UpdateField<String> = .unchanged,
        exdate: UpdateField<[String]> = .unchanged,
        rdate: UpdateField<[Date]> = .unchanged,
        title: String? = nil,
        emoji: UpdateField<String> = .unchanged,
        categoryId: UpdateField<String> = .unchanged,
        durationMin: Int? = nil,
        checklistTemplate: [ChecklistUpdateItem]? = nil,
        energy: UpdateField<ActivityEnergy> = .unchanged,
        priority: ActivityPriority? = nil,
        tags: UpdateField<[String]> = .unchanged,
        notes: UpdateField<String> = .unchanged,
        source: ActivitySource? = nil,
        sourceRef: UpdateField<String> = .unchanged,
        status: ActivityStatus? = nil,
        startAt: Date? = nil,
        completedAt: UpdateField<Date> = .unchanged,
        checklistOverride: UpdateField<[ChecklistUpdateItem]> = .unchanged
    ) {
        self.editScope = editScope
        self.occurrenceKey = occurrenceKey
        self.tz = tz
        self.dtstartLocal = dtstartLocal
        self.rrule = rrule
        self.exdate = exdate
        self.rdate = rdate
        self.title = title
        self.emoji = emoji
        self.categoryId = categoryId
        self.durationMin = durationMin
        self.checklistTemplate = checklistTemplate
        self.energy = energy
        self.priority = priority
        self.tags = tags
        self.notes = notes
        self.source = source
        self.sourceRef = sourceRef
        self.status = status
        self.startAt = startAt
        self.completedAt = completedAt
        self.checklistOverride = checklistOverride
    }
}

enum FocusTransitionState: String, Equatable, Sendable {
    case running
    case paused
    case completed
    case skipped
    case cancelled
}

enum FocusCommand: Equatable, Sendable {
    case transition(FocusTransitionState)
    case extend(FocusExtensionMinutes)
}

enum FocusExtensionMinutes: Int, Equatable, Sendable {
    case one = 1
    case five = 5
    case ten = 10
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
    /// A wall-clock time label honouring the account's hour-cycle setting.
    ///
    /// This used to hardcode 24-hour, so Settings → Formatting → Time saved and
    /// synced but changed nothing on screen. Every time label in the app goes
    /// through here, so the setting now reaches all of them.
    ///
    /// Format matches the web (src/lib/time-format.ts):
    ///   h24 → "9:00", "13:30"      (no leading zero, unchanged)
    ///   h12 → "9:00 AM", "1:30 PM", "12:00 PM" noon, "12:15 AM" past midnight
    static func hhmm(_ minutes: Int, hourCycle: String? = nil) -> String {
        let total = ((minutes % 1440) + 1440) % 1440   // tolerate overnight math
        let h = total / 60
        let m = total % 60
        let twelve = (hourCycle ?? KairoPrefs.hourCycle) != "h24"
        guard twelve else { return String(format: "%d:%02d", h, m) }
        let suffix = h < 12 ? "AM" : "PM"
        let display = h % 12 == 0 ? 12 : h % 12
        return String(format: "%d:%02d %@", display, m, suffix)
    }

    /// Compact hour mark for heat strips ("9 AM" / "9:00") — mirrors the web's
    /// formatHourLabel so both platforms read the same.
    static func hourLabel(_ hour: Int, hourCycle: String? = nil) -> String {
        let h = ((hour % 24) + 24) % 24
        let twelve = (hourCycle ?? KairoPrefs.hourCycle) != "h24"
        guard twelve else { return String(format: "%d:00", h) }
        let suffix = h < 12 ? "AM" : "PM"
        let display = h % 12 == 0 ? 12 : h % 12
        return "\(display) \(suffix)"
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
