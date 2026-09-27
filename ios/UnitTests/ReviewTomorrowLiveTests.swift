import XCTest
@testable import Kairo

/// Opt-in end-to-end check of Review → Move to tomorrow against a LOCAL dev
/// server with a throwaway synthetic account. Never point this at prod.
///
///     TEST_RUNNER_KAIRO_LIVE_REVIEW_URL=http://localhost:3456 \
///       xcodebuild test ... -only-testing:KairoUnitTests/ReviewTomorrowLiveTests
final class ReviewTomorrowLiveTests: XCTestCase {
    private let zone = TimeZone(identifier: "America/New_York")!

    func testDailySeriesIsNotDuplicatedOnTomorrowWeeklyStillMoves() async throws {
        guard let raw = ProcessInfo.processInfo.environment["KAIRO_LIVE_REVIEW_URL"],
              let baseURL = URL(string: raw)
        else { throw XCTSkip("Set KAIRO_LIVE_REVIEW_URL to a local dev server") }
        guard ["localhost", "127.0.0.1"].contains(baseURL.host ?? "") else {
            throw XCTSkip("Live review test only runs against a local server")
        }
        guard KTime.nowMinutes(in: zone) >= 20 else {
            throw XCTSkip("Today's 00:05 occurrence hasn't ended yet")
        }

        let storage = HTTPCookieStorage.sharedCookieStorage(
            forGroupContainerIdentifier: "ReviewTomorrowLive.\(UUID())"
        )
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = storage
        configuration.httpShouldSetCookies = true
        let session = URLSession(configuration: configuration)
        let api = KairoAPI(
            baseURL: baseURL,
            session: session,
            sessionController: NativeSessionController(
                baseURL: baseURL,
                cookieStorage: storage,
                envelopeStore: MemorySessionEnvelopeStore()
            ),
            timezoneIdentifierProvider: { "America/New_York" }
        )
        let email = "qa-r95-ios-\(Int(Date().timeIntervalSince1970))@kairo.test"
        try await api.signUp(name: "QA R95 iOS", email: email, password: "kairo-qa-round95")

        let today = KTime.dateString(Date(), zone: zone)
        let yesterday = KTime.dateString(Date().addingTimeInterval(-86_400), zone: zone)
        let tomorrow = ReviewTomorrow.nextDate(today)
        let weekday = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][
            Calendar(identifier: .gregorian).dateComponents(in: zone, from: Date()).weekday! - 1
        ]

        func series(_ title: String, _ rrule: String, from date: String) async throws -> Activity {
            try await api.createActivity(
                tz: zone.identifier,
                dtstartLocal: KTime.instant(date: date, minutes: 5, zone: zone),
                title: title, emoji: "🧪", durationMin: 10,
                rrule: rrule, categoryId: nil
            )
        }
        let daily = try await series("Stretch (daily)", "FREQ=DAILY", from: yesterday)
        let control = try await series("Meds (daily, old path)", "FREQ=DAILY", from: yesterday)
        let weekly = try await series("Plants (weekly)", "FREQ=WEEKLY;BYDAY=\(weekday)", from: today)
        addTeardownBlock {
            for id in [daily.id, control.id, weekly.id] {
                if let current = try? await api.activity(id: id) {
                    try? await api.deleteActivity(activityId: id, revision: current.revision)
                }
            }
            await api.signOut()
        }

        func block(_ id: String, on date: String) async throws -> DayBlock {
            let day = try await api.day(date)
            let activity = try XCTUnwrap(day.activities.first { $0.id == id }, "\(id) missing on \(date)")
            return activity.block(in: zone, category: .sky)
        }
        func copies(_ id: String, on date: String) async throws -> Int {
            try await api.day(date).activities.filter { $0.id == id }.count
        }

        let reviewable = ReviewWindow.partition(
            [try await block(daily.id, on: today), try await block(weekly.id, on: today)],
            nowMin: KTime.nowMinutes(in: zone)
        )
        XCTAssertEqual(reviewable.past.count, 2, "both 00:05 blocks have ended")
        let dailyBefore = try await copies(daily.id, on: tomorrow)
        let weeklyBefore = try await copies(weekly.id, on: tomorrow)
        XCTAssertEqual(dailyBefore, 1)
        XCTAssertEqual(weeklyBefore, 0)

        // The pre-fix path: PATCH this occurrence's startAt onto tomorrow.
        let controlBlock = try await block(control.id, on: today)
        _ = try await api.moveActivity(
            activityId: control.id,
            revision: controlBlock.revision,
            occurrenceKey: controlBlock.occurrenceKey,
            startAt: KTime.instant(date: tomorrow, minutes: controlBlock.startMin, zone: zone)
        )
        let legacyCopies = try await copies(control.id, on: tomorrow)
        print("LIVE legacy move → \(control.id) copies on \(tomorrow): \(legacyCopies)")
        XCTAssertEqual(legacyCopies, 2, "reproduces the duplicate the old iOS path created")

        let dailyResult = try await ReviewTomorrow.perform(
            try await block(daily.id, on: today), date: today, zone: zone, api: api
        )
        XCTAssertEqual(dailyResult.outcome, .alreadyTomorrow)
        let dailyCopies = try await copies(daily.id, on: tomorrow)
        print("LIVE fixed move → \(daily.id) copies on \(tomorrow): \(dailyCopies)")
        XCTAssertEqual(dailyCopies, 1)
        // Let go = skipped, and skipped occurrences leave the day timeline.
        let dailyLeft = try await copies(daily.id, on: today)
        XCTAssertEqual(dailyLeft, 0)

        let weeklyResult = try await ReviewTomorrow.perform(
            try await block(weekly.id, on: today), date: today, zone: zone, api: api
        )
        XCTAssertEqual(weeklyResult.outcome, .moved)
        let weeklyCopies = try await copies(weekly.id, on: tomorrow)
        let weeklyLeft = try await copies(weekly.id, on: today)
        print("LIVE weekly move → \(weekly.id) copies on \(tomorrow): \(weeklyCopies), on \(today): \(weeklyLeft)")
        XCTAssertEqual(weeklyCopies, 1)
        XCTAssertEqual(weeklyLeft, 0)
    }
}
