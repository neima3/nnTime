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
                return true
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
                return true
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
                return true
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
            prepareForAccountSwitch: { _ in true },
            bootstrap: {}
        )
        let second = await coordinator.handle(
            url,
            currentScope: nil,
            redeem: { _ in
                await recorder.append("duplicate-redeem")
                return .init(scope: "scope-a", replacedScope: nil)
            },
            prepareForAccountSwitch: { _ in true },
            bootstrap: {}
        )

        let values = await recorder.values
        XCTAssertEqual(first, .completed)
        XCTAssertEqual(second, .duplicate)
        XCTAssertEqual(values, ["redeem"])
    }

    func testCompletedDuplicateDoesNotRunPreRedeemFreeze() async {
        let coordinator = NativeAuthCoordinator()
        let recorder = CoordinatorRecorder()
        let url = URL(string: "kairo://auth?token=completed-duplicate")!

        _ = await coordinator.handle(
            url,
            currentScope: nil,
            prepareForAuthentication: {
                await recorder.append("freeze")
            },
            redeem: { _ in
                await recorder.append("redeem")
                return .init(scope: "scope-a", replacedScope: nil)
            },
            prepareForAccountSwitch: { _ in true },
            bootstrap: {}
        )
        let duplicate = await coordinator.handle(
            url,
            currentScope: nil,
            prepareForAuthentication: {
                await recorder.append("duplicate-freeze")
            },
            redeem: { _ in
                await recorder.append("duplicate-redeem")
                return .init(scope: "scope-a", replacedScope: nil)
            },
            prepareForAccountSwitch: { _ in true },
            bootstrap: {}
        )

        let values = await recorder.values
        XCTAssertEqual(duplicate, .duplicate)
        XCTAssertEqual(values, ["freeze", "redeem"])
    }

    func testDistinctCallbackDuringActiveTransitionIsBusyWithoutFreezeOrRedeem() async {
        let coordinator = NativeAuthCoordinator()
        let recorder = CoordinatorRecorder()
        let gate = AuthCallbackGate()

        let first = Task { @MainActor in
            await coordinator.handle(
                URL(string: "kairo://auth?token=first-token")!,
                currentScope: nil,
                prepareForAuthentication: {
                    await recorder.append("first-freeze")
                    await gate.enter()
                },
                redeem: { _ in
                    await recorder.append("first-redeem")
                    return .init(scope: "scope-a", replacedScope: nil)
                },
                prepareForAccountSwitch: { _ in true },
                bootstrap: {}
            )
        }
        await gate.waitUntilEntered()

        let second = await coordinator.handle(
            URL(string: "kairo://auth?token=second-token")!,
            currentScope: nil,
            prepareForAuthentication: {
                await recorder.append("second-freeze")
            },
            redeem: { _ in
                await recorder.append("second-redeem")
                return .init(scope: "scope-b", replacedScope: nil)
            },
            prepareForAccountSwitch: { _ in true },
            bootstrap: {}
        )

        let valuesBeforeRelease = await recorder.values
        XCTAssertEqual(second, .busy)
        XCTAssertEqual(valuesBeforeRelease, ["first-freeze"])
        await gate.release()
        let firstOutcome = await first.value
        XCTAssertEqual(firstOutcome, .completed)
    }

    func testFailureReturnsActionableSignedOutPresentation() async {
        let coordinator = NativeAuthCoordinator()

        let outcome = await coordinator.handle(
            URL(string: "kairo://auth?token=expired-token")!,
            currentScope: nil,
            redeem: { _ in
                throw APIError.authHTTP(400, "This link has expired.")
            },
            prepareForAccountSwitch: { _ in true },
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
                return true
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

    func testAccountSwitchPreparationFailureDoesNotBootstrapNewScope() async {
        let coordinator = NativeAuthCoordinator()
        let recorder = CoordinatorRecorder()

        let outcome = await coordinator.handle(
            URL(string: "kairo://auth?token=storage-failure")!,
            currentScope: "scope-a",
            redeem: { _ in
                await recorder.append("redeem")
                return .init(scope: "scope-b", replacedScope: "scope-a")
            },
            prepareForAccountSwitch: { scope in
                await recorder.append("purge:\(scope)")
                return false
            },
            bootstrap: {
                await recorder.append("bootstrap")
            }
        )

        let values = await recorder.values
        XCTAssertEqual(outcome, .blocked)
        XCTAssertEqual(coordinator.phase, .idle)
        XCTAssertEqual(values, ["redeem", "purge:scope-b"])
    }
}

private actor CoordinatorRecorder {
    private(set) var values: [String] = []

    func append(_ value: String) {
        values.append(value)
    }
}

private actor AuthCallbackGate {
    private var entered = false
    private var enteredWaiters: [CheckedContinuation<Void, Never>] = []
    private var continuation: CheckedContinuation<Void, Never>?

    func enter() async {
        entered = true
        let waiters = enteredWaiters
        enteredWaiters.removeAll()
        waiters.forEach { $0.resume() }
        await withCheckedContinuation { continuation = $0 }
    }

    func waitUntilEntered() async {
        if entered { return }
        await withCheckedContinuation { enteredWaiters.append($0) }
    }

    func release() {
        continuation?.resume()
        continuation = nil
    }
}
