import XCTest

/// Round-13 evidence: Health writes and sleep reads are independently opt-in,
/// plainly disclosed, and never presented as one blanket permission.
final class KairoRound13Tour: XCTestCase {
    func testIndependentHealthConsentSurface() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-kairoSkipOnboarding"]
        app.launch()

        let email = app.textFields["you@example.com"]
        if email.waitForExistence(timeout: 6) {
            email.tap()
            email.typeText("qa-polish-live@kairo.test")
            let password = app.secureTextFields["Your password"]
            password.tap()
            password.typeText("kairo-qa-live-2026!")
            app.buttons["Sign in"].tap()
        }

        XCTAssertTrue(app.tabBars.buttons["More"].waitForExistence(timeout: 20))
        app.tabBars.buttons["More"].tap()
        let settings = app.staticTexts["Settings"].firstMatch
        XCTAssertTrue(settings.waitForExistence(timeout: 10))
        settings.tap()

        let lightTheme = app.buttons["Light"]
        XCTAssertTrue(lightTheme.waitForExistence(timeout: 5))
        lightTheme.tap()

        let writeToggle = app.switches["Save focused minutes"]
        let sleepToggle = app.switches["Sleep-aware wind-down"]
        for _ in 0..<8 where !sleepToggle.isHittable {
            app.swipeUp()
        }

        XCTAssertTrue(writeToggle.waitForExistence(timeout: 5))
        XCTAssertTrue(sleepToggle.waitForExistence(timeout: 5), "no sleep consent toggle")
        XCTAssertTrue(sleepToggle.isHittable, "sleep consent toggle remained off screen")
        XCTAssertEqual(writeToggle.value as? String, "0", "mindful writes must default off")
        XCTAssertEqual(sleepToggle.value as? String, "0", "sleep reads must default off")
        XCTAssertTrue(
            app.staticTexts[
                "Writes mindful minutes only. This setting never reads Health data."
            ].exists
        )
        XCTAssertTrue(
            app.staticTexts[
                "Reads recent sleep times on this iPhone to suggest when to wind down. Nothing is uploaded."
            ].exists
        )

        attachScreenshot(app, named: "130-health-consent-light")

        let darkTheme = app.buttons["Dark"]
        for _ in 0..<8 where !darkTheme.isHittable {
            app.swipeDown()
        }
        XCTAssertTrue(darkTheme.isHittable)
        darkTheme.tap()
        for _ in 0..<8 where !sleepToggle.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(sleepToggle.isHittable)
        attachScreenshot(app, named: "131-health-consent-dark")
    }

    private func attachScreenshot(_ app: XCUIApplication, named name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
