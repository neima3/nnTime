import XCTest

/// Round-11 evidence: Apple Health is explicit, off by default, and explains
/// exactly what Kairo writes before the system permission sheet can appear.
final class KairoRound11Tour: XCTestCase {
    func testHealthKitConsentSurface() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-kairoSkipOnboarding"]
        app.launch()

        let email = app.textFields["you@example.com"]
        if email.waitForExistence(timeout: 6) {
            email.tap(); email.typeText("qa-polish-live@kairo.test")
            let password = app.secureTextFields["Your password"]
            password.tap(); password.typeText("kairo-qa-live-2026!")
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

        let healthToggle = app.switches["Save focused minutes"]
        for _ in 0..<6 where !healthToggle.isHittable {
            app.swipeUp()
        }

        XCTAssertTrue(healthToggle.waitForExistence(timeout: 5), "no Apple Health consent toggle")
        XCTAssertTrue(healthToggle.isHittable, "Apple Health consent toggle remained off screen")
        XCTAssertEqual(healthToggle.value as? String, "0", "Health sync must default off")
        XCTAssertTrue(
            app.staticTexts["Off by default. You choose if Kairo writes anything."].exists,
            "the consent surface must explain the default before permission"
        )
        XCTAssertTrue(
            app.staticTexts[
                "Writes mindful minutes only. This setting never reads Health data."
            ].exists,
            "the consent surface must name exactly what leaves Kairo"
        )

        attachScreenshot(app, named: "110-healthkit-consent-light")

        let darkTheme = app.buttons["Dark"]
        for _ in 0..<6 where !darkTheme.isHittable {
            app.swipeDown()
        }
        XCTAssertTrue(darkTheme.isHittable, "Dark theme control remained off screen")
        darkTheme.tap()

        for _ in 0..<6 where !healthToggle.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(healthToggle.isHittable)
        attachScreenshot(app, named: "111-healthkit-consent-dark")
    }

    private func attachScreenshot(_ app: XCUIApplication, named name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
