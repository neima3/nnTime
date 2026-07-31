import XCTest

/// Round 26 evidence tour: the Green Light go/no-go game and the
/// post-session "Play a brain break" nudge, on deterministic fixtures.
final class KairoRound26ArcadeTour: XCTestCase {

    func testGreenLightRuns() throws {
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

        let card = app.staticTexts["Green Light"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 8))
        var scrolls = 0
        while !card.isHittable && scrolls < 5 {
            app.swipeUp()
            scrolls += 1
        }
        card.tap()
        XCTAssertTrue(app.buttons["Start the signals"].waitForExistence(timeout: 6))
        snap(app, "r26-green-light-intro")
        app.buttons["Start the signals"].tap()
        // A stimulus header appears once the signals start.
        XCTAssertTrue(app.staticTexts["1 of 24"].waitForExistence(timeout: 6))
        snap(app, "r26-green-light-running")
        app.buttons["Exit game"].tap()
    }

    func testFocusDoneOffersBrainBreak() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-kairoSkipOnboarding", "-kairoOfflineFixture",
            "-kairoFocusDoneFixture", "-kairoThemeFixture", "light",
        ]
        app.launch()
        app.tabBars.buttons["Focus"].tap()
        XCTAssertTrue(app.staticTexts["That counted. What now?"].waitForExistence(timeout: 10))
        snap(app, "r26-focus-done-menu")
        app.buttons["Play a brain break"].tap()
        // The arcade sheet opens without leaving Focus.
        XCTAssertTrue(app.staticTexts["Green Light"].firstMatch.waitForExistence(timeout: 8))
        snap(app, "r26-focus-brain-break-sheet")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
