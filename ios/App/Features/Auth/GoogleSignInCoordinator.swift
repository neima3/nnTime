import GoogleSignIn
import UIKit

private let googleSignInCancelledCode = -5

enum GoogleIdentityError: Error, Equatable, LocalizedError {
    case presentationUnavailable
    case invalidTokens

    var errorDescription: String? {
        "Google authentication couldn't be completed. Try again."
    }
}

enum GoogleIdentityProviderError: Error {
    case cancelled
}

@MainActor
protocol GoogleIdentitySession: AnyObject {
    func refreshedCredential() async throws -> NativeGoogleCredential
}

@MainActor
protocol GoogleIdentityProviding: AnyObject {
    func signIn(
        presenting presenter: UIViewController
    ) async throws -> any GoogleIdentitySession
}

@MainActor
final class GoogleSignInCoordinator {
    private let provider: any GoogleIdentityProviding
    private let activePresenter: () -> UIViewController?

    init() {
        self.provider = GoogleSDKIdentityProvider()
        self.activePresenter = {
            GoogleSignInCoordinator.activeScenePresenter()
        }
    }

    init(
        provider: any GoogleIdentityProviding,
        activePresenter: @escaping () -> UIViewController?
    ) {
        self.provider = provider
        self.activePresenter = activePresenter
    }

    func credential() async throws -> NativeGoogleCredential {
        guard let presenter = activePresenter() else {
            throw GoogleIdentityError.presentationUnavailable
        }
        do {
            let identity = try await provider.signIn(
                presenting: presenter
            )
            return try await identity.refreshedCredential()
        } catch GoogleIdentityProviderError.cancelled {
            throw CancellationError()
        } catch is CancellationError {
            throw CancellationError()
        }
    }

    private static func activeScenePresenter() -> UIViewController? {
        let root = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController
        return root.map(visiblePresenter)
    }

    private static func visiblePresenter(
        from controller: UIViewController
    ) -> UIViewController {
        if let presented = controller.presentedViewController {
            return visiblePresenter(from: presented)
        }
        if let navigation = controller as? UINavigationController,
           let visible = navigation.visibleViewController
        {
            return visiblePresenter(from: visible)
        }
        if let tabs = controller as? UITabBarController,
           let selected = tabs.selectedViewController
        {
            return visiblePresenter(from: selected)
        }
        return controller
    }
}

@MainActor
private final class GoogleSDKIdentityProvider: GoogleIdentityProviding {
    func signIn(
        presenting presenter: UIViewController
    ) async throws -> any GoogleIdentitySession {
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(
                withPresenting: presenter
            )
            return GoogleSDKIdentitySession(user: result.user)
        } catch {
            let providerError = error as NSError
            if providerError.domain == kGIDSignInErrorDomain,
               providerError.code == googleSignInCancelledCode
            {
                throw GoogleIdentityProviderError.cancelled
            }
            throw GoogleIdentityError.invalidTokens
        }
    }
}

@MainActor
private final class GoogleSDKIdentitySession: GoogleIdentitySession {
    private let user: GIDGoogleUser

    init(user: GIDGoogleUser) {
        self.user = user
    }

    func refreshedCredential() async throws -> NativeGoogleCredential {
        do {
            let refreshedUser = try await user.refreshTokensIfNeeded()
            guard
                let idToken = refreshedUser.idToken?.tokenString,
                !idToken.isEmpty,
                !refreshedUser.accessToken.tokenString.isEmpty
            else {
                throw GoogleIdentityError.invalidTokens
            }
            return .init(
                idToken: idToken,
                accessToken: refreshedUser.accessToken.tokenString
            )
        } catch is GoogleIdentityError {
            throw GoogleIdentityError.invalidTokens
        } catch {
            throw GoogleIdentityError.invalidTokens
        }
    }
}
