import XCTest

/// Round 89 evidence tour: the native editor finally asks which days an edit
/// lands on (ADR-001 / Track A item A2).
///
/// Before this, `EditorSheet.save()` and `deleteEditing()` carried no
/// `editScope` at all, so editing or deleting one day of a repeating activity
/// silently rewrote the whole series — the same bug the web editor lost in
/// Round 88. The fixture's 15:00 "Stretch" is the one repeating block, so it is
/// the only one that raises the prompt.
final class KairoRound89EditScopeTour: XCTestCase {

    private func launch(theme: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += [
            "-kairoSkipOnboarding", "-kairoOfflineFixture",
            "-kairoTodayFixture", "-kairoThemeFixture", theme,
        ]
        app.launch()
        return app
    }

    /// Open the repeating fixture block's editor.
    private func openRepeatingEditor(_ app: XCUIApplication) {
        XCTAssertTrue(app.staticTexts["Deep work block"].waitForExistence(timeout: 15))
        let stretch = app.staticTexts["Stretch"]
        var swipes = 0
        while !stretch.exists && swipes < 6 {
            app.swipeUp()
            swipes += 1
        }
        XCTAssertTrue(stretch.waitForExistence(timeout: 6))
        stretch.tap()
        XCTAssertTrue(app.staticTexts["Edit activity"].waitForExistence(timeout: 6))
    }

    func testSavingARepeatingOccurrenceAsksAndDefaultsToJustThisTime() throws {
        let app = launch(theme: "light")
        openRepeatingEditor(app)
        XCTAssertTrue(
            app.staticTexts["When you save, we’ll ask which days to change."]
                .waitForExistence(timeout: 6)
        )
        snap(app, "r89-editor-repeating")

        app.buttons["Save"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["This one repeats"].waitForExistence(timeout: 6))
        XCTAssertTrue(
            app.staticTexts["Which days should the change land on?"].exists
        )

        let justThisTime = row(app, "Just this time")
        let future = row(app, "This and every one after")
        let whole = row(app, "The whole series")
        XCTAssertTrue(justThisTime.waitForExistence(timeout: 6))
        XCTAssertTrue(future.exists)
        XCTAssertTrue(whole.exists)
        // The safe answer is the one already selected — never the whole series.
        XCTAssertTrue(justThisTime.isSelected)
        XCTAssertFalse(whole.isSelected)
        snap(app, "r89-scope-prompt-save-light")
    }

    func testDeletingARepeatingOccurrenceAsksWithDeleteWording() throws {
        let app = launch(theme: "light")
        openRepeatingEditor(app)

        let delete = app.buttons["Delete activity"]
        var swipes = 0
        while !delete.isHittable && swipes < 6 {
            app.swipeUp()
            swipes += 1
        }
        XCTAssertTrue(delete.waitForExistence(timeout: 6))
        delete.tap()

        XCTAssertTrue(app.staticTexts["This one repeats"].waitForExistence(timeout: 6))
        XCTAssertTrue(app.staticTexts["Which days should it come off?"].exists)
        XCTAssertTrue(row(app, "Just this time").isSelected)
        snap(app, "r89-scope-prompt-delete-light")
    }

    func testScopePromptInDarkTheme() throws {
        let app = launch(theme: "dark")
        openRepeatingEditor(app)
        app.buttons["Save"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["This one repeats"].waitForExistence(timeout: 6))
        XCTAssertTrue(row(app, "Just this time").isSelected)
        snap(app, "r89-scope-prompt-save-dark")
    }

    /// Rows combine their children, so the choice label is a substring of the
    /// button's accessibility label rather than the whole of it.
    private func row(_ app: XCUIApplication, _ label: String) -> XCUIElement {
        app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] %@", label)
        ).firstMatch
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
