import AuthenticationServices
import CryptoKit
import SwiftUI

struct AppleIdentityCredential: Equatable, Sendable {
    let idToken: String
}

enum AppleSignInValidationError: LocalizedError {
    case missingCredential
    case stateMismatch

    var errorDescription: String? {
        switch self {
        case .missingCredential:
            "Apple didn’t return a usable credential. Please try again."
        case .stateMismatch:
            "Apple sign-in could not be verified. Please try again."
        }
    }
}

enum AppleSignInCredentialValidator {
    static func validate(
        returnedState: String?,
        identityToken: Data?,
        expectedChallenge: NativeAppleChallenge
    ) throws -> AppleIdentityCredential {
        guard returnedState == expectedChallenge.state else {
            throw AppleSignInValidationError.stateMismatch
        }
        guard
            let identityToken,
            let idToken = String(data: identityToken, encoding: .utf8),
            !idToken.isEmpty
        else {
            throw AppleSignInValidationError.missingCredential
        }
        return .init(idToken: idToken)
    }
}

struct AppleSignInControl: View {
    enum Purpose {
        case signIn
        case link
    }

    @Environment(\.colorScheme) private var colorScheme

    let purpose: Purpose
    let challenge: NativeAppleChallenge
    let disabled: Bool
    let completion:
        (Result<AppleIdentityCredential, Error>) async -> Void

    var body: some View {
        SignInWithAppleButton(
            purpose == .signIn ? .signIn : .continue,
            onRequest: configure,
            onCompletion: finish
        )
        .signInWithAppleButtonStyle(
            colorScheme == .dark ? .white : .black
        )
        .id(colorScheme)
        .frame(height: 52)
        .clipShape(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
        )
        .disabled(disabled)
        .opacity(disabled ? 0.58 : 1)
        .accessibilityLabel(
            purpose == .signIn
                ? "Sign in with Apple"
                : "Connect Apple account"
        )
        .accessibilityHint(
            purpose == .signIn
                ? "Signs in securely using your Apple ID."
                : "Links Apple to your signed-in Kairo account."
        )
    }

    private func configure(_ request: ASAuthorizationAppleIDRequest) {
        request.requestedScopes = [.fullName, .email]
        request.state = challenge.state
        request.nonce = Self.sha256(challenge.nonce)
    }

    private func finish(
        _ result: Result<ASAuthorization, Error>
    ) {
        let mapped: Result<AppleIdentityCredential, Error>
        switch result {
        case let .success(authorization):
            guard
                let credential =
                    authorization.credential
                        as? ASAuthorizationAppleIDCredential
            else {
                mapped = .failure(
                    AppleSignInValidationError.missingCredential
                )
                break
            }
            do {
                mapped = .success(
                    try AppleSignInCredentialValidator.validate(
                        returnedState: credential.state,
                        identityToken: credential.identityToken,
                        expectedChallenge: challenge
                    )
                )
            } catch {
                mapped = .failure(error)
            }
        case let .failure(error):
            if let authorizationError = error as? ASAuthorizationError,
               authorizationError.code == .canceled
            {
                mapped = .failure(CancellationError())
            } else {
                mapped = .failure(error)
            }
        }
        Task { await completion(mapped) }
    }

    private static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}
