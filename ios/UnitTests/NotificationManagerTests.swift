import UserNotifications
import XCTest
@testable import Kairo

final class NotificationManagerTests: XCTestCase {
    func testActivityRequestFilterPreservesWindDownIdentifier() {
        let identifiers = [
            "start-activity-a",
            "cushion-activity-a",
            "kairo-sleep-wind-down",
            "another-feature",
        ]

        let removable = NotificationManager.activityRequestIdentifiers(
            from: identifiers
        )

        XCTAssertEqual(
            Set(removable),
            Set(["start-activity-a", "cushion-activity-a"])
        )
    }

    func testWindDownRequestUsesStableIdentifierAndGentleCopy() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        let date = calendar.date(from: DateComponents(
            year: 2026,
            month: 7,
            day: 28,
            hour: 22,
            minute: 45
        ))!

        let request = NotificationManager.sleepWindDownRequest(
            at: date,
            calendar: calendar
        )

        XCTAssertEqual(request.identifier, "kairo-sleep-wind-down")
        XCTAssertEqual(request.content.title, "🌙 A softer landing?")
        XCTAssertEqual(
            request.content.body,
            "Your usual sleep time is getting close. Wind down now, or ignore this and keep your evening."
        )
        let trigger = request.trigger as? UNCalendarNotificationTrigger
        XCTAssertEqual(trigger?.dateComponents.hour, 22)
        XCTAssertEqual(trigger?.dateComponents.minute, 45)
        XCTAssertEqual(trigger?.repeats, false)
    }

    func testWindDownReturnsNotificationsOffWithoutRequest() {
        let result = NotificationManager.windDownScheduleDecision(
            authorizationStatus: .denied,
            isQuietHour: false
        )

        XCTAssertEqual(result, .notificationsOff)
    }

    func testWindDownRespectsQuietHours() {
        let result = NotificationManager.windDownScheduleDecision(
            authorizationStatus: .authorized,
            isQuietHour: true
        )

        XCTAssertEqual(result, .quietHours)
    }

    func testWindDownSchedulesWhenAuthorizedAndOutsideQuietHours() {
        let result = NotificationManager.windDownScheduleDecision(
            authorizationStatus: .authorized,
            isQuietHour: false
        )

        XCTAssertEqual(result, .scheduled)
    }
}
