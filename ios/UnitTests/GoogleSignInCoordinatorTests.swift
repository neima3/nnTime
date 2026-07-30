import UIKit
import XCTest
@testable import Kairo

@MainActor
final class GoogleSignInCoordinatorTests: XCTestCase {
    func testPresentsFromActiveSceneAndReturnsRefreshedTokensOnly() async throws {
        let presenter = UIViewController()
        let session = StubGoogleIdentitySession(
            tokens: .init(
                idToken: "refreshed-id-token",
                accessToken: "refreshed-access-token"
            )
        )
        let provider = StubGoogleIdentityProvider(session: session)
        let coordinator = GoogleSignInCoordinator(
            provider: provider,
            activePresenter: { presenter }
        )

        let credential = try await coordinator.credential()

        XCTAssertTrue(provider.presenter === presenter)
        XCTAssertEqual(session.refreshCount, 1)
        XCTAssertEqual(
            credential,
            .init(
                idToken: "refreshed-id-token",
                accessToken: "refreshed-access-token"
            )
        )
    }

    func testMapsProviderCancellationToCancellationError() async {
        let coordinator = GoogleSignInCoordinator(
            provider: StubGoogleIdentityProvider(
                error: GoogleIdentityProviderError.cancelled
            ),
            activePresenter: { UIViewController() }
        )

        do {
            _ = try await coordinator.credential()
            XCTFail("Expected cancellation")
        } catch {
            XCTAssertTrue(error is CancellationError)
        }
    }

    func testRejectsMissingActivePresenterWithoutStartingProvider() async {
        let provider = StubGoogleIdentityProvider(
            session: StubGoogleIdentitySession(
                tokens: .init(idToken: "id", accessToken: "access")
            )
        )
        let coordinator = GoogleSignInCoordinator(
            provider: provider,
            activePresenter: { nil }
        )

        do {
            _ = try await coordinator.credential()
            XCTFail("Expected presentation failure")
        } catch let error as GoogleIdentityError {
            XCTAssertEqual(error, .presentationUnavailable)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
        XCTAssertNil(provider.presenter)
    }
}

@MainActor
private final class StubGoogleIdentityProvider: GoogleIdentityProviding {
    private let session: (any GoogleIdentitySession)?
    private let error: Error?
    private(set) var presenter: UIViewController?

    init(
        session: (any GoogleIdentitySession)? = nil,
        error: Error? = nil
    ) {
        self.session = session
        self.error = error
    }

    func signIn(
        presenting presenter: UIViewController
    ) async throws -> any GoogleIdentitySession {
        self.presenter = presenter
        if let error {
            throw error
        }
        return try XCTUnwrap(session)
    }
}

@MainActor
private final class StubGoogleIdentitySession: GoogleIdentitySession {
    let tokens: NativeGoogleCredential
    private(set) var refreshCount = 0

    init(tokens: NativeGoogleCredential) {
        self.tokens = tokens
    }

    func refreshedCredential() async throws -> NativeGoogleCredential {
        refreshCount += 1
        return tokens
    }
}
