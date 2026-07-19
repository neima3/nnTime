import XCTest

/// End-to-end flight against the live API with the prod QA account:
/// sign in → Today loads → create an activity → complete it → visit tabs.
final class KairoFlowUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testSignInCreateCompleteFlow() throws {
        let app = XCUIApplication()
        app.launch()

        // Sign in (skipped if a session already exists).
        let email = app.textFields["you@example.com"]
        if email.waitForExistence(timeout: 8) {
            email.tap()
            email.typeText("qa-polish-live@kairo.test")
            let password = app.secureTextFields["Your password"]
            password.tap()
            password.typeText("kairo-qa-live-2026!")
            app.buttons["Sign in"].tap()
        }

        // Today loads with the add FAB.
        let fab = app.buttons["Add activity"]
        XCTAssertTrue(fab.waitForExistence(timeout: 20), "Today should show after sign-in")

        // Create an activity via the editor sheet.
        fab.tap()
        let titleField = app.textFields["What are you doing?"]
        XCTAssertTrue(titleField.waitForExistence(timeout: 8))
        titleField.tap()
        titleField.typeText("iOS flight check")
        app.buttons["Save"].tap()

        // The new block appears on the timeline.
        let block = app.staticTexts["iOS flight check"]
        XCTAssertTrue(block.waitForExistence(timeout: 15), "created block should render")

        // Complete it.
        let complete = app.buttons["Complete iOS flight check"]
        XCTAssertTrue(complete.waitForExistence(timeout: 8))
        complete.tap()
        let undo = app.buttons["Mark iOS flight check incomplete"]
        XCTAssertTrue(undo.waitForExistence(timeout: 10), "block should flip to done")

        // Tabs all render.
        app.tabBars.buttons["Inbox"].tap()
        XCTAssertTrue(app.textFields["Get it out of your head…"].waitForExistence(timeout: 8), "Inbox composer should render")
        app.tabBars.buttons["Focus"].tap()
        XCTAssertTrue(app.buttons["Start focus"].waitForExistence(timeout: 8))
        app.tabBars.buttons["More"].tap()
        XCTAssertTrue(app.staticTexts["Planning timezone"].waitForExistence(timeout: 8), "More rows should render")
    }
}
