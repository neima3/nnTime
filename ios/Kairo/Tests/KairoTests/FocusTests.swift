// Phase 7E tests — focus state + local notifications.
import Testing
import Foundation
@testable import Kairo

@Suite struct FocusTests {
    @Test func remainingSecondsFullSession() {
        let session = FocusSessionState(
            id: "1", state: .running,
            startedAt: Date(),
            targetDurationMin: 25,
            accumulatedPauseSec: 0,
            currentIntervalStartedAt: Date()
        )
        let remaining = session.remainingSeconds()
        #expect(remaining <= 25 * 60)
        #expect(remaining > 24 * 60) // ~25 min
    }

    @Test func remainingSecondsWithPause() {
        let startedAt = Date().addingTimeInterval(-600) // 10 min ago
        let session = FocusSessionState(
            id: "2", state: .running,
            startedAt: startedAt,
            targetDurationMin: 25,
            accumulatedPauseSec: 300, // 5 min paused
            currentIntervalStartedAt: startedAt
        )
        let remaining = session.remainingSeconds()
        // 25 min - (10 min elapsed - 5 min pause) = 20 min
        #expect(remaining <= 20 * 60 + 5) // small tolerance
        #expect(remaining > 19 * 60)
    }

    @Test func isOvertimeWhenExpired() {
        let startedAt = Date().addingTimeInterval(-1800) // 30 min ago
        let session = FocusSessionState(
            id: "3", state: .running,
            startedAt: startedAt,
            targetDurationMin: 25, // 25 min target, 30 min ago
            accumulatedPauseSec: 0,
            currentIntervalStartedAt: startedAt
        )
        #expect(session.remainingSeconds() == 0)
        #expect(session.isOvertime())
    }

    @Test func notOvertimeWhenPaused() {
        let startedAt = Date().addingTimeInterval(-1800)
        let session = FocusSessionState(
            id: "4", state: .paused,
            startedAt: startedAt,
            targetDurationMin: 25,
            accumulatedPauseSec: 0,
            currentIntervalStartedAt: nil
        )
        #expect(!session.isOvertime())
    }

    @Test func focusStateEnum() {
        #expect(FocusSessionState.FocusState.running.rawValue == "running")
        #expect(FocusSessionState.FocusState.paused.rawValue == "paused")
        #expect(FocusSessionState.FocusState.completed.rawValue == "completed")
    }
}
