import XCTest

/// Round-4 evidence: iOS Month view (F3) and Settings formatting (F6).
final class KairoRound4Tour: XCTestCase {
    func testRound4() throws {
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

        // Month (F3)
        let month = app.staticTexts["Month"].firstMatch
        XCTAssertTrue(month.waitForExistence(timeout: 8))
        month.tap()
        XCTAssertTrue(app.navigationBars.staticTexts["Month"].waitForExistence(timeout: 8))
        sleep(2)
        snap(app, "50-month")
        app.navigationBars.buttons.element(boundBy: 0).tap()

        // Settings formatting (F6)
        let settings = app.staticTexts["Settings"].firstMatch
        XCTAssertTrue(settings.waitForExistence(timeout: 8))
        settings.tap()
        XCTAssertTrue(app.staticTexts["Week starts"].waitForExistence(timeout: 8))
        sleep(1)
        snap(app, "51-settings-format")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }
}
