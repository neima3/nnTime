// Phase 7E — Focus + local notifications (ADR-004).
//
// Elapsed-time reconstruction (no indefinite background), local notifications
// scheduled from the cached day, timer Live-Activity-ready.

import Foundation

/// Focus session state (mirrors the server-authoritative state machine, ADR-004).
public struct FocusSessionState: Sendable {
    public let id: String
    public let state: FocusState
    public let startedAt: Date
    public let targetDurationMin: Int
    public let accumulatedPauseSec: Int
    public let currentIntervalStartedAt: Date?

    public enum FocusState: String, Sendable {
        case running, paused, completed, skipped, cancelled
    }

    /// Derive remaining seconds from server time (ADR-004: clients derive,
    /// never persist countdowns).
    public func remainingSeconds(now: Date = Date()) -> Int {
        // ADR-004: clients derive remaining time from server-time timestamps.
        // elapsed = total wall time since start minus accumulated pause time.
        let elapsed = now.timeIntervalSince(startedAt) - Double(accumulatedPauseSec)
        let targetSec = Double(targetDurationMin) * 60
        return max(0, Int(targetSec - elapsed))
    }

    /// Check if the session is in overtime.
    public func isOvertime(now: Date = Date()) -> Bool {
        remainingSeconds(now: now) == 0 && state == .running
    }
}

/// Local notification scheduler — schedules notifications from the cached day.
/// ADR-004: reconciled on each foreground sync.
public struct LocalNotificationScheduler: Sendable {
    public init() {}

    /// Schedule a start notification for an activity.
    public func scheduleActivityStart(title: String, body: String, fireAt: Date, identifier: String) {
        // In the real app, this uses UNUserNotificationCenter.
        // For the library, we just validate the inputs.
        precondition(!title.isEmpty)
        precondition(!identifier.isEmpty)
        precondition(fireAt > Date())
    }

    /// Cancel a scheduled notification by identifier.
    public func cancel(identifier: String) {
        precondition(!identifier.isEmpty)
    }
}
