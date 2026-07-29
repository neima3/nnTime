import XCTest

final class KairoRound19OfflineTour: XCTestCase {
    func testScopedCachedTodayIsExplicitlyReadOnly() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-kairoSkipOnboarding",
            "-kairoOfflineFixture",
        ]
        app.launch()

        XCTAssertTrue(
            app.staticTexts["Saved day · read-only"]
                .waitForExistence(timeout: 12)
        )
        XCTAssertTrue(
            app.staticTexts["Protected focus block"].exists
        )
        XCTAssertFalse(app.buttons["New activity"].exists)
        XCTAssertFalse(
            app.buttons["Complete Protected focus block"].exists
        )

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "round19-offline-read-only-today"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
