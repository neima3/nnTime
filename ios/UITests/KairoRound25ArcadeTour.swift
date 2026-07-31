import XCTest

/// Round 25 evidence tour: the sectioned 11-game arcade plus the two new
/// games (Odd One Out, Digit Span) on the offline fixture, light and dark.
final class KairoRound25ArcadeTour: XCTestCase {

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
        XCTAssertTrue(app.staticTexts["Quick Tap"].waitForExistence(timeout: 8))
    }

    private func openGame(_ app: XCUIApplication, _ title: String) {
        let card = app.staticTexts[title].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 6), title)
        var scrolls = 0
        while !card.isHittable && scrolls < 5 {
            app.swipeUp()
            scrolls += 1
        }
        XCTAssertTrue(card.isHittable, "\(title) card never became hittable")
        card.tap()
    }

    func testSectionedArcadeAndNewGamesLight() throws {
        let app = launch(theme: "light")
        openArcade(app)

        // All four section headers and all eleven cards exist. Headers are
        // combined accessibility elements, so match on the label prefix.
        for header in ["SHARP & FAST", "HOLD IT IN MIND", "WORDPLAY", "SLOW DOWN"] {
            let match = app.staticTexts.matching(
                NSPredicate(format: "label BEGINSWITH[c] %@", header)
            ).firstMatch
            XCTAssertTrue(match.waitForExistence(timeout: 5), header)
        }
        for title in ["Quick Tap", "Focus Finder", "Odd One Out", "Color Clash",
                      "Emoji Match", "Memory Trail", "Digit Span",
                      "Grammar Snap", "Spell Check", "Time Feel", "Steady Breath"] {
            XCTAssertTrue(app.staticTexts[title].firstMatch.waitForExistence(timeout: 5), title)
        }
        snap(app, "r25-arcade-top-light")
        app.swipeUp()
        snap(app, "r25-arcade-mid-light")

        // Odd One Out: start, first round renders with its live clock.
        app.swipeDown()
        openGame(app, "Odd One Out")
        XCTAssertTrue(app.buttons["Start spotting"].waitForExistence(timeout: 6))
        app.buttons["Start spotting"].tap()
        XCTAssertTrue(app.staticTexts["round 1 of 8"].waitForExistence(timeout: 6))
        snap(app, "r25-odd-one-out-light")
        app.buttons["Exit game"].tap()

        // Digit Span: digits flash, then the keypad accepts input.
        openGame(app, "Digit Span")
        XCTAssertTrue(app.buttons["Flash the digits"].waitForExistence(timeout: 6))
        app.buttons["Flash the digits"].tap()
        XCTAssertTrue(app.staticTexts["memorize — 3 digits"].waitForExistence(timeout: 6))
        snap(app, "r25-digit-span-show-light")
        XCTAssertTrue(app.staticTexts["your turn — 0 of 3"].waitForExistence(timeout: 8))
        app.buttons["1"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["your turn — 1 of 3"].waitForExistence(timeout: 4))
        snap(app, "r25-digit-span-typing-light")
        app.buttons["Exit game"].tap()
    }

    func testSectionedArcadeDark() throws {
        let app = launch(theme: "dark")
        openArcade(app)
        snap(app, "r25-arcade-top-dark")

        openGame(app, "Odd One Out")
        XCTAssertTrue(app.buttons["Start spotting"].waitForExistence(timeout: 6))
        app.buttons["Start spotting"].tap()
        XCTAssertTrue(app.staticTexts["round 1 of 8"].waitForExistence(timeout: 6))
        snap(app, "r25-odd-one-out-dark")
        app.buttons["Exit game"].tap()
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
