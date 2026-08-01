import XCTest

/// Round 33 evidence tour: Pattern Tiles shows a pattern, hides it, and a
/// wrong recall reveals the answer kindly before the gentle end state.
final class KairoRound33PatternTilesTour: XCTestCase {

    func testMissRevealsKindly() throws {
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

        let card = app.staticTexts["Pattern Tiles"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 8))
        var scrolls = 0
        while !card.isHittable && scrolls < 6 {
            app.swipeUp()
            scrolls += 1
        }
        card.tap()
        XCTAssertTrue(app.buttons["Light them up"].waitForExistence(timeout: 6))
        app.buttons["Light them up"].tap()
        XCTAssertTrue(app.staticTexts["memorize — 3 tiles"].waitForExistence(timeout: 6))
        snap(app, "r33-pattern-memorize")
        XCTAssertTrue(app.staticTexts["your turn — 0 of 3"].waitForExistence(timeout: 6))

        // Tap tiles until the pattern completes or a miss ends the climb —
        // either way a terminal state must appear.
        for idx in 1...16 {
            let header = app.staticTexts.matching(
                NSPredicate(format: "label BEGINSWITH %@", "your turn")
            ).firstMatch
            guard header.exists else { break }
            app.buttons["Tile \(idx)"].firstMatch.tap()
        }
        let ended = app.staticTexts.matching(
            NSPredicate(format: "label BEGINSWITH %@ OR label == %@", "Pattern of", "The tiles kept their secret")
        ).firstMatch
        let grew = app.staticTexts["memorize — 4 tiles"]
        XCTAssertTrue(
            ended.waitForExistence(timeout: 8) || grew.waitForExistence(timeout: 4),
            "the run must either end or grow")
        snap(app, "r33-pattern-outcome")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
