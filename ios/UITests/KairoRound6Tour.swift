import XCTest

/// Round-6 evidence: Focus screen with the native soundscape picker (H4).
final class KairoRound6Tour: XCTestCase {
    func testRound6() throws {
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

        XCTAssertTrue(app.tabBars.buttons["Focus"].waitForExistence(timeout: 20))
        app.tabBars.buttons["Focus"].tap()
        _ = app.buttons["Start focus"].waitForExistence(timeout: 10)
        sleep(2)
        snap(app, "70-focus-soundscape")
        XCTAssertTrue(app.tabBars.buttons["Focus"].isSelected)
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }
}
