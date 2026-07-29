import Foundation
import XCTest
@testable import Kairo

@MainActor
final class AppleLinkPresentationTests: XCTestCase {
    func testControlIsHiddenWhenAppleIsUnavailable() async {
        let model = AppleLinkPresentationModel()

        await model.loadAvailability {
            .init(magicLink: true, apple: false)
        }

        XCTAssertFalse(model.showsControl)
        XCTAssertEqual(model.state, .unavailable)
    }

    func testLinkRequiresCurrentSession() async {
        let model = AppleLinkPresentationModel()
        var performed = false

        let scope = await model.link(currentScope: nil) {
            performed = true
        }

        XCTAssertNil(scope)
        XCTAssertFalse(performed)
        XCTAssertEqual(model.state, .sessionRequired)
    }

    func testSuccessPreservesPlannerScope() async {
        let model = AppleLinkPresentationModel()

        let scope = await model.link(currentScope: "scope-a") {}

        XCTAssertEqual(scope, "scope-a")
        XCTAssertEqual(model.state, .linked)
    }

    func testExpiredChallengeOffersRetry() async {
        let model = AppleLinkPresentationModel()

        let scope = await model.link(currentScope: "scope-a") {
            throw APIError.http(
                400,
                .init(
                    code: "expired_challenge",
                    message: "This request expired.",
                    retryable: false,
                    details: nil
                )
            )
        }

        XCTAssertNil(scope)
        XCTAssertEqual(model.state, .expired)
        XCTAssertTrue(model.canRetry)
    }

    func testCancellationIsSilent() async {
        let model = AppleLinkPresentationModel()

        let scope = await model.link(currentScope: "scope-a") {
            throw CancellationError()
        }

        XCTAssertNil(scope)
        XCTAssertEqual(model.state, .ready)
        XCTAssertNil(model.errorMessage)
    }

    func testAlreadyLinkedResponseIsStableSuccess() async {
        let model = AppleLinkPresentationModel()
        var secondLinkRan = false

        _ = await model.link(currentScope: "scope-a") {}
        let scope = await model.link(currentScope: "scope-a") {
            secondLinkRan = true
        }

        XCTAssertEqual(scope, "scope-a")
        XCTAssertFalse(secondLinkRan)
        XCTAssertEqual(model.state, .linked)
    }

    func testUnauthorizedUsesSignInAgainMessage() async {
        let model = AppleLinkPresentationModel()

        let scope = await model.link(currentScope: "scope-a") {
            throw APIError.unauthorized(
                401,
                .init(
                    code: "unauthorized",
                    message: "",
                    retryable: false,
                    details: nil
                )
            )
        }

        XCTAssertNil(scope)
        XCTAssertEqual(
            model.errorMessage,
            "Please sign in again."
        )
    }
}
