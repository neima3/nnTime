// Phase 7D view tests — verify SwiftUI views instantiate correctly.
import Testing
import SwiftUI
@testable import Kairo

@Suite struct ViewTests {
    @Test func todayTimelineViewInstantiates() {
        let activities = [
            ActivityRow(id: "1", title: "Morning", emoji: "🌤️",
                startMinutes: 480, durationMinutes: 30,
                category: .butter, isDone: true, energy: nil),
        ]
        let view = TodayTimelineView(activities: activities, nowMinutes: 500)
        #expect(view.activities.count == 1)
    }

    @Test func activityCardViewInstantiates() {
        let activity = ActivityRow(id: "1", title: "Test", emoji: "📋",
            startMinutes: 600, durationMinutes: 45,
            category: .sky, isDone: false, energy: .medium)
        let view = ActivityCardView(activity: activity, isCurrent: true)
        #expect(view.activity.title == "Test")
        #expect(view.isCurrent == true)
    }

    @Test func inboxViewInstantiates() {
        let tasks = [
            TaskRow(id: "1", title: "Task", emoji: "📋", category: .sky,
                bucket: .inbox, priority: .high, tags: []),
        ]
        let view = InboxView(tasks: tasks)
        #expect(view.tasks.count == 1)
    }

    @Test func focusTimerViewInstantiates() {
        let session = FocusSessionState(
            id: "1", state: .running,
            startedAt: Date(), targetDurationMin: 25,
            accumulatedPauseSec: 0, currentIntervalStartedAt: Date()
        )
        let view = FocusTimerView(session: session, activityTitle: "Deep work", emoji: "🎯")
        #expect(view.activityTitle == "Deep work")
    }

    @Test func dayProgressRingInstantiates() {
        let view = DayProgressRing(progress: DayProgress(completed: 3, total: 10))
        #expect(view.progress.percentage == 30)
    }
}
