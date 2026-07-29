import Foundation
import XCTest
@testable import Kairo

@MainActor
final class NativeAuthCoordinatorTests: XCTestCase {
    func testAcceptedCallbackVerifiesThenBootstrapsSignedInState() async {
        let coordinator = NativeAuthCoordinator()
        let recorder = CoordinatorRecorder()

        let outcome = await coordinator.handle(
            URL(string: "kairo://auth?token=valid-token")!,
            currentScope: nil,
            redeem: { token in
                XCTAssertEqual(coordinator.phase, .verifying)
                await recorder.append("redeem:\(token)")
                return .init(scope: "scope-a", replacedScope: nil)
            },
            prepareForAccountSwitch: { _ in
                await recorder.append("purge")
            },
            bootstrap: {
                await recorder.append("bootstrap")
            }
        )

        let values = await recorder.values
        XCTAssertEqual(outcome, .completed)
        XCTAssertEqual(coordinator.phase, .idle)
        XCTAssertEqual(
            values,
            ["redeem:valid-token", "bootstrap"]
        )
    }

    func testAccountSwitchPurgesBeforeBootstrap() async {
        let coordinator = NativeAuthCoordinator()
        let recorder = CoordinatorRecorder()

        let outcome = await coordinator.handle(
            URL(string: "kairo://auth?token=switch-token")!,
            currentScope: "scope-a",
            redeem: { _ in
                await recorder.append("redeem")
                return .init(
                    scope: "scope-b",
                    replacedScope: "scope-a"
                )
            },
            prepareForAccountSwitch: { scope in
                await recorder.append("purge:\(scope)")
            },
            bootstrap: {
                await recorder.append("bootstrap")
            }
        )

        let values = await recorder.values
        XCTAssertEqual(outcome, .completed)
        XCTAssertEqual(
            values,
            ["redeem", "purge:scope-b", "bootstrap"]
        )
    }

    func testInvalidURLIsIgnored() async {
        let coordinator = NativeAuthCoordinator()
        let recorder = CoordinatorRecorder()

        let outcome = await coordinator.handle(
            URL(string: "https://evil.example/auth/callback?token=abc")!,
            currentScope: nil,
            redeem: { _ in
                await recorder.append("redeem")
                return .init(scope: "scope-a", replacedScope: nil)
            },
            prepareForAccountSwitch: { _ in
                await recorder.append("purge")
            },
            bootstrap: {
                await recorder.append("bootstrap")
            }
        )

        let values = await recorder.values
        XCTAssertEqual(outcome, .ignored)
        XCTAssertEqual(values, [])
    }

    func testCompletedCallbackIsRejectedWhenDeliveredAgain() async {
        let coordinator = NativeAuthCoordinator()
        let recorder = CoordinatorRecorder()
        let url = URL(string: "kairo://auth?token=duplicate-token")!

        let first = await coordinator.handle(
            url,
            currentScope: nil,
            redeem: { _ in
                await recorder.append("redeem")
                return .init(scope: "scope-a", replacedScope: nil)
            },
            prepareForAccountSwitch: { _ in },
            bootstrap: {}
        )
        let second = await coordinator.handle(
            url,
            currentScope: nil,
            redeem: { _ in
                await recorder.append("duplicate-redeem")
                return .init(scope: "scope-a", replacedScope: nil)
            },
            prepareForAccountSwitch: { _ in },
            bootstrap: {}
        )

        let values = await recorder.values
        XCTAssertEqual(first, .completed)
        XCTAssertEqual(second, .duplicate)
        XCTAssertEqual(values, ["redeem"])
    }

    func testFailureReturnsActionableSignedOutPresentation() async {
        let coordinator = NativeAuthCoordinator()

        let outcome = await coordinator.handle(
            URL(string: "kairo://auth?token=expired-token")!,
            currentScope: nil,
            redeem: { _ in
                throw APIError.authHTTP(400, "This link has expired.")
            },
            prepareForAccountSwitch: { _ in },
            bootstrap: {}
        )

        XCTAssertEqual(outcome, .failed)
        XCTAssertEqual(
            coordinator.phase,
            .failed("This link has expired.")
        )
    }

    func testSignedInCallbackCannotReplaceAccountWithoutPurge() async {
        let coordinator = NativeAuthCoordinator()
        let recorder = CoordinatorRecorder()

        _ = await coordinator.handle(
            URL(string: "kairo://auth?token=other-account")!,
            currentScope: "scope-a",
            redeem: { _ in
                await recorder.append("redeem")
                return .init(scope: "scope-b", replacedScope: nil)
            },
            prepareForAccountSwitch: { scope in
                await recorder.append("purge:\(scope)")
            },
            bootstrap: {
                await recorder.append("bootstrap")
            }
        )

        let values = await recorder.values
        XCTAssertEqual(
            values,
            ["redeem", "purge:scope-b", "bootstrap"]
        )
    }
}

private actor CoordinatorRecorder {
    private(set) var values: [String] = []

    func append(_ value: String) {
        values.append(value)
    }
}
