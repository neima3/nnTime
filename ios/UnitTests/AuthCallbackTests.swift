import Foundation
import XCTest
@testable import Kairo

final class AuthCallbackTests: XCTestCase {
    func testAcceptsCanonicalUniversalAndCustomSchemeLinks() throws {
        XCTAssertEqual(
            try XCTUnwrap(
                AuthCallback.parse(
                    URL(
                        string:
                            "https://time.neima.me/auth/callback?token=abc-DEF_123"
                    )!
                )
            ).token,
            "abc-DEF_123"
        )
        XCTAssertEqual(
            try XCTUnwrap(
                AuthCallback.parse(
                    URL(string: "kairo://auth?token=abc-DEF_123")!
                )
            ).token,
            "abc-DEF_123"
        )
    }

    func testRejectsLookalikeOriginsAndPaths() {
        [
            "http://time.neima.me/auth/callback?token=abc",
            "https://evil.example/auth/callback?token=abc",
            "https://time.neima.me.evil.example/auth/callback?token=abc",
            "https://user@time.neima.me/auth/callback?token=abc",
            "https://time.neima.me:443/auth/callback?token=abc",
            "https://time.neima.me/auth/callback/extra?token=abc",
            "kairo://evil?token=abc",
            "other://auth?token=abc",
        ].forEach {
            XCTAssertNil(AuthCallback.parse(URL(string: $0)!))
        }
    }

    func testRejectsMissingDuplicateEmptyAndFragmentTokens() {
        [
            "https://time.neima.me/auth/callback",
            "https://time.neima.me/auth/callback?token=",
            "https://time.neima.me/auth/callback?token=one&token=two",
            "https://time.neima.me/auth/callback#token=abc",
            "kairo://auth?token=has%20space",
        ].forEach {
            XCTAssertNil(AuthCallback.parse(URL(string: $0)!))
        }
    }
}
