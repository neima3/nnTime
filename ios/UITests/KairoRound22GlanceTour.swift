import XCTest

final class KairoRound22GlanceTour: XCTestCase {
    func testRealWidgetAndLiveActivitySurfaces() {
        let app = XCUIApplication()
        app.launchArguments += [
            "-kairoSkipOnboarding",
            "-kairoRound22GlanceFixture",
            "h24",
            "-kairoRound22StartLiveActivity",
        ]
        app.launchEnvironment["KAIRO_ROUND22_GLANCE_FIXTURE"] = "1"
        app.launchEnvironment["KAIRO_ROUND22_HOUR_CYCLE"] = "h24"
        app.launchEnvironment["KAIRO_ROUND22_START_LIVE_ACTIVITY"] = "1"
        app.launch()
        app.open(URL(string: "kairo://round22-glance-fixture")!)

        guard app.tabBars.buttons["Today"].waitForExistence(timeout: 12)
        else {
            XCTFail("The synthetic glance fixture should reach Today")
            return
        }
        attach(app, named: "01-glance-fixture")

        XCUIDevice.shared.press(.home)
        let springboard = XCUIApplication(
            bundleIdentifier: "com.apple.springboard"
        )
        XCTAssertTrue(
            springboard.wait(for: .runningForeground, timeout: 8)
        )
        attach(springboard, named: "02-live-activity-compact")

        let island = springboard.coordinate(
            withNormalizedOffset: CGVector(dx: 0.5, dy: 0.04)
        )
        island.press(forDuration: 1.0)
        attach(springboard, named: "03-live-activity-expanded")
        springboard.coordinate(
            withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)
        ).tap()

        enterWidgetGallery(springboard)
        let search = springboard.searchFields.firstMatch
        guard search.waitForExistence(timeout: 8) else {
            XCTFail("The system widget gallery should expose search")
            return
        }
        search.tap()
        search.typeText("Kairo")

        let kairo = springboard.cells["Kairo"].firstMatch
        XCTAssertTrue(
            kairo.waitForExistence(timeout: 10),
            "Kairo should be discoverable in the system widget gallery"
        )
        kairo.tap()
        attach(springboard, named: "04-widget-family-first")

        springboard.swipeLeft()
        let mediumPreview = springboard.buttons.matching(
            NSPredicate(format: "value CONTAINS[c] %@", "Medium")
        ).firstMatch
        XCTAssertTrue(
            mediumPreview.waitForExistence(timeout: 8),
            "The gallery should settle on the medium Kairo family"
        )
        attach(springboard, named: "05-widget-family-second")

        let addWidget = springboard.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "Add Widget")
        ).firstMatch
        XCTAssertTrue(
            addWidget.waitForExistence(timeout: 8),
            "The selected Kairo family should be installable"
        )
        addWidget.tap()
        attach(springboard, named: "06-widget-installed")

        let installedWidget = springboard.icons.matching(
            NSPredicate(
                format: "identifier == %@ AND value == %@",
                "Kairo",
                "Widget"
            )
        ).firstMatch
        XCTAssertTrue(
            installedWidget.waitForExistence(timeout: 12),
            "The selected Kairo family should exist on the Home Screen"
        )
        XCTAssertGreaterThan(
            installedWidget.frame.width,
            300,
            "The installed Kairo widget should use the medium family"
        )
        springboard.buttons["Done"].tap()
        springboard.icons.matching(
            NSPredicate(
                format: "identifier == %@ AND value == %@",
                "Kairo",
                "Widget"
            )
        ).firstMatch.tap()
        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 8),
            "Tapping the real widget should deep-link back into Kairo"
        )
        XCTAssertTrue(app.tabBars.buttons["Today"].isSelected)
        attach(app, named: "07-widget-deep-link")
    }

    private func enterWidgetGallery(_ springboard: XCUIApplication) {
        let openSpace = springboard.coordinate(
            withNormalizedOffset: CGVector(dx: 0.84, dy: 0.72)
        )
        openSpace.press(forDuration: 1.4)

        let edit = springboard.buttons["Edit"].firstMatch
        if edit.waitForExistence(timeout: 5) {
            edit.tap()
            let addWidget = springboard.buttons["Add Widget"].firstMatch
            if addWidget.waitForExistence(timeout: 5) {
                addWidget.tap()
                return
            }
        }

        let labelledAdd = springboard.descendants(
            matching: .any
        ).matching(
            NSPredicate(format: "label CONTAINS[c] %@", "Add Widget")
        ).firstMatch
        if labelledAdd.waitForExistence(timeout: 3) {
            labelledAdd.tap()
            return
        }

        springboard.coordinate(
            withNormalizedOffset: CGVector(dx: 0.07, dy: 0.05)
        ).tap()
    }

    private func attach(_ app: XCUIApplication, named name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
