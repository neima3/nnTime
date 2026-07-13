// Phase 7D — Planner UI models (SwiftUI-ready).
//
// Maps the generated OpenAPI types into SwiftUI-friendly view models.
// VoiceOver, Dynamic Type, and reduced motion are handled at the view layer.

import Foundation

/// Category color mapping (matches the 6 design tokens).
public enum CategoryKey: String, Sendable, CaseIterable {
    case peach, butter, mint, sky, lilac, rose
}

/// Activity display model for the Today timeline.
public struct ActivityRow: Identifiable, Sendable {
    public let id: String
    public let title: String
    public let emoji: String
    public let startMinutes: Int  // minutes from midnight
    public let durationMinutes: Int
    public let category: CategoryKey
    public let isDone: Bool
    public let energy: EnergyLevel?

    public enum EnergyLevel: String, Sendable {
        case low, medium, high
    }

    public var endTimeMinutes: Int { startMinutes + durationMinutes }

    /// Format minutes-from-midnight as "H:MM".
    public static func formatTime(_ minutes: Int) -> String {
        let h = minutes / 60
        let m = minutes % 60
        return String(format: "%d:%02d", h, m)
    }
}

/// Task display model for the inbox/anytime lists.
public struct TaskRow: Identifiable, Sendable {
    public let id: String
    public let title: String
    public let emoji: String
    public let category: CategoryKey
    public let bucket: TaskBucket
    public let priority: Priority
    public let tags: [String]

    public enum TaskBucket: String, Sendable {
        case inbox, anytime
    }

    public enum Priority: String, Sendable {
        case none, low, high
    }
}

/// Routine display model.
public struct RoutineCard: Identifiable, Sendable {
    public let id: String
    public let title: String
    public let emoji: String
    public let category: CategoryKey
    public let stepCount: Int
    public let totalMinutes: Int
    public let scheduleLabel: String
}

/// Day progress for the header ring.
public struct DayProgress: Sendable {
    public let completed: Int
    public let total: Int

    public var percentage: Int {
        total > 0 ? Int(Double(completed) / Double(total) * 100) : 0
    }
}
