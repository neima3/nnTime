import XCTest

/// Round 24 evidence tour: the 9-game brain-breaks arcade on the offline
/// fixture account. Captures the full card list plus the three new games
/// (Focus Finder, Memory Trail, Color Clash) and a quiz question, in light
/// and dark themes. Deterministic — no server, no real account.
final class KairoRound24ArcadeTour: XCTestCase {

    private func launch(theme: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += [
            "-kairoSkipOnboarding",
            "-kairoOfflineFixture",
            "-kairoThemeFixture", theme,
        ]
        app.launch()
        return app
    }

    private func openArcade(_ app: XCUIApplication) {
        app.tabBars.buttons["More"].tap()
        let entry = app.staticTexts["Brain breaks"].firstMatch
        XCTAssertTrue(entry.waitForExistence(timeout: 10))
        entry.tap()
        XCTAssertTrue(app.staticTexts["Time Feel"].waitForExistence(timeout: 8))
    }

    /// Tap a game card, scrolling the arcade list until it is on screen.
    private func openGame(_ app: XCUIApplication, _ title: String) {
        let card = app.staticTexts[title].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 6), title)
        var scrolls = 0
        while !card.isHittable && scrolls < 4 {
            app.swipeUp()
            scrolls += 1
        }
        XCTAssertTrue(card.isHittable, "\(title) card never became hittable")
        card.tap()
    }

    func testArcadeTourLight() throws {
        let app = launch(theme: "light")
        openArcade(app)
        snap(app, "arcade-top-light")

        // All nine cards exist.
        for title in ["Time Feel", "Quick Tap", "Emoji Match", "Grammar Snap", "Spell Check",
                      "Focus Finder", "Memory Trail", "Color Clash", "Steady Breath"] {
            XCTAssertTrue(app.staticTexts[title].firstMatch.waitForExistence(timeout: 5), title)
        }
        app.swipeUp()
        snap(app, "arcade-bottom-light")

        // Focus Finder: start, find "1", confirm the target advances.
        openGame(app, "Focus Finder")
        XCTAssertTrue(app.buttons["Start the hunt"].waitForExistence(timeout: 6))
        app.buttons["Start the hunt"].tap()
        XCTAssertTrue(app.staticTexts["find 1"].waitForExistence(timeout: 6))
        snap(app, "focus-finder-grid-light")
        app.buttons["1"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["find 2"].waitForExistence(timeout: 4))
        app.buttons["Exit game"].tap()

        // Memory Trail: start, wait through playback to the repeat phase.
        openGame(app, "Memory Trail")
        XCTAssertTrue(app.buttons["Show me the trail"].waitForExistence(timeout: 6))
        app.buttons["Show me the trail"].tap()
        XCTAssertTrue(app.staticTexts["your turn — 0 of 3"].waitForExistence(timeout: 10))
        snap(app, "memory-trail-repeat-light")
        app.buttons["Exit game"].tap()

        // Color Clash: start, answer one round.
        openGame(app, "Color Clash")
        XCTAssertTrue(app.buttons["Bring the clash"].waitForExistence(timeout: 6))
        app.buttons["Bring the clash"].tap()
        XCTAssertTrue(app.staticTexts["round 1 of 12 · 0 right"].waitForExistence(timeout: 6))
        snap(app, "color-clash-round-light")
        app.buttons["Pink"].firstMatch.tap()
        snap(app, "color-clash-verdict-light")
        app.buttons["Exit game"].tap()

        // Grammar Snap: a fresh question renders with its round header.
        app.swipeDown()
        openGame(app, "Grammar Snap")
        XCTAssertTrue(app.staticTexts["1 of 8"].waitForExistence(timeout: 8))
        snap(app, "grammar-snap-question-light")
        app.buttons["Exit game"].tap()
    }

    func testArcadeTourDark() throws {
        let app = launch(theme: "dark")
        openArcade(app)
        snap(app, "arcade-top-dark")
        app.swipeUp()
        snap(app, "arcade-bottom-dark")

        app.swipeDown()
        openGame(app, "Color Clash")
        XCTAssertTrue(app.buttons["Bring the clash"].waitForExistence(timeout: 6))
        app.buttons["Bring the clash"].tap()
        XCTAssertTrue(app.staticTexts["round 1 of 12 · 0 right"].waitForExistence(timeout: 6))
        snap(app, "color-clash-round-dark")
        app.buttons["Exit game"].tap()

        app.swipeDown()
        openGame(app, "Focus Finder")
        XCTAssertTrue(app.buttons["Start the hunt"].waitForExistence(timeout: 6))
        app.buttons["Start the hunt"].tap()
        XCTAssertTrue(app.staticTexts["find 1"].waitForExistence(timeout: 6))
        snap(app, "focus-finder-grid-dark")
        app.buttons["Exit game"].tap()
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
