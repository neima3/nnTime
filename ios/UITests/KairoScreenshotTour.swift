import XCTest

/// Captures full-screen attachments of each tab for design review.
final class KairoScreenshotTour: XCTestCase {
    func testTour() throws {
        let app = XCUIApplication()
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
        sleep(2)
        snap(app, "01-today")

        app.buttons["New activity"].tap()
        XCTAssertTrue(app.textFields["What are you doing?"].waitForExistence(timeout: 6))
        sleep(1)
        snap(app, "02-editor")
        app.buttons["Cancel"].tap()

        app.tabBars.buttons["Inbox"].tap()
        sleep(2)
        snap(app, "03-inbox")

        app.tabBars.buttons["Week"].tap()
        sleep(3)
        snap(app, "06-week")

        app.tabBars.buttons["Focus"].tap()
        sleep(2)
        snap(app, "04-focus")

        app.tabBars.buttons["More"].tap()
        sleep(2)
        snap(app, "05-more")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
