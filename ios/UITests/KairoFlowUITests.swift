import XCTest

/// End-to-end flight against the live API with the prod QA account:
/// sign in → Today loads → create an activity → complete it → visit tabs.
final class KairoFlowUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testSignInCreateCompleteFlow() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-kairoSkipOnboarding"]
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
        let fab = app.buttons["New activity"]
        XCTAssertTrue(fab.waitForExistence(timeout: 20), "Today should show after sign-in")

        // Create an activity via the editor sheet.
        fab.tap()
        let titleField = app.textFields["What are you doing?"]
        XCTAssertTrue(titleField.waitForExistence(timeout: 8))
        titleField.tap()
        titleField.typeText("iOS flight check")
        app.buttons["Save"].tap()

        // The new block appears on the timeline.
        let block = app.staticTexts["iOS flight check"].firstMatch
        XCTAssertTrue(block.waitForExistence(timeout: 15), "created block should render")

        // Tap opens the editor prefilled; cancel out.
        block.tap()
        let editTitle = app.textFields["What are you doing?"]
        XCTAssertTrue(editTitle.waitForExistence(timeout: 6), "tap should open the editor")
        XCTAssertEqual(editTitle.value as? String, "iOS flight check", "editor should be prefilled")
        app.buttons["Cancel"].tap()
        XCTAssertTrue(block.waitForExistence(timeout: 6))

        // Complete it.
        let complete = app.buttons["Complete iOS flight check"].firstMatch
        XCTAssertTrue(complete.waitForExistence(timeout: 8))
        complete.tap()
        let undo = app.buttons["Mark iOS flight check incomplete"].firstMatch
        XCTAssertTrue(undo.waitForExistence(timeout: 10), "block should flip to done")

        // Drag-to-reschedule: long-press lift then pull down; label's time changes.
        let cardQuery = app.descendants(matching: .any).matching(
            NSPredicate(format: "label BEGINSWITH %@", "iOS flight check,")
        ).firstMatch
        XCTAssertTrue(cardQuery.waitForExistence(timeout: 6))
        let labelBefore = cardQuery.label
        let from = cardQuery.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.5))
        let to = from.withOffset(CGVector(dx: 0, dy: 102)) // ≈ +60 min at 1.7pt/min
        from.press(forDuration: 0.7, thenDragTo: to)
        sleep(3)
        let labelAfter = app.descendants(matching: .any).matching(
            NSPredicate(format: "label BEGINSWITH %@", "iOS flight check,")
        ).firstMatch.label
        XCTAssertNotEqual(labelBefore, labelAfter, "drag should reschedule the block")

        // Clean up through the product itself: edit sheet → delete.
        // Loop handles leftovers from any earlier aborted runs too.
        var deletions = 0
        while app.staticTexts["iOS flight check"].firstMatch.waitForExistence(timeout: 4), deletions < 5 {
            app.staticTexts["iOS flight check"].firstMatch.tap()
            let delete = app.buttons["Delete activity"]
            XCTAssertTrue(delete.waitForExistence(timeout: 6), "edit sheet should offer delete")
            delete.tap()
            deletions += 1
            sleep(2)
        }
        XCTAssertGreaterThan(deletions, 0, "should have deleted the created block")
        XCTAssertTrue(app.staticTexts["iOS flight check"].firstMatch.waitForNonExistence(timeout: 8), "timeline should be clean")

        // Tabs all render.
        app.tabBars.buttons["Inbox"].tap()
        XCTAssertTrue(app.textFields["Get it out of your head…"].waitForExistence(timeout: 8), "Inbox composer should render")
        app.tabBars.buttons["Week"].tap()
        XCTAssertTrue(app.staticTexts["TODAY"].waitForExistence(timeout: 12), "Week should mark today")
        app.tabBars.buttons["Focus"].tap()
        XCTAssertTrue(app.buttons["Start focus"].waitForExistence(timeout: 8))
        app.tabBars.buttons["More"].tap()
        XCTAssertTrue(app.staticTexts["Planning timezone"].waitForExistence(timeout: 8), "More rows should render")
    }
}
