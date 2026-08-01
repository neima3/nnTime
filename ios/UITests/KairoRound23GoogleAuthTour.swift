import XCTest
import UIKit

final class KairoRound23GoogleAuthTour: XCTestCase {
    func testGoogleUnavailableAndReadyFixtures() {
        var app = launchSignIn(capabilities: "password")
        XCTAssertTrue(app.buttons["Sign in"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Sign in with Google"].exists)
        capture(app, name: "google-unavailable")

        app.terminate()
        app = launchSignIn(capabilities: "google")
        let google = app.buttons["Sign in with Google"]
        XCTAssertTrue(google.waitForExistence(timeout: 5))
        XCTAssertGreaterThanOrEqual(google.frame.height, 44)
        XCTAssertGreaterThanOrEqual(google.frame.width, 44)
        assertLightGoogleLogo(google)
        capture(app, name: "google-ready-light")
    }

    func testGoogleLoadingErrorAndCancellationFixtures() {
        var app = launchSignIn(
            capabilities: "google",
            state: "googleLoading"
        )
        XCTAssertTrue(
            app.staticTexts["Signing in securely with Google…"]
                .waitForExistence(timeout: 5)
        )
        XCTAssertFalse(app.buttons["Sign in with Google"].isEnabled)
        capture(app, name: "google-loading")

        app.terminate()
        app = launchSignIn(
            capabilities: "google",
            state: "googleError"
        )
        XCTAssertTrue(
            app.staticTexts[
                "Google authentication couldn't be completed. Try again."
            ].waitForExistence(timeout: 5)
        )
        capture(app, name: "google-error")

        app.terminate()
        app = launchSignIn(
            capabilities: "google",
            state: "googleCancelled"
        )
        XCTAssertTrue(
            app.buttons["Sign in with Google"].waitForExistence(timeout: 5)
        )
        XCTAssertFalse(app.staticTexts["Couldn’t sign in"].exists)
    }

    func testGoogleDuplicateSuccessAndDarkFixtures() {
        var app = launchSignIn(
            capabilities: "google",
            state: "googleDuplicate"
        )
        XCTAssertTrue(
            app.staticTexts["Use your existing sign-in"]
                .waitForExistence(timeout: 5)
        )
        XCTAssertTrue(
            app.staticTexts[
                "Sign in with your email first, then connect Google or Apple in Settings."
            ].exists
        )
        capture(app, name: "google-duplicate-account")

        app.terminate()
        app = launchSignIn(
            capabilities: "google",
            state: "googleSuccess"
        )
        XCTAssertTrue(
            app.staticTexts["Planner secured"].waitForExistence(timeout: 5)
        )
        capture(app, name: "google-success")

        app.terminate()
        app = launchSignIn(
            capabilities: "google",
            theme: "dark",
            extraArguments: ["-AppleInterfaceStyle", "Dark"]
        )
        let google = app.buttons["Sign in with Google"]
        XCTAssertTrue(google.waitForExistence(timeout: 5))
        XCTAssertEqual(google.label, "Sign in with Google")
        assertDarkGoogleBranding(google)
        capture(app, name: "google-ready-dark")
    }

    func testGoogleLinkReadyLinkingAndLinkedFixtures() {
        var app = launchSettings(googleState: "ready")
        let control = app.buttons["Connect Google account"]
        reveal(control, in: app)
        XCTAssertTrue(control.exists)
        XCTAssertGreaterThanOrEqual(control.frame.height, 44)
        XCTAssertTrue(
            app.staticTexts[
                "Kairo keeps this planner and never merges accounts silently."
            ].exists
        )
        capture(app, name: "google-link-ready")

        app.terminate()
        app = launchSettings(googleState: "linking")
        let linking = app.staticTexts["Connecting Google securely…"]
        reveal(linking, in: app)
        XCTAssertTrue(linking.exists)
        capture(app, name: "google-linking")

        app.terminate()
        app = launchSettings(googleState: "linked")
        let linked = app.staticTexts["Google is connected"]
        reveal(linked, in: app)
        XCTAssertTrue(linked.exists)
        capture(app, name: "google-link-linked")
    }

    private func launchSignIn(
        capabilities: String,
        state: String? = nil,
        theme: String = "light",
        extraArguments: [String] = []
    ) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += [
            "-AppleInterfaceStyle",
            "Light",
            "-kairoSkipOnboarding",
            "-kairoSignedOutFixture",
            "-kairoThemeFixture",
            theme,
            "-kairoAuthCapabilitiesFixture",
            capabilities,
        ]
        if let state {
            app.launchArguments += ["-kairoAuthStateFixture", state]
        }
        app.launchArguments += extraArguments
        app.launch()
        return app
    }

    private func launchSettings(
        googleState: String
    ) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += [
            "-AppleInterfaceStyle",
            "Light",
            "-kairoSkipOnboarding",
            "-kairoOfflineFixture",
            "-kairoThemeFixture",
            "light",
            "-kairoAppleLinkFixture",
            "unavailable",
            "-kairoGoogleLinkFixture",
            googleState,
        ]
        app.launch()
        XCTAssertTrue(
            app.tabBars.buttons["More"].waitForExistence(timeout: 8)
        )
        app.tabBars.buttons["More"].tap()
        XCTAssertTrue(
            app.staticTexts["Settings"].waitForExistence(timeout: 5)
        )
        app.staticTexts["Settings"].tap()
        return app
    }

