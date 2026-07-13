// Phase 7D tests — planner UI models.
import Testing
import Foundation
@testable import Kairo

@Suite struct ModelTests {
    @Test func activityRowTimeFormat() {
        #expect(ActivityRow.formatTime(0) == "0:00")
        #expect(ActivityRow.formatTime(60) == "1:00")
        #expect(ActivityRow.formatTime(90) == "1:30")
        #expect(ActivityRow.formatTime(780) == "13:00")
    }

    @Test func activityRowEndTime() {
        let row = ActivityRow(id: "1", title: "Test", emoji: "📋",
            startMinutes: 600, durationMinutes: 45,
            category: .sky, isDone: false, energy: nil)
        #expect(row.endTimeMinutes == 645)
    }

    @Test func dayProgressPercentage() {
        #expect(DayProgress(completed: 3, total: 10).percentage == 30)
        #expect(DayProgress(completed: 0, total: 0).percentage == 0)
        #expect(DayProgress(completed: 5, total: 5).percentage == 100)
    }

    @Test func categoryKeyAllCases() {
        #expect(CategoryKey.allCases.count == 6)
        #expect(CategoryKey(rawValue: "peach") == .peach)
        #expect(CategoryKey(rawValue: "invalid") == nil)
    }
}
