import XCTest

/// Round-7 evidence: iOS Search / quick-jump (H3).
///
/// Reaches Search from the Today toolbar, types a query, and captures the result
/// list. Runs against whatever API the scheme points at (live by default,
/// KAIRO_BASE_URL for a local server), so the assertions are about the screen
/// working — a matched result or the honest "nothing matched" state — rather than
/// about specific planner content in that account.
final class KairoRound7Tour: XCTestCase {
    func testSearchQuickJump() throws {
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

        XCTAssertTrue(app.tabBars.buttons["Today"].waitForExistence(timeout: 20))
        app.tabBars.buttons["Today"].tap()

        // Quick-jump lives in the Today toolbar.
        let searchButton = app.buttons["Search"]
        XCTAssertTrue(searchButton.waitForExistence(timeout: 10), "no Search button on Today")
        searchButton.tap()

        let field = app.textFields["Search your planner"]
        XCTAssertTrue(field.waitForExistence(timeout: 10), "search field missing")
        snap(app, "80-search-idle")

        field.tap()
        field.typeText("a")
        // Debounce is 280ms; give the request room on a cold simulator.
        sleep(4)
        snap(app, "81-search-results")

        // Either results or the empty state — both are the screen working. A
        // failed request shows the connection message, which is a real failure.
        let failed = app.staticTexts["Couldn't reach your planner"].exists
        XCTAssertFalse(failed, "search request failed against the API")

        // Clearing returns to the idle prompt.
        if app.buttons["Clear search"].exists {
            app.buttons["Clear search"].tap()
            XCTAssertTrue(
                app.staticTexts["Find anything you've planned"].waitForExistence(timeout: 5),
                "clearing search did not return to the idle state")
        }
        snap(app, "82-search-cleared")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }
}
