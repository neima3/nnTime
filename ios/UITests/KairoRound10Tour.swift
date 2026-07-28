import XCTest

/// Round-10 evidence: companion mode parity (T11 on iOS). The Body double
/// ritual switches the companion on; a running session shows the presence
/// card with the web's exact first line; Solo dismisses it. The session is
/// completed so the shared QA account never stays mid-focus.
final class KairoRound10Tour: XCTestCase {
    func testCompanionFlow() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-kairoSkipOnboarding"]
        app.launch()

        let email = app.textFields["you@example.com"]
        if email.waitForExistence(timeout: 6) {
            email.tap(); email.typeText("qa-polish-live@kairo.test")
            let pw = app.secureTextFields["Your password"]
            pw.tap(); pw.typeText("kairo-qa-live-2026!")
            app.buttons["Sign in"].tap()
        }

        XCTAssertTrue(app.tabBars.buttons["Focus"].waitForExistence(timeout: 20))
        app.tabBars.buttons["Focus"].tap()

        // A leftover active session from an aborted run hides the rituals —
        // finish it first so this tour is self-healing.
        let leftover = app.buttons["Complete session"].firstMatch
        if leftover.waitForExistence(timeout: 4) { leftover.tap(); sleep(3) }

        // The body-double ritual is the companion's front door. The chip's
        // accessible name concatenates its emoji, so match by containment.
        let ritual = app.buttons.matching(
            NSPredicate(format: "label CONTAINS %@", "Body double")
        ).firstMatch
        XCTAssertTrue(ritual.waitForExistence(timeout: 10), "no Body double ritual")
        ritual.tap()
        XCTAssertTrue(
            app.buttons["Companion on"].firstMatch.waitForExistence(timeout: 5),
            "ritual didn't switch the companion on"
        )
        snap(app, "100-companion-on-setup")

        app.buttons["Start focus"].firstMatch.tap()

        // The presence card, with the web's exact first line.
        let line = app.staticTexts["Working alongside you — no rush."]
        XCTAssertTrue(line.waitForExistence(timeout: 15), "no companion line in session")
        snap(app, "101-companion-card")

        // Solo sends it home.
        app.buttons["Solo — turn the companion off"].firstMatch.tap()
        XCTAssertFalse(line.waitForExistence(timeout: 3), "Solo didn't dismiss the card")

        // Leave the shared account clean: finish the session.
        app.buttons["Complete session"].firstMatch.tap()
        let done = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS %@", "min of real focus")
        ).firstMatch
        XCTAssertTrue(
            done.waitForExistence(timeout: 10)
                || app.buttons["Start focus"].firstMatch.waitForExistence(timeout: 10),
            "session didn't reach a finished state"
        )
    }

    private func snap(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }
}
