import XCTest

/// Round-3 evidence: Settings reminders toggle (T2/T4) and Templates (T5).
final class KairoRound3Tour: XCTestCase {
    func testRound3() throws {
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

        XCTAssertTrue(app.tabBars.buttons["More"].waitForExistence(timeout: 20))
        app.tabBars.buttons["More"].tap()

        // Templates (T5)
        let templates = app.staticTexts["Templates"].firstMatch
        XCTAssertTrue(templates.waitForExistence(timeout: 8))
        templates.tap()
        XCTAssertTrue(app.navigationBars.staticTexts["Templates"].waitForExistence(timeout: 8))
        sleep(2)
        snap(app, "40-templates")
        app.navigationBars.buttons.element(boundBy: 0).tap()

        // Settings reminders (T2/T4)
        let settings = app.staticTexts["Settings"].firstMatch
        XCTAssertTrue(settings.waitForExistence(timeout: 8))
        settings.tap()
        XCTAssertTrue(app.staticTexts["Gentle activity reminders"].waitForExistence(timeout: 8))
        sleep(1)
        snap(app, "41-settings-reminders")

        // Insights → mood check-in (scroll to bottom)
        app.navigationBars.buttons.element(boundBy: 0).tap()
        let insights = app.staticTexts["Insights"].firstMatch
        if insights.waitForExistence(timeout: 6) {
            insights.tap()
            XCTAssertTrue(app.navigationBars.staticTexts["Insights"].waitForExistence(timeout: 8))
            sleep(1)
            app.swipeUp(); app.swipeUp(); app.swipeUp()
            sleep(1)
            snap(app, "42-insights-mood")
        }
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }
}
