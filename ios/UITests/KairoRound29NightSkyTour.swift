import XCTest

/// Round 29 evidence tour: trace a full Night Sky constellation to its
/// gentle completion state, whatever sky the night picks.
final class KairoRound29NightSkyTour: XCTestCase {

    func testTraceASkyToCompletion() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-kairoSkipOnboarding", "-kairoOfflineFixture",
            "-kairoThemeFixture", "dark",
        ]
        app.launch()
        app.tabBars.buttons["More"].tap()
        let entry = app.staticTexts["Brain breaks"].firstMatch
        XCTAssertTrue(entry.waitForExistence(timeout: 10))
        entry.tap()

        let card = app.staticTexts["Night Sky"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 8))
        var scrolls = 0
        while !card.isHittable && scrolls < 6 {
            app.swipeUp()
            scrolls += 1
        }
        card.tap()
        XCTAssertTrue(app.buttons["Look up"].waitForExistence(timeout: 6))
        app.buttons["Look up"].tap()

        // Tap "Star N, next" until the sky completes (max 7 points).
        for step in 1...7 {
            let star = app.buttons["Star \(step), next"]
            guard star.waitForExistence(timeout: 4) else { break }
            if step == 3 { snap(app, "r29-night-sky-tracing") }
            star.tap()
        }
        let complete = app.staticTexts
            .matching(NSPredicate(format: "label CONTAINS %@", ", complete"))
            .firstMatch
        XCTAssertTrue(complete.waitForExistence(timeout: 6))
        snap(app, "r29-night-sky-complete")
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
