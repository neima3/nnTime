import XCTest
@testable import Kairo

final class AppSessionPolicyTests: XCTestCase {
    func testSuccessfulProbeEntersOnlineSession() {
        XCTAssertEqual(
            AppSessionPolicy.decide(
                scope: "account-a",
                hasMatchingCache: true,
                failure: nil
            ),
            .signedInOnline(scope: "account-a")
        )
    }

    func testOnlyUnauthorizedSignsOut() {
        XCTAssertEqual(
            AppSessionPolicy.decide(
                scope: "account-a",
                hasMatchingCache: true,
                failure: .unauthorized
            ),
            .signedOut
        )
    }

    func testTransientFailureWithScopedCacheEntersReadOnlyMode() {
        for failure in [
            AppSessionFailure.network,
            .rateLimited,
            .server,
            .decoding,
        ] {
            XCTAssertEqual(
                AppSessionPolicy.decide(
                    scope: "account-a",
                    hasMatchingCache: true,
                    failure: failure
                ),
                .signedInOffline(scope: "account-a")
            )
        }
    }

    func testTransientFailureWithoutCacheNeedsConnection() {
        XCTAssertEqual(
            AppSessionPolicy.decide(
                scope: "account-a",
                hasMatchingCache: false,
                failure: .network
            ),
            .connectionRequired(scope: "account-a")
        )
    }

    func testUnscopedCacheCannotRestoreAnotherAccount() {
        XCTAssertEqual(
            AppSessionPolicy.decide(
                scope: nil,
                hasMatchingCache: true,
                failure: .network
            ),
            .connectionRequired(scope: nil)
        )
    }

    func testCancellationDoesNotChangeAuthState() {
        XCTAssertEqual(
            AppSessionPolicy.decide(
                scope: "account-a",
                hasMatchingCache: true,
                failure: .cancelled
            ),
            .unchanged
        )
    }

    func testFailureClassifierDistinguishes401FromRetryableErrors() {
        let payload = ServerErrorData(
            code: "UNAUTHORIZED",
            message: "Sign in",
            retryable: false,
            details: nil
        )
        XCTAssertEqual(
            AppSessionFailure.classify(
                APIError.unauthorized(401, payload)
            ),
            .unauthorized
        )
        XCTAssertEqual(
            AppSessionFailure.classify(
                APIError.authHTTP(429, "Slow down")
            ),
            .rateLimited
        )
        XCTAssertEqual(
            AppSessionFailure.classify(
                APIError.http(503, payload)
            ),
            .server
        )
        XCTAssertEqual(
            AppSessionFailure.classify(CancellationError()),
            .cancelled
        )
    }
}
