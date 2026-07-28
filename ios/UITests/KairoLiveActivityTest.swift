import XCTest

/// Starts a real focus session and captures the Dynamic Island /
/// lock-screen Live Activity from Springboard.
final class KairoLiveActivityTest: XCTestCase {
    func testFocusLiveActivity() throws {
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
        XCTAssertTrue(app.buttons["New activity"].waitForExistence(timeout: 20))

        let focusTab = app.tabBars.buttons["Focus"]
        XCTAssertTrue(focusTab.waitForExistence(timeout: 8))
        focusTab.tap()
        if !focusTab.waitForSelected(timeout: 3) {
            focusTab.tap()
        }
        XCTAssertTrue(focusTab.waitForSelected(timeout: 5), "Focus tab should be selected")

        // A previously interrupted run may leave the synthetic QA account in
        // an active session. Finish it through the product before this test
        // starts the session whose Live Activity it owns.
        let leftover = app.buttons["Complete session"].firstMatch
        if leftover.waitForExistence(timeout: 3) {
            leftover.tap()
            let doneForNow = app.buttons["Done for now"].firstMatch
            if doneForNow.waitForExistence(timeout: 8) {
                doneForNow.tap()
            }
        }

        let start = app.buttons["Start focus"].firstMatch
        XCTAssertTrue(start.waitForExistence(timeout: 10))
        start.tap()
        sleep(2)

        // Background the app — the island/banner should carry the timer.
        XCUIDevice.shared.press(.home)
        sleep(3)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let shot = XCTAttachment(screenshot: springboard.screenshot())
        shot.name = "07-live-activity"
        shot.lifetime = .keepAlways
        add(shot)

        // Clean up: back into the app, complete the session.
        app.activate()
        let complete = app.buttons["Complete session"].firstMatch
        if complete.waitForExistence(timeout: 8) {
            complete.tap()
        }
        XCTAssertTrue(app.buttons["Take a 5-min break"].waitForExistence(timeout: 10)
                      || app.buttons["Done for now"].waitForExistence(timeout: 4),
                      "session should complete")
    }
}

private extension XCUIElement {
    func waitForSelected(timeout: TimeInterval) -> Bool {
        let predicate = NSPredicate(format: "isSelected == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: self)
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }
}
