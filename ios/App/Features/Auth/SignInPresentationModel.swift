import Foundation
import Observation

@Observable
@MainActor
final class SignInPresentationModel {
    enum Operation: Equatable {
        case password
        case apple
        case google
        case magicLink
    }

    enum Status: Equatable {
        case idle
        case loading(Operation)
        case signedIn
        case magicLinkSent(String)
        case duplicateAccount
        case failed(String)
    }

    private(set) var capabilities: NativeAuthCapabilities?
    private(set) var status: Status = .idle

    var showsApple: Bool {
        capabilities?.apple == true
    }

    var showsMagicLink: Bool {
        capabilities?.magicLink == true
    }

    var showsGoogle: Bool {
        capabilities?.google == true
    }

    var isBusy: Bool {
        if case .loading = status {
            return true
        }
        return false
    }

    var isSignedIn: Bool {
        status == .signedIn
    }

    var errorMessage: String? {
        switch status {
        case let .failed(message):
            message
        case .duplicateAccount:
            "Sign in with your email first, then connect Google or Apple in Settings."
        case .idle, .loading, .signedIn, .magicLinkSent:
            nil
        }
    }

    func loadCapabilities(
        using load: () async throws -> NativeAuthCapabilities
    ) async {
        do {
            capabilities = try await load()
        } catch {
            capabilities = .init(magicLink: false, apple: false)
        }
    }

    func authenticate(
        using operation: Operation,
        action: () async throws
            -> NativeSessionController.PersistResult
    ) async -> NativeSessionController.PersistResult? {
        guard !isBusy else {
            return nil
        }
        status = .loading(operation)
        do {
            let session: NativeSessionController.PersistResult =
                try await action()
            status = .signedIn
            return session
        } catch is CancellationError {
            status = .idle
            return nil
        } catch {
            status = Self.failureStatus(for: error)
            return nil
        }
    }

    @discardableResult
    func requestMagicLink(
        email: String,
        send: () async throws -> Void
    ) async -> Bool {
        guard !isBusy else {
            return false
        }
        status = .loading(.magicLink)
        do {
            try await send()
            status = .magicLinkSent(email)
            return true
        } catch is CancellationError {
            status = .idle
            return false
        } catch {
            status = Self.failureStatus(for: error)
            return false
        }
    }

    func resetFeedback() {
        guard !isBusy else {
            return
        }
        status = .idle
    }

#if DEBUG
    func installFixture(
        capabilities: NativeAuthCapabilities,
        status: Status = .idle
    ) {
        self.capabilities = capabilities
        self.status = status
    }
#endif

    private static func failureStatus(for error: Error) -> Status {
        if case APIError.socialAuth(_, .accountConflict) = error {
            return .duplicateAccount
        }
        if let apiError = error as? APIError,
           let code = apiError.serverError?.code,
           [
               "account_exists_with_different_credential",
               "account_already_exists",
               "credential_already_linked",
           ].contains(code)
        {
            return .duplicateAccount
        }
        if let localized = error as? LocalizedError,
           let description = localized.errorDescription,
           !description.isEmpty
        {
            return .failed(description)
        }
        return .failed("Something went wrong — try again.")
    }
}
