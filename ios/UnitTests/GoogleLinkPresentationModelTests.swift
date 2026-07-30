import Foundation
import XCTest
@testable import Kairo

@MainActor
final class GoogleLinkPresentationModelTests: XCTestCase {
    func testAvailabilityIsFailClosed() async {
        let model = GoogleLinkPresentationModel()

        XCTAssertEqual(model.state, .loadingAvailability)
        XCTAssertFalse(model.showsControl)

        await model.loadConnection(
            capabilities: {
                .init(magicLink: true, apple: true, google: false)
            },
            isLinked: {
                XCTFail("Unavailable Google must not query account state")
                return true
            }
        )

        XCTAssertEqual(model.state, .unavailable)
        XCTAssertFalse(model.showsControl)
    }

    func testAvailableProviderBecomesReady() async {
        let model = GoogleLinkPresentationModel()

        await model.loadConnection(
            capabilities: {
                .init(magicLink: true, apple: true, google: true)
            },
            isLinked: { false }
        )

        XCTAssertEqual(model.state, .ready)
        XCTAssertTrue(model.showsControl)
    }

    func testServerLinkedAccountHydratesAsLinkedOnEveryLoad() async {
        let model = GoogleLinkPresentationModel()
        var reads = 0

        for _ in 0 ..< 2 {
            await model.loadConnection(
                capabilities: {
                    .init(magicLink: false, apple: false, google: true)
                },
                isLinked: {
                    reads += 1
                    return true
                }
            )
            XCTAssertEqual(model.state, .linked)
        }

        XCTAssertEqual(reads, 2)
        XCTAssertTrue(model.showsControl)
    }

    func testAccountReadFailureIsActionableAndNeverClaimsLinked() async {
        let model = GoogleLinkPresentationModel()

        await model.loadConnection(
            capabilities: {
                .init(magicLink: false, apple: false, google: true)
            },
            isLinked: {
                throw APIError.network(URLError(.notConnectedToInternet))
            }
        )

        XCTAssertNotEqual(model.state, .linked)
        XCTAssertTrue(model.canRetry)
        XCTAssertEqual(
            model.errorMessage,
            "Couldn't verify your Google connection. Try again."
        )
    }

    func testUnauthorizedAccountReadRequiresSession() async {
        let model = GoogleLinkPresentationModel()

        await model.loadConnection(
            capabilities: {
                .init(magicLink: false, apple: false, google: true)
            },
            isLinked: {
                throw APIError.authUnauthorized(nil)
            }
        )

        XCTAssertEqual(model.state, .sessionRequired)
        XCTAssertNotEqual(model.state, .linked)
    }

    func testLinkPreservesTheCurrentPlannerScope() async {
        let model = GoogleLinkPresentationModel()
        await model.loadConnection(
            capabilities: {
                .init(magicLink: false, apple: false, google: true)
            },
            isLinked: { false }
        )
        var observedLinking = false

        let scope = await model.link(currentScope: "planner-a") {
            observedLinking = model.state == .linking
        }

        XCTAssertTrue(observedLinking)
        XCTAssertEqual(scope, "planner-a")
        XCTAssertEqual(model.state, .linked)
    }

    func testLinkCancellationReturnsToReadyWithoutError() async {
        let model = readyModel()

        let scope = await model.link(currentScope: "planner-a") {
            throw CancellationError()
        }

        XCTAssertNil(scope)
        XCTAssertEqual(model.state, .ready)
        XCTAssertNil(model.errorMessage)
    }

    func testLinkRequiresAnExistingSession() async {
        let model = readyModel()

        let scope = await model.link(currentScope: nil) {}

        XCTAssertNil(scope)
        XCTAssertEqual(model.state, .sessionRequired)
        XCTAssertEqual(model.errorMessage, "Please sign in again.")
    }

    func testLinkFailureKeepsActionableRetryState() async {
        let model = readyModel()

        let scope = await model.link(currentScope: "planner-a") {
            throw APIError.socialAuth(400, .providerFailure)
        }

        XCTAssertNil(scope)
        XCTAssertTrue(model.canRetry)
        XCTAssertEqual(
            model.errorMessage,
            "Google authentication couldn't be completed. Try again."
        )
        model.retry()
        XCTAssertEqual(model.state, .ready)
    }

    func testAlreadyLinkedReturnsCurrentScopeWithoutRepeatingRequest() async {
        let model = readyModel()
        _ = await model.link(currentScope: "planner-a") {}
        var repeated = false

        let scope = await model.link(currentScope: "planner-a") {
            repeated = true
        }

        XCTAssertFalse(repeated)
        XCTAssertEqual(scope, "planner-a")
        XCTAssertEqual(model.state, .linked)
    }

    private func readyModel() -> GoogleLinkPresentationModel {
        let model = GoogleLinkPresentationModel()
#if DEBUG
        model.installFixture(state: .ready)
#endif
        return model
    }
}
