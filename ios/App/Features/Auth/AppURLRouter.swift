import Foundation
import GoogleSignIn

@MainActor
struct AppURLRouter {
    private let handleGoogleURL: (URL) -> Bool
    private let routeAuthCallback: (URL) async -> Void

    init(
        handleGoogleURL: @escaping (URL) -> Bool = {
            GIDSignIn.sharedInstance.handle($0)
        },
        routeAuthCallback: @escaping (URL) async -> Void
    ) {
        self.handleGoogleURL = handleGoogleURL
        self.routeAuthCallback = routeAuthCallback
    }

    func route(_ url: URL) async {
        guard !handleGoogleURL(url) else {
            return
        }
        await routeAuthCallback(url)
    }
}
