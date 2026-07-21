import XCTest

/// P3 evidence: navigate to the native Routines screen and, if a routine
/// exists, open the step player.
final class KairoRoutinesTour: XCTestCase {
    func testRoutines() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-kairoSkipOnboarding"]
        app.launch()

        // Sign in if needed.
        let email = app.textFields["you@example.com"]
        if email.waitForExistence(timeout: 6) {
            email.tap(); email.typeText("qa-polish-live@kairo.test")
            let pw = app.secureTextFields["Your password"]
            pw.tap(); pw.typeText("kairo-qa-live-2026!")
            app.buttons["Sign in"].tap()
        }

        XCTAssertTrue(app.tabBars.buttons["More"].waitForExistence(timeout: 20))
        app.tabBars.buttons["More"].tap()

        let routines = app.staticTexts["Routines"].firstMatch
        XCTAssertTrue(routines.waitForExistence(timeout: 8))
        routines.tap()

        // Routines list (empty state or cards).
        XCTAssertTrue(app.navigationBars.staticTexts["Routines"].waitForExistence(timeout: 8))
        sleep(2)
        snap(app, "20-routines-list")

        // If a playable routine card is present, open the player.
        let play = app.images["play.circle.fill"].firstMatch
        if play.waitForExistence(timeout: 3) {
            play.tap()
            sleep(2)
            snap(app, "21-routine-player")
        }
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }
}
