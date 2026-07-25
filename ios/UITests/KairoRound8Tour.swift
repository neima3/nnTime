import XCTest

/// Round-8 evidence: iOS accessibility parity (I1) — high contrast, dyslexia
/// font and larger text, driven by the account's shared prefs.
///
/// Captures Settings → Access and Today with the modes on, then turns them back
/// off so the shared QA account is left as it was found (the modes sync, so
/// leaving them on would change every other tour's screenshots).
final class KairoRound8Tour: XCTestCase {
    func testAccessibilityModes() throws {
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
        let settingsRow = app.staticTexts["Settings"].firstMatch
        XCTAssertTrue(settingsRow.waitForExistence(timeout: 10), "no Settings row on More")
        settingsRow.tap()

        let highContrast = app.switches["High contrast"]
        XCTAssertTrue(highContrast.waitForExistence(timeout: 10), "no High contrast row")
        XCTAssertTrue(app.switches["Dyslexia-friendly font"].exists, "no dyslexia row")
        XCTAssertTrue(app.switches["Larger text"].exists, "no larger-text row")
        snap(app, "90-access-default")

        // On.
        highContrast.tap()
        app.switches["Dyslexia-friendly font"].tap()
        app.switches["Larger text"].tap()
        sleep(2)
        snap(app, "91-access-all-on")

        // The whole app restyles, not just this screen.
        app.tabBars.buttons["Today"].tap()
        sleep(3)
        snap(app, "92-today-high-contrast")

        // Back off — leave the shared account as we found it.
        app.tabBars.buttons["More"].tap()
        let settingsAgain = app.staticTexts["Settings"].firstMatch
        XCTAssertTrue(settingsAgain.waitForExistence(timeout: 10))
        settingsAgain.tap()
        XCTAssertTrue(app.switches["High contrast"].waitForExistence(timeout: 10))
        app.switches["High contrast"].tap()
        app.switches["Dyslexia-friendly font"].tap()
        app.switches["Larger text"].tap()
        sleep(2)
        snap(app, "93-access-restored")

        // Still on the Access screen and readable after all that toggling.
        XCTAssertTrue(app.switches["High contrast"].exists)
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }
}
