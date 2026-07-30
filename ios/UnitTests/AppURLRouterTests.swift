import Foundation
import XCTest
@testable import Kairo

@MainActor
final class AppURLRouterTests: XCTestCase {
    func testGoogleHandledURLStopsBeforeKairoCallbackRouting() async {
        var googleURLs: [URL] = []
        var kairoURLs: [URL] = []
        let router = AppURLRouter(
            handleGoogleURL: {
                googleURLs.append($0)
                return true
            },
            routeAuthCallback: {
                kairoURLs.append($0)
            }
        )
        let url = URL(string: "com.googleusercontent.apps.client:/oauth")!

        await router.route(url)

        XCTAssertEqual(googleURLs, [url])
        XCTAssertTrue(kairoURLs.isEmpty)
    }

    func testUnhandledURLContinuesToKairoCallbackRouting() async {
        var kairoURLs: [URL] = []
        let router = AppURLRouter(
            handleGoogleURL: { _ in false },
            routeAuthCallback: {
                kairoURLs.append($0)
            }
        )
        let url = URL(string: "https://time.neima.me/auth/callback?token=t")!

        await router.route(url)

        XCTAssertEqual(kairoURLs, [url])
    }
}
