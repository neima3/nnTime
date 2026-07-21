import XCTest

/// Captures the first-run onboarding sheet and the Settings screen (dark).
final class KairoNewScreensTour: XCTestCase {
    func testNewScreens() throws {
        let app = XCUIApplication()   // no skip flag → onboarding shows
        app.launch()

        let email = app.textFields["you@example.com"]
        if email.waitForExistence(timeout: 6) {
            email.tap(); email.typeText("qa-polish-live@kairo.test")
            let pw = app.secureTextFields["Your password"]
            pw.tap(); pw.typeText("kairo-qa-live-2026!")
            app.buttons["Sign in"].tap()
        }

        // Onboarding sheet
        XCTAssertTrue(app.staticTexts["Pick your anchors"].waitForExistence(timeout: 20))
        sleep(1)
        snap(app, "09-onboarding")
        app.buttons["Skip — I'll build my own"].tap()

        // Settings → dark
        XCTAssertTrue(app.buttons["New activity"].waitForExistence(timeout: 15))
        app.tabBars.buttons["More"].tap()
        app.staticTexts["Settings"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Theme"].waitForExistence(timeout: 8))
        app.buttons["Dark"].tap()
        sleep(1)
        snap(app, "10-settings-dark")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }
}
