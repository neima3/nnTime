import Foundation
import XCTest
@testable import Kairo

@MainActor
final class SignInPresentationTests: XCTestCase {
    func testProvidersStayHiddenUntilCapabilitiesLoad() async {
        let model = SignInPresentationModel()

        XCTAssertFalse(model.showsApple)
        XCTAssertFalse(model.showsGoogle)
        XCTAssertFalse(model.showsMagicLink)

        await model.loadCapabilities {
            .init(magicLink: true, apple: true, google: true)
        }

        XCTAssertTrue(model.showsApple)
        XCTAssertTrue(model.showsGoogle)
        XCTAssertTrue(model.showsMagicLink)
    }

    func testUnavailableMethodsNeverRender() async {
        let model = SignInPresentationModel()

        await model.loadCapabilities {
            .init(magicLink: false, apple: false)
        }

        XCTAssertFalse(model.showsApple)
        XCTAssertFalse(model.showsGoogle)
        XCTAssertFalse(model.showsMagicLink)
    }

    func testGoogleAuthenticationPublishesLoadingAndSuccess() async {
        let model = SignInPresentationModel()
        var observedLoading = false

        let session = await model.authenticate(using: .google) {
            observedLoading = model.status == .loading(.google)
            return .init(scope: "scope-google", replacedScope: "scope-email")
        }

        XCTAssertTrue(observedLoading)
        XCTAssertEqual(session?.scope, "scope-google")
        XCTAssertEqual(model.status, .signedIn)
    }

    func testGoogleCancellationReturnsToReadyWithoutError() async {
        let model = SignInPresentationModel()

        let session = await model.authenticate(using: .google) {
            throw CancellationError()
        }

        XCTAssertNil(session)
        XCTAssertEqual(model.status, .idle)
        XCTAssertNil(model.errorMessage)
    }

    func testGoogleProviderFailureUsesActionableMessage() async {
        let model = SignInPresentationModel()

        let session = await model.authenticate(using: .google) {
            throw GoogleIdentityError.invalidTokens
        }

        XCTAssertNil(session)
        XCTAssertEqual(
            model.errorMessage,
            "Google authentication couldn't be completed. Try again."
        )
    }

    func testOnlyOneAuthenticationOperationRunsAtATime() async {
        let model = SignInPresentationModel()
        var nestedRan = false

        let session = await model.authenticate(using: .password) {
            XCTAssertEqual(model.status, .loading(.password))
            let sent = await model.requestMagicLink(
                email: "synthetic@example.test"
            ) {
                nestedRan = true
            }
            XCTAssertFalse(sent)
            return .init(scope: "scope-a", replacedScope: nil)
        }

        XCTAssertFalse(nestedRan)
        XCTAssertEqual(session?.scope, "scope-a")
        XCTAssertEqual(model.status, .signedIn)
    }

    func testCancellationReturnsToIdleWithoutError() async {
        let model = SignInPresentationModel()

        let session = await model.authenticate(using: .apple) {
            throw CancellationError()
        }

        XCTAssertNil(session)
        XCTAssertEqual(model.status, .idle)
        XCTAssertNil(model.errorMessage)
    }

    func testFailureProvidesActionableMessage() async {
        let model = SignInPresentationModel()

        let session = await model.authenticate(using: .password) {
            throw APIError.authHTTP(400, "Check your email and password.")
        }

        XCTAssertNil(session)
        XCTAssertEqual(
            model.status,
            .failed("Check your email and password.")
        )
        XCTAssertEqual(
            model.errorMessage,
            "Check your email and password."
        )
    }

    func testDuplicateAccountGivesEmailFirstGuidance() async {
        let model = SignInPresentationModel()

        let session = await model.authenticate(using: .apple) {
            throw APIError.conflict(
                409,
                .init(
                    code: "account_exists_with_different_credential",
                    message: "Already registered.",
                    retryable: false,
                    details: nil
                )
            )
        }

        XCTAssertNil(session)
        XCTAssertEqual(model.status, .duplicateAccount)
        XCTAssertEqual(
            model.errorMessage,
            "Sign in with your email first, then connect Google or Apple in Settings."
        )
    }

    func testMagicLinkSuccessDoesNotImplySignedIn() async {
        let model = SignInPresentationModel()

        let sent = await model.requestMagicLink(
            email: "synthetic@example.test"
        ) {}

        XCTAssertTrue(sent)
        XCTAssertEqual(
            model.status,
            .magicLinkSent("synthetic@example.test")
        )
        XCTAssertFalse(model.isSignedIn)
    }

    func testAccountReplacementPreparationFailureDoesNotBootstrap() async {
        let recorder = SignInFinishRecorder()

        await SignInSessionFinisher.finish(
            .init(scope: "scope-b", replacedScope: "scope-a"),
            prepareForAccountSwitch: { scope in
                await recorder.append("prepare:\(scope)")
                return false
            },
            bootstrap: {
                await recorder.append("bootstrap")
            }
        )

        let values = await recorder.values
        XCTAssertEqual(values, ["prepare:scope-b"])
    }

    func testAppleCredentialRequiresExactReturnedState() {
        let challenge = NativeAppleChallenge(
            state: "expected-state",
            nonce: "nonce",
            expiresAt: Date().addingTimeInterval(300)
        )

        XCTAssertThrowsError(
            try AppleSignInCredentialValidator.validate(
                returnedState: "other-state",
                identityToken: Data("identity-token".utf8),
                expectedChallenge: challenge
            )
        ) { error in
            XCTAssertTrue(
                error is AppleSignInValidationError
            )
        }
    }

    func testAppleCredentialReturnsOpaqueIdentityToken() throws {
        let credential = try AppleSignInCredentialValidator.validate(
            returnedState: "expected-state",
            identityToken: Data("identity-token".utf8),
            expectedChallenge: .init(
                state: "expected-state",
                nonce: "nonce",
                expiresAt: Date().addingTimeInterval(300)
            )
        )

        XCTAssertEqual(credential.idToken, "identity-token")
    }
}

private actor SignInFinishRecorder {
    private(set) var values: [String] = []

    func append(_ value: String) {
        values.append(value)
    }
}
