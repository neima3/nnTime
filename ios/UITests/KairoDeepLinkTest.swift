import XCTest

/// Verifies deep-link routing with local fixtures only.
final class KairoDeepLinkTest: XCTestCase {
    func testFocusDeepLink() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-kairoSkipOnboarding",
            "-kairoOfflineFixture",
        ]
        app.launch()

        XCTAssertTrue(
            app.tabBars.buttons["Focus"].waitForExistence(timeout: 10)
        )
        app.tabBars.buttons["Focus"].tap()
        XCTAssertTrue(app.buttons["Start focus"].waitForExistence(timeout: 8))
    }

    func testSyntheticAuthCallbackShowsVerificationThenSuccess() {
        let app = XCUIApplication()
        app.launchArguments += [
            "-kairoSkipOnboarding",
            "-kairoOfflineFixture",
            "-kairoAuthCallbackFixture",
            "success",
        ]
        app.launch()

        XCTAssertTrue(
            app.staticTexts["Finishing your sign-in"]
                .waitForExistence(timeout: 5)
        )
        XCTAssertTrue(
            app.tabBars.buttons["Today"].waitForExistence(timeout: 8)
        )
    }

    func testSyntheticAuthCallbackFailureReturnsToSignIn() {
        let app = XCUIApplication()
        app.launchArguments += [
            "-kairoSkipOnboarding",
            "-kairoAuthCallbackFixture",
            "failure",
        ]
        app.launch()

        XCTAssertTrue(
            app.staticTexts["Finishing your sign-in"]
                .waitForExistence(timeout: 5)
        )
        XCTAssertTrue(
            app.staticTexts[
                "This sign-in link has expired. Request a new link and try again."
            ].waitForExistence(timeout: 8)
        )
        XCTAssertTrue(app.textFields["you@example.com"].exists)
    }
}
