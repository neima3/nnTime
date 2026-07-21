import XCTest

/// Captures the new native parity screens: Stats, Play arcade, Pick-for-me.
final class KairoParityTour: XCTestCase {
    func testParityScreens() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-kairoSkipOnboarding"]
        app.launch()
        let email = app.textFields["you@example.com"]
        if email.waitForExistence(timeout: 10) {
            email.tap(); email.typeText("qa-polish-live@kairo.test")
            let pw = app.secureTextFields["Your password"]; pw.tap(); pw.typeText("kairo-qa-live-2026!")
            app.buttons["Sign in"].tap()
        }
        XCTAssertTrue(app.buttons["New activity"].waitForExistence(timeout: 30))

        // More → Insights
        app.tabBars.buttons["More"].tap()
        app.staticTexts["Insights"].firstMatch.tap()
        sleep(3)
        snap(app, "11-stats")
        XCTAssertTrue(app.staticTexts["This week"].waitForExistence(timeout: 8))
        app.navigationBars.buttons.firstMatch.tap()  // back

        // More → Brain breaks
        app.staticTexts["Brain breaks"].firstMatch.tap()
        sleep(2)
        snap(app, "12-play")
        XCTAssertTrue(app.staticTexts["Time Feel"].waitForExistence(timeout: 8))
        // launch one game
        app.staticTexts["Time Feel"].tap()
        sleep(1)
        snap(app, "13-timefeel")
    }
    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }
}
