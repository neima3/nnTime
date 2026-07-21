import XCTest

/// Round-2 evidence: iOS Reward Garden + Weekly Reflection on Insights, and
/// Focus rituals on the Focus setup.
final class KairoRound2Tour: XCTestCase {
    func testRound2() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-kairoSkipOnboarding"]
        app.launch()

        let email = app.textFields["you@example.com"]
        if email.waitForExistence(timeout: 6) {
            email.tap(); email.typeText("qa-polish-live@kairo.test")
            let pw = app.secureTextFields["Your password"]
            pw.tap(); pw.typeText("kairo-qa-live-2026!")
            app.buttons["Sign in"].tap()
        }

        // Focus rituals
        XCTAssertTrue(app.tabBars.buttons["Focus"].waitForExistence(timeout: 20))
        app.tabBars.buttons["Focus"].tap()
        sleep(2)
        snap(app, "30-focus-rituals")
        if app.buttons["Wind down"].waitForExistence(timeout: 3) {
            app.buttons["Wind down"].tap()
            sleep(1)
            snap(app, "31-focus-wind-down")
        }

        // Insights: garden + reflection
        app.tabBars.buttons["More"].tap()
        let insights = app.staticTexts["Insights"].firstMatch
        XCTAssertTrue(insights.waitForExistence(timeout: 8))
        insights.tap()
        XCTAssertTrue(app.navigationBars.staticTexts["Insights"].waitForExistence(timeout: 8))
        sleep(2)
        snap(app, "32-insights-garden")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }
}
