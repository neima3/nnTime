import Foundation
import XCTest
@testable import Kairo

/// H04 — the Live Activity's buttons dispatch through the shared bridge into
/// the app process. These pin the seam: intents produce the right actions,
/// and the remote-control policy never fires a redundant transition.
final class FocusIntentBridgeTests: XCTestCase {
    private actor Capture {
        private(set) var actions: [FocusIntentAction] = []
        func record(_ action: FocusIntentAction) {
            actions.append(action)
        }
    }

    func testToggleIntentDispatchesSetPaused() async throws {
        let capture = Capture()
        FocusIntentBridge.install { action in
            await capture.record(action)
        }

        _ = try await ToggleFocusIntent(
            sessionId: "session-1",
            shouldPause: true
        ).perform()

        let actions = await capture.actions
        XCTAssertEqual(
            actions,
            [.setPaused(sessionId: "session-1", paused: true)]
        )
    }

    func testCompleteIntentDispatchesComplete() async throws {
        let capture = Capture()
        FocusIntentBridge.install { action in
            await capture.record(action)
        }

        _ = try await CompleteFocusIntent(sessionId: "session-9").perform()

        let actions = await capture.actions
        XCTAssertEqual(actions, [.complete(sessionId: "session-9")])
    }

    func testRemoteCommandPolicy() {
        XCTAssertEqual(
            FocusRemoteControl.command(
                forState: "running",
                desiredPaused: true
            ),
            .transition(.paused)
        )
        XCTAssertEqual(
            FocusRemoteControl.command(
                forState: "paused",
                desiredPaused: false
            ),
            .transition(.running)
        )
        // Stale taps — the session is already where the button wanted it.
        XCTAssertNil(
            FocusRemoteControl.command(
                forState: "running",
                desiredPaused: false
            )
        )
        XCTAssertNil(
            FocusRemoteControl.command(
                forState: "paused",
                desiredPaused: true
            )
        )
        // Terminal states never transition from a Live Activity button.
        XCTAssertNil(
            FocusRemoteControl.command(
                forState: "completed",
                desiredPaused: true
            )
        )
    }
}
