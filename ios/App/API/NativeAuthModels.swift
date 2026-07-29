import Foundation

struct NativeAuthCapabilities: Equatable, Sendable {
    let magicLink: Bool
    let apple: Bool
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