    private func reveal(
        _ element: XCUIElement,
        in app: XCUIApplication
    ) {
        for _ in 0 ..< 7 where !element.isHittable {
            app.swipeUp()
        }
        _ = element.waitForExistence(timeout: 3)
        XCTAssertTrue(element.isHittable)
    }

    private func capture(
        _ app: XCUIApplication,
        name: String
    ) {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)

        guard let root = ProcessInfo.processInfo.environment[
            "KAIRO_QA_EVIDENCE_DIR"
        ] else {
            return
        }
        let directory = URL(fileURLWithPath: root, isDirectory: true)
        try? FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        try? screenshot.pngRepresentation.write(
            to: directory.appendingPathComponent("\(name).png")
        )
    }

    private func assertDarkGoogleBranding(
        _ element: XCUIElement,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        guard
            let image = UIImage(
                data: element.screenshot().pngRepresentation
            )?.cgImage,
            let data = image.dataProvider?.data,
            let bytes = CFDataGetBytePtr(data)
        else {
            XCTFail(
                "Could not inspect Google button pixels",
                file: file,
                line: line
            )
            return
        }

        var googleBluePixels = 0
        var inspectedPixels = 0
        for y in stride(from: 0, to: image.height, by: 4) {
            for x in stride(from: 0, to: image.width, by: 4) {
                let offset = y * image.bytesPerRow + x * 4
                let red = Int(bytes[offset])
                let green = Int(bytes[offset + 1])
                let blue = Int(bytes[offset + 2])
                if blue > green + 40, green > red + 20 {
                    googleBluePixels += 1
                }
                inspectedPixels += 1
            }
        }

        XCTAssertGreaterThan(
            Double(googleBluePixels) / Double(inspectedPixels),
            0.35,
            "Dark mode must render Google's official blue button, not a blank white surface.",
            file: file,
            line: line
        )
    }

    private func assertLightGoogleLogo(
        _ element: XCUIElement,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        guard
            let image = UIImage(
                data: element.screenshot().pngRepresentation
            )?.cgImage,
            let data = image.dataProvider?.data,
            let bytes = CFDataGetBytePtr(data)
        else {
            XCTFail(
                "Could not inspect Google button pixels",
                file: file,
                line: line
            )
            return
        }

        var red = 0
        var green = 0
        var blue = 0
        var yellow = 0
        for y in stride(from: 0, to: image.height, by: 2) {
            for x in stride(from: 0, to: image.width, by: 2) {
                let offset = y * image.bytesPerRow + x * 4
                let r = Int(bytes[offset])
                let g = Int(bytes[offset + 1])
                let b = Int(bytes[offset + 2])
                if r > 180, g < 140, b < 140 { red += 1 }
                if g > 100, r < 150, b < 160 { green += 1 }
                if b > 150, g > 70, r < 150 { blue += 1 }
                if r > 180, g > 130, b < 120 { yellow += 1 }
            }
        }

        for (count, color) in [
            (red, "red"),
            (green, "green"),
            (blue, "blue"),
            (yellow, "yellow"),
        ] {
            XCTAssertGreaterThan(
                count,
                3,
                "Official Google logo is missing its \(color) segment.",
                file: file,
                line: line
            )
        }
    }
}
