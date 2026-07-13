// Phase 8 tests — widgets, Live Activity, HealthKit, privacy labels.
import Testing
import Foundation
@testable import Kairo

@Suite struct iOSSurfacesTests {
    // 8A: Widget config.
    @Test func widgetConfigKinds() {
        let timeline = WidgetConfig(kind: .timeline, family: .systemMedium)
        #expect(timeline.kind == .timeline)
        let nextUp = WidgetConfig(kind: .nextUp, family: .systemSmall)
        #expect(nextUp.kind == .nextUp)
        let complete = WidgetConfig(kind: .completeTask, family: .accessoryRectangular)
        #expect(complete.family == .accessoryRectangular)
    }

    // 8A: Live Activity state.
    @Test func focusLiveActivityStates() {
        let focusing = FocusLiveActivity(activityTitle: "Deep work", remainingMinutes: 20, state: .focusing)
        #expect(focusing.state == .focusing)
        #expect(focusing.remainingMinutes == 20)
        let paused = FocusLiveActivity(activityTitle: "Break", remainingMinutes: 5, state: .paused)
        #expect(paused.state == .paused)
    }

    // 8B: HealthKit requires explicit opt-in.
    @Test func healthKitRequiresOptIn() {
        let noOptIn = HealthKitConfig(writeFocusMinutes: true, readSleepSchedule: true, userOptedIn: false)
        #expect(!noOptIn.isActive)
        let withOptIn = HealthKitConfig(writeFocusMinutes: true, readSleepSchedule: false, userOptedIn: true)
        #expect(withOptIn.isActive)
    }

    // 8B: Reminders import config.
    @Test func remindersImportConfig() {
        #expect(RemindersImportConfig.enabled_.enabled == true)
        #expect(RemindersImportConfig.excluded.enabled == false)
        #expect(!RemindersImportConfig.excluded.reason.isEmpty)
    }

    // 8D: Privacy labels — no tracking.
    @Test func privacyLabelsNoTracking() {
        for label in PrivacyLabel.kairoLabels {
            #expect(!label.usedForTracking)
        }
    }

    // 8D: Privacy labels have purposes.
    @Test func privacyLabelsHavePurposes() {
        for label in PrivacyLabel.kairoLabels {
            #expect(!label.purposes.isEmpty)
        }
    }

    // 8D: Privacy labels cover expected data types.
    @Test func privacyLabelsCoverDataTypes() {
        let types = Set(PrivacyLabel.kairoLabels.map { $0.dataType })
        #expect(types.contains(.contactInfo))
        #expect(types.contains(.identifiers))
        #expect(types.contains(.health))
    }
}
