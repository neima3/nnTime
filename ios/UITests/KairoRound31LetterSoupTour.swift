import XCTest

/// Round 31 evidence tour: Letter Soup renders its slots and tiles, and the
/// shame-free "Show me" reveals the word and advances without credit.
final class KairoRound31LetterSoupTour: XCTestCase {

    func testShowMeRevealsAndAdvances() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-kairoSkipOnboarding", "-kairoOfflineFixture",
            "-kairoThemeFixture", "light",
        ]
        app.launch()
        app.tabBars.buttons["More"].tap()
        let entry = app.staticTexts["Brain breaks"].firstMatch
        XCTAssertTrue(entry.waitForExistence(timeout: 10))
        entry.tap()

        let card = app.staticTexts["Letter Soup"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 8))
        var scrolls = 0
        while !card.isHittable && scrolls < 6 {
            app.swipeUp()
            scrolls += 1
        }
        card.tap()
        XCTAssertTrue(app.buttons["Stir the soup"].waitForExistence(timeout: 6))
        app.buttons["Stir the soup"].tap()
        XCTAssertTrue(app.staticTexts["word 1 of 8 · 0 solved"].waitForExistence(timeout: 6))
        snap(app, "r31-letter-soup-round")

        app.buttons["Show me"].tap()
        snap(app, "r31-letter-soup-revealed")
        XCTAssertTrue(app.staticTexts["word 2 of 8 · 0 solved"].waitForExistence(timeout: 6))
        app.buttons["Exit game"].tap()
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
