import Foundation

struct NativeAuthCapabilities: Equatable, Sendable {
    let magicLink: Bool
    let apple: Bool
    let google: Bool

    init(
        magicLink: Bool,
        apple: Bool,
        google: Bool = false
    ) {
        self.magicLink = magicLink
        self.apple = apple
        self.google = google
    }
}

struct NativeGoogleCredential: Codable, Equatable, Sendable {
    let idToken: String
    let accessToken: String
}

enum NativeAppleIntent: Equatable, Sendable {
    case signIn
    case link
}

struct NativeAppleChallenge: Equatable, Sendable {
    let state: String
    let nonce: String
    let expiresAt: Date
}
