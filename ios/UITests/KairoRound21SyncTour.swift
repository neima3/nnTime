import XCTest

final class KairoRound21SyncTour: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testCachedTodayKeepsSafeCompletionOperable() throws {
        let app = launch(fixture: "today", reset: true)

        let pendingNotice = app.staticTexts["Saved on this iPhone"]
        XCTAssertTrue(pendingNotice.waitForExistence(timeout: 12))
        XCTAssertTrue(app.staticTexts["Morning focus"].exists)

        let alreadyPending = app.buttons["Mark Morning focus not done"]
        XCTAssertTrue(alreadyPending.exists)
        XCTAssertFalse(
            alreadyPending.isEnabled,
            "A durable pending status must not submit twice"
        )

        XCTAssertFalse(app.buttons["New activity"].exists)
        XCTAssertFalse(app.buttons["Review today"].exists)
        XCTAssertFalse(app.buttons["Pick for me"].exists)
        XCTAssertFalse(app.buttons["Browse templates"].exists)
        XCTAssertFalse(app.buttons["Focus on this"].exists)
        XCTAssertFalse(app.buttons["Delete activity"].exists)

        let cachedActivity = app.descendants(matching: .any)
            .matching(
                NSPredicate(
                    format: "label BEGINSWITH %@",
                    "Gentle planning,"
                )
            )
            .firstMatch
        XCTAssertTrue(cachedActivity.waitForExistence(timeout: 5))
        let originalFrame = cachedActivity.frame

        cachedActivity.tap()
        XCTAssertFalse(
            app.navigationBars["Edit activity"]
                .waitForExistence(timeout: 1),
            "A cached activity must not open the editor"
        )

