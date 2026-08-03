import XCTest

/// Round 78 evidence tour: Proof It renders its word chips, a tap resolves
/// the round with the corrected sentence + kind feedback, and the game exits
/// cleanly.
final class KairoRound78ProofItTour: XCTestCase {

    func testTapResolvesARoundWithFeedback() throws {
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

        let card = app.staticTexts["Proof It"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 8))
        var scrolls = 0
        while !card.isHittable && scrolls < 6 {
            app.swipeUp()
            scrolls += 1
        }
        card.tap()

        let header = app.staticTexts["1 of 8"].firstMatch
        XCTAssertTrue(header.waitForExistence(timeout: 6))
        snap(app, "r78-proof-it-round")

        // The draw is random here, so tap the first word chip — either
        // outcome must resolve into feedback with a Next button.
        let exit = app.buttons["Exit game"].firstMatch
        let chips = app.buttons.matching(
            NSPredicate(format: "label != %@ AND label != %@", "", "Exit game")
        )
        XCTAssertGreaterThanOrEqual(chips.count, 5)
        chips.element(boundBy: 1).tap()
        let next = app.buttons["Next one"].firstMatch
        XCTAssertTrue(next.waitForExistence(timeout: 6))
        snap(app, "r78-proof-it-feedback")

        next.tap()
        XCTAssertTrue(app.staticTexts["2 of 8"].waitForExistence(timeout: 6))
        XCTAssertTrue(exit.isHittable)
        exit.tap()
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
