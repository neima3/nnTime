import XCTest

final class KairoRound20AuthTour: XCTestCase {
    func testPasswordOnlyCapabilityFixture() {
        let app = launch(capabilities: "password")

        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Sign in with Apple"].exists)
        XCTAssertFalse(app.buttons["Email me a sign-in link"].exists)
        attachScreenshot(app, name: "password-only")
    }

    func testAllMethodsFixture() {
        let app = launch(capabilities: "all")

        XCTAssertTrue(
            app.buttons["Sign in with Apple"].waitForExistence(timeout: 5)
        )
        XCTAssertTrue(app.buttons["Email me a sign-in link"].exists)
        attachScreenshot(app, name: "all-methods")
    }

    func testAppleLoadingAndErrorFixtures() {
        var app = launch(
            capabilities: "all",
            state: "appleLoading"
        )
        XCTAssertTrue(
            app.staticTexts["Signing in securely with Apple…"]
                .waitForExistence(timeout: 5)
        )
        attachScreenshot(app, name: "apple-loading")

        app.terminate()
        app = launch(
            capabilities: "all",
            state: "appleError"
        )
        XCTAssertTrue(
            app.staticTexts[
                "Apple sign-in couldn’t be completed. Please try again."
            ].waitForExistence(timeout: 5)
        )
        attachScreenshot(app, name: "apple-error")
    }

    func testAppleCancellationIsSilent() {
        let app = launch(
            capabilities: "all",
            state: "appleCancelled"
        )

        XCTAssertTrue(
            app.buttons["Sign in with Apple"].waitForExistence(timeout: 5)
        )
        XCTAssertFalse(app.staticTexts["Couldn’t sign in"].exists)
        attachScreenshot(app, name: "apple-cancelled")
    }

    func testMagicSentFixture() {
        let app = launch(
            capabilities: "all",
            state: "magicSent"
        )

        XCTAssertTrue(
            app.staticTexts["Check your email"]
                .waitForExistence(timeout: 5)
        )
        XCTAssertTrue(
            app.staticTexts[
                "We sent a secure sign-in link to planner@example.test. You can close this screen after opening it."
            ].exists
        )
        attachScreenshot(app, name: "magic-sent")
    }

    func testDarkMode() {
        let app = launch(
            capabilities: "all",
            theme: "dark",
            extraArguments: [
                "-AppleInterfaceStyle",
                "Dark",
            ]
        )

        XCTAssertTrue(
            app.buttons["Sign in with Apple"].waitForExistence(timeout: 5)
        )
        attachScreenshot(app, name: "dark")
    }

    func testTopOfScrollableAuthLayout() {
        let app = launch(capabilities: "all")

        XCTAssertTrue(
            app.staticTexts["Welcome back"].waitForExistence(timeout: 5)
        )
        attachScreenshot(app, name: "scrollable-auth-top")
    }

    func testConnectedAccountReadyFixture() {
        let app = launchSettings(appleState: "ready")
        let control = app.buttons["Connect Apple account"]
        reveal(control, in: app)

        XCTAssertTrue(control.exists)
        XCTAssertTrue(
            app.staticTexts[
                "Connect Apple only after signing in. Kairo keeps your current planner and never merges accounts silently."
            ].exists
        )
        attachScreenshot(app, name: "apple-link-ready")
    }

    func testConnectedAccountLinkedAndExpiredFixtures() {
        var app = launchSettings(appleState: "linked")
        let linked = app.staticTexts["Apple is connected"]
        reveal(linked, in: app)
        XCTAssertTrue(linked.exists)
        attachScreenshot(app, name: "apple-link-linked")

        app.terminate()
        app = launchSettings(appleState: "expired")
        let retry = app.buttons["Try Apple connection again"]
        reveal(retry, in: app)
        XCTAssertTrue(retry.exists)
        XCTAssertTrue(
            app.staticTexts[
                "This Apple connection request expired. Try again."
            ].exists
        )
        attachScreenshot(app, name: "apple-link-expired")
    }

    private func launch(
        capabilities: String,
        state: String? = nil,
        theme: String = "light",
        extraArguments: [String] = []
    ) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += [
            "-AppleInterfaceStyle",
            "Light",
            "-kairoSkipOnboarding",
            "-kairoSignedOutFixture",
            "-kairoThemeFixture",
            theme,
            "-kairoAuthCapabilitiesFixture",
            capabilities,
        ]
        if let state {
            app.launchArguments += [
                "-kairoAuthStateFixture",
                state,
            ]
        }
        app.launchArguments += extraArguments
        app.launch()
        return app
    }

    private func attachScreenshot(
        _ app: XCUIApplication,
        name: String
    ) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func launchSettings(
        appleState: String
    ) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += [
            "-AppleInterfaceStyle",
            "Light",
            "-kairoSkipOnboarding",
            "-kairoOfflineFixture",
            "-kairoThemeFixture",
            "light",
            "-kairoAppleLinkFixture",
            appleState,
        ]
        app.launch()
        XCTAssertTrue(
            app.tabBars.buttons["More"].waitForExistence(timeout: 8)
        )
        app.tabBars.buttons["More"].tap()
        XCTAssertTrue(
            app.staticTexts["Settings"].waitForExistence(timeout: 5)
        )
        app.staticTexts["Settings"].tap()
        return app
    }

    private func reveal(
        _ element: XCUIElement,
        in app: XCUIApplication
    ) {
        for _ in 0 ..< 6 {
            app.swipeUp()
        }
        _ = element.waitForExistence(timeout: 3)
    }
}
