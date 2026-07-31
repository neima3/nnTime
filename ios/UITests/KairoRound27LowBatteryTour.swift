import XCTest

/// Round 27 evidence tour: the low-battery day toggle on a deterministic
/// mutable Today fixture — dimmed heavy block, softened note, persistence
/// across relaunch, and a clean off state at the end.
final class KairoRound27LowBatteryTour: XCTestCase {

    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += [
            "-kairoSkipOnboarding", "-kairoOfflineFixture",
            "-kairoTodayFixture", "-kairoThemeFixture", "light",
        ]
        app.launch()
        return app
    }

    func testDailyBriefShowsAndDismissesForTheDay() throws {
        let app = launch()
        XCTAssertTrue(app.staticTexts["Deep work block"].waitForExistence(timeout: 10))
        // Fixture pins a 9am hour: the brief greets and summarizes the day.
        let brief = app.staticTexts
            .matching(NSPredicate(format: "label BEGINSWITH %@", "Good morning. 3 things on today."))
            .firstMatch
        XCTAssertTrue(brief.waitForExistence(timeout: 6))
        XCTAssertTrue(
            app.staticTexts
                .matching(NSPredicate(format: "label BEGINSWITH %@", "First up · 🧠 Deep work block"))
                .firstMatch.exists)
        snap(app, "r28-daily-brief")
        app.buttons["Dismiss brief for today"].tap()
        XCTAssertFalse(brief.exists)
        snap(app, "r28-daily-brief-dismissed")
    }

    func testLowBatteryDayToggleDimsAndPersists() throws {
        var app = launch()
        XCTAssertTrue(app.staticTexts["Deep work block"].waitForExistence(timeout: 10))

        let chip = app.buttons["Low-battery day"]
        XCTAssertTrue(chip.waitForExistence(timeout: 6))
        XCTAssertEqual(chip.value as? String, "off")
        snap(app, "r27-today-normal")

        chip.tap()
        XCTAssertTrue(
            app.staticTexts["Low-battery day — heavy things are dimmed. Doing less on purpose still counts as a plan."]
                .waitForExistence(timeout: 6))
        XCTAssertTrue(heavyBlock(app).waitForExistence(timeout: 6))
        snap(app, "r27-today-low-battery")

        // Device-local per-date persistence survives a relaunch.
        app.terminate()
        app = launch()
        XCTAssertTrue(app.staticTexts["Deep work block"].waitForExistence(timeout: 10))
        XCTAssertTrue(heavyBlock(app).waitForExistence(timeout: 6))
        snap(app, "r27-today-low-battery-relaunch")

        // Leave the shared simulator clean: toggle back off.
        let chipAgain = app.buttons["Low-battery day"]
        XCTAssertTrue(chipAgain.waitForExistence(timeout: 6))
        chipAgain.tap()
        XCTAssertFalse(heavyBlock(app).exists)
    }

    /// The combined block element announces heaviness in its label.
    private func heavyBlock(_ app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(
            NSPredicate(format: "label CONTAINS[c] %@", "heavy for a low-battery day")
        ).firstMatch
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
