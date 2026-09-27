import XCTest

/// Opt-in tour of Review → Move to tomorrow against a LOCAL dev server with a
/// seeded synthetic account: a daily "Stretch" (already on tomorrow) and a
/// weekly "Water plants" (not), both ended today. Never point this at prod.
///
///     TEST_RUNNER_KAIRO_LIVE_REVIEW_URL=http://localhost:3456
///     TEST_RUNNER_KAIRO_LIVE_REVIEW_EMAIL=qa-…@kairo.test
///     TEST_RUNNER_KAIRO_LIVE_REVIEW_PASSWORD=…
final class KairoRound95ReviewTomorrowTour: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testDailyIsLetGoWeeklyMoves() throws {
        let env = ProcessInfo.processInfo.environment
        guard let base = env["KAIRO_LIVE_REVIEW_URL"],
              let email = env["KAIRO_LIVE_REVIEW_EMAIL"],
              let password = env["KAIRO_LIVE_REVIEW_PASSWORD"]
        else { throw XCTSkip("Set KAIRO_LIVE_REVIEW_URL/EMAIL/PASSWORD for a local server") }
        guard let host = URL(string: base)?.host, ["localhost", "127.0.0.1"].contains(host) else {
            throw XCTSkip("Review tour only runs against a local server")
        }

        let app = XCUIApplication()
        app.launchEnvironment["KAIRO_BASE_URL"] = base
        app.launchArguments += ["-kairoSkipOnboarding", "-kairoSignedOutFixture"]
        app.launch()

        let emailField = app.textFields["you@example.com"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 12))
        emailField.tap()
        emailField.typeText(email)
        let passwordField = app.secureTextFields["Your password"]
        passwordField.tap()
        passwordField.typeText(password)
        app.buttons["Sign in"].tap()

        let review = app.buttons["Review today"].firstMatch
        XCTAssertTrue(review.waitForExistence(timeout: 20), "Today should offer Review")
        review.tap()

        let move = app.buttons["Move to tomorrow"]
        XCTAssertTrue(move.waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["Stretch"].exists, "daily block reviewed first (07:00)")
        save(app, "r95-ios-review-daily")
        move.tap()

        let notice = app.staticTexts["It’s already on tomorrow — let today’s go"]
        XCTAssertTrue(notice.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Water plants"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Undo"].exists)
        save(app, "r95-ios-review-already-tomorrow")

        move.tap()
        XCTAssertTrue(app.staticTexts["All done ✨"].waitForExistence(timeout: 10))
        XCTAssertFalse(notice.exists, "a real move clears the notice")
        save(app, "r95-ios-review-weekly-moved")
    }

    private func save(_ app: XCUIApplication, _ name: String) {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let dir = ProcessInfo.processInfo.environment["KAIRO_UI_EVIDENCE_DIR"] {
            try? screenshot.pngRepresentation.write(
                to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png")
            )
        }
    }
}
