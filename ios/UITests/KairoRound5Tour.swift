import XCTest

/// Round-5 evidence: Week screen with Weekly Intentions (G3) + tappable blocks (G1).
final class KairoRound5Tour: XCTestCase {
    func testRound5() throws {
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

        XCTAssertTrue(app.tabBars.buttons["Week"].waitForExistence(timeout: 20))
        app.tabBars.buttons["Week"].tap()
        _ = app.staticTexts["This week, I'd love to…"].waitForExistence(timeout: 10)
        sleep(3)
        snap(app, "60-week-intentions")
        XCTAssertTrue(app.tabBars.buttons["Week"].isSelected)
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }
}