        let dragStart = cachedActivity.coordinate(
            withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)
        )
        let dragEnd = cachedActivity.coordinate(
            withNormalizedOffset: CGVector(dx: 0.5, dy: 1.2)
        )
        dragStart.press(forDuration: 0.5, thenDragTo: dragEnd)
        XCTAssertEqual(
            cachedActivity.frame,
            originalFrame,
            "A cached activity must not move while offline"
        )
        XCTAssertFalse(app.navigationBars["Templates"].exists)
        XCTAssertFalse(app.navigationBars["Focus"].exists)

        let safeCompletion = app.buttons["Complete Gentle planning"]
        XCTAssertTrue(safeCompletion.waitForExistence(timeout: 5))
        XCTAssertTrue(safeCompletion.isEnabled)
        assertInsideWindow(safeCompletion, app: app)
        safeCompletion.tap()

        let locallyCompleted = app.buttons[
            "Mark Gentle planning not done"
        ]
        XCTAssertTrue(locallyCompleted.waitForExistence(timeout: 5))
        XCTAssertFalse(
            locallyCompleted.isEnabled,
            "The newly queued status should become visibly pending"
        )
        saveScreenshot(app, name: "today-light-pending-completion")
    }

    func testPendingInboxCaptureSurvivesRelaunch() throws {
        var app = launch(fixture: "inbox", reset: true)
        openInbox(app)

        let pending = app.staticTexts[
            "Pack a calm lunch. Pending sync. Saved on this iPhone."
        ]
        XCTAssertTrue(pending.waitForExistence(timeout: 12))
        XCTAssertTrue(app.staticTexts["Saved locally"].exists)
        saveScreenshot(app, name: "inbox-pending-before-relaunch")

        app.terminate()
        app = launch(fixture: "inbox", reset: false)
        openInbox(app)

        let restored = app.staticTexts[
            "Pack a calm lunch. Pending sync. Saved on this iPhone."
        ]
        XCTAssertTrue(
            restored.waitForExistence(timeout: 12),
            "The protected pending Inbox row must survive termination"
        )
        assertInsideWindow(restored, app: app)
        saveScreenshot(app, name: "inbox-pending-after-relaunch")
    }

    func testConflictRetryDismissAndNavigationStayReachable() throws {
        let app = launch(fixture: "conflicts", reset: true)
        openInbox(app)

        XCTAssertTrue(
            app.staticTexts["Sync conflict 1 of 3"]
                .waitForExistence(timeout: 12)
        )
        let retry = app.buttons["Retry syncing Inbox capture"]
        let dismiss = app.buttons["Dismiss Inbox capture conflict"]
        let next = app.buttons["Next sync conflict"]
        XCTAssertTrue(retry.isHittable)
        XCTAssertTrue(dismiss.isHittable)
        XCTAssertTrue(next.isHittable)
        assertMinimumTarget(retry)
        assertMinimumTarget(dismiss)
        assertMinimumTarget(next)

        retry.tap()
        let retryFailure = app.staticTexts[
            "Retry failed. Couldn’t retry this change. Your recovery copy is still saved here."
        ]
        XCTAssertTrue(retryFailure.waitForExistence(timeout: 8))
        XCTAssertTrue(
            retry.waitForEnabled(timeout: 5),
            "Retry must remain available after a transient failure"
        )

        next.tap()
        XCTAssertTrue(
            app.staticTexts["Sync conflict 2 of 3"]
                .waitForExistence(timeout: 3)
        )
        XCTAssertFalse(
            app.buttons["Retry syncing Inbox capture"].exists,
            "A legacy conflict must remain dismiss-only"
        )

        let legacyDismiss =
            app.buttons["Dismiss Inbox capture conflict"]
        XCTAssertTrue(legacyDismiss.isHittable)
        legacyDismiss.tap()

        XCTAssertTrue(
            app.staticTexts["Sync conflict 2 of 2"]
                .waitForExistence(timeout: 5)
        )
        XCTAssertTrue(
            app.buttons["Retry syncing Inbox capture"].isHittable,
            "The next durable retryable conflict should remain reachable"
        )
        saveScreenshot(app, name: "conflicts-retry-dismiss-carousel")
    }

    func testDarkCompactStateFitsPortraitWidth() throws {
        let app = launch(
            fixture: "today",
            reset: true,
            theme: "dark"
        )

        let completion = app.buttons["Complete Gentle planning"]
        XCTAssertTrue(completion.waitForExistence(timeout: 12))
        assertPortraitWidth(app)
        assertInsideWindow(completion, app: app)
        assertInsideWindow(
            app.staticTexts["Saved on this iPhone"],
            app: app
        )
        saveScreenshot(app, name: "today-dark-portrait")
    }

    func testAccessibilityXXXLConflictActionsDoNotClip() throws {
        let app = launch(
            fixture: "conflicts",
            reset: true,
            accessibilityXXXL: true,
            reducedStimulation: true
        )
        openInbox(app)

        let retry = app.buttons["Retry syncing Inbox capture"]
        let dismiss = app.buttons["Dismiss Inbox capture conflict"]
        let composer = app.textFields["Get it out of your head…"]
        XCTAssertTrue(retry.waitForExistence(timeout: 12))
        XCTAssertTrue(retry.isHittable)
        XCTAssertTrue(dismiss.isHittable)
        XCTAssertTrue(composer.isHittable)
        XCTAssertGreaterThanOrEqual(
            composer.frame.minY,
            max(retry.frame.maxY, dismiss.frame.maxY),
            "The conflict notice must reserve space above the Inbox composer"
        )
        assertPortraitWidth(app)
        assertMinimumTarget(retry)
        assertMinimumTarget(dismiss)
        assertInsideWindow(retry, app: app)
        assertInsideWindow(dismiss, app: app)
        saveScreenshot(app, name: "conflicts-accessibility-xxxl")
    }

    func testExact390LightDarkAndXXXLStates() throws {
        var app = launch(fixture: "today", reset: true)
        let measuredWidth = app.windows.firstMatch.frame.width
        guard abs(measuredWidth - 390) < 0.5 else {
            app.terminate()
            throw XCTSkip(
                "Exact 390-point evidence runs on the iPhone 14 fixture; current width is \(measuredWidth)."
            )
        }

        var completion = app.buttons["Complete Gentle planning"]
        XCTAssertTrue(completion.waitForExistence(timeout: 12))
        assertInsideWindow(completion, app: app)
        saveScreenshot(app, name: "exact-390-today-light")

        app.terminate()
        app = launch(
            fixture: "today",
            reset: true,
            theme: "dark"
        )
        XCTAssertEqual(
            app.windows.firstMatch.frame.width,
            390,
            accuracy: 0.5
        )
        completion = app.buttons["Complete Gentle planning"]
        XCTAssertTrue(completion.waitForExistence(timeout: 12))
        assertInsideWindow(completion, app: app)
        saveScreenshot(app, name: "exact-390-today-dark")

        app.terminate()
        app = launch(
            fixture: "conflicts",
            reset: true,
            accessibilityXXXL: true,
            reducedStimulation: true
        )
        XCTAssertEqual(
            app.windows.firstMatch.frame.width,
            390,
            accuracy: 0.5
        )
        openInbox(app)
        let retry = app.buttons["Retry syncing Inbox capture"]
        let dismiss = app.buttons["Dismiss Inbox capture conflict"]
        XCTAssertTrue(retry.waitForExistence(timeout: 12))
        assertInsideWindow(retry, app: app)
        assertInsideWindow(dismiss, app: app)
        saveScreenshot(app, name: "exact-390-conflicts-xxxl")
    }

    private func launch(
        fixture: String,
        reset: Bool,
        theme: String = "light",
        accessibilityXXXL: Bool = false,
        reducedStimulation: Bool = false
    ) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["KAIRO_BASE_URL"] =
            "http://127.0.0.1:1"
        app.launchArguments = [
            "-kairoSkipOnboarding",
            "-kairoRound21SyncFixture",
            fixture,
            "-kairoThemeFixture",
            theme,
        ]
        if reset {
            app.launchArguments.append("-kairoRound21ResetFixture")
        }
        if theme == "dark" {
            app.launchArguments += ["-AppleInterfaceStyle", "Dark"]
        }
        if accessibilityXXXL {
            app.launchArguments += [
                "-UIPreferredContentSizeCategoryName",
                "UICTContentSizeCategoryAccessibilityExtraExtraExtraLarge",
            ]
        }
        if reducedStimulation {
            app.launchArguments.append(
                "-kairoRound21ReducedStimulation"
            )
        }
        app.launch()
        return app
    }

    private func openInbox(_ app: XCUIApplication) {
        let inbox = app.tabBars.buttons["Inbox"]
        XCTAssertTrue(inbox.waitForExistence(timeout: 12))
        inbox.tap()
        XCTAssertTrue(
            app.textFields["Get it out of your head…"]
                .waitForExistence(timeout: 8)
        )
    }

    private func assertPortraitWidth(
        _ app: XCUIApplication,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let width = app.windows.firstMatch.frame.width
        XCTAssertGreaterThanOrEqual(width, 390, file: file, line: line)
        XCTAssertLessThanOrEqual(width, 410, file: file, line: line)
    }

    private func assertMinimumTarget(
        _ element: XCUIElement,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertGreaterThanOrEqual(
            element.frame.width,
            44,
            file: file,
            line: line
        )
        XCTAssertGreaterThanOrEqual(
            element.frame.height,
            44,
            file: file,
            line: line
        )
    }

    private func assertInsideWindow(
        _ element: XCUIElement,
        app: XCUIApplication,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let window = app.windows.firstMatch.frame.insetBy(dx: -1, dy: -1)
        XCTAssertTrue(
            window.contains(element.frame),
            "\(element) frame \(element.frame) clipped by \(window)",
            file: file,
            line: line
        )
    }

    private func saveScreenshot(
        _ app: XCUIApplication,
        name: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)

        guard
            let outputPath = ProcessInfo.processInfo.environment[
                "KAIRO_UI_EVIDENCE_DIR"
            ]
        else {
            return
        }
        let directory = URL(fileURLWithPath: outputPath)
        do {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true
            )
            try screenshot.pngRepresentation.write(
                to: directory.appendingPathComponent("\(name).png"),
                options: .atomic
            )
        } catch {
            XCTFail(
                "Could not save \(name) evidence: \(error)",
                file: file,
                line: line
            )
        }
    }
}

private extension XCUIElement {
    func waitForEnabled(timeout: TimeInterval) -> Bool {
        let predicate = NSPredicate(format: "isEnabled == true")
        return XCTWaiter.wait(
            for: [
                XCTNSPredicateExpectation(
                    predicate: predicate,
                    object: self
                ),
            ],
            timeout: timeout
        ) == .completed
    }
}
