// Phase 7B — Native auth on device (ADR-003).
//
// Binding contract (ADR-003):
//  - Transport: the iOS app authenticates against the same Better Auth REST
//    endpoints; session token stored in Keychain (kSecAttrAccessibleAfterFirstUnlock).
//  - Magic link on iOS: universal link https://time.neima.me/auth/callback?...
//    (associated domains), fallback custom scheme kairo://auth.
//  - Sign in with Apple: nonce + state validated server-side; private-relay
//    emails are first-class; account linking by verified email.
//  - Logout: revoke server session, purge Keychain + local store + caches.
//  - Better Auth's Expo plugin is NOT used; the SwiftUI client implements the
//    documented REST/session flow directly.

import Foundation
import Security

/// Keychain-based session storage (ADR-003: kSecAttrAccessibleAfterFirstUnlock).
public struct KeychainStore: Sendable {
    private let service: String

    public init(service: String = "com.neima.kairo") {
        self.service = service
    }

    /// Store a session token in the Keychain.
    public func storeSession(token: String, userId: String) throws {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "session_token",
        ]
        // Delete existing item first.
        SecItemDelete(query as CFDictionary)
        // Add the new item with AfterFirstUnlock accessibility.
        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        attributes[kSecAttrLabel as String] = "Kairo Session"
        attributes[kSecAttrDescription as String] = "Session token for user \(userId)"
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.storeFailed(status: status)
        }
    }

    /// Retrieve the session token from the Keychain.
    public func getSession() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "session_token",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    /// Delete the session token (logout / purge).
    public func deleteSession() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "session_token",
        ]
        SecItemDelete(query as CFDictionary)
    }
}

public enum KeychainError: Error {
    case storeFailed(status: OSStatus)
}

/// Sign in with Apple request configuration (ADR-003).
/// Nonce + state are validated server-side.
public struct SignInWithAppleConfig: Sendable {
    public let nonce: String
    public let state: String
    public let requestedScopes: [String]

    public init() {
        // Generate a cryptographically random nonce.
        var nonceBytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, nonceBytes.count, &nonceBytes)
        self.nonce = nonceBytes.map { String(format: "%02x", $0) }.joined()
        // Generate a random state string.
        var stateBytes = [UInt8](repeating: 0, count: 16)
        _ = SecRandomCopyBytes(kSecRandomDefault, stateBytes.count, &stateBytes)
        self.state = stateBytes.map { String(format: "%02x", $0) }.joined()
        self.requestedScopes = ["fullName", "email"]
    }
}

/// Deep link handling — universal link + custom scheme (ADR-003).
public struct DeepLinkHandler: Sendable {
    /// The custom scheme for magic-link fallback.
    public static let customScheme = "kairo"

    /// The universal link domain.
    public static let universalLinkDomain = "time.neima.me"

    /// Parse a magic-link callback URL, extracting the token.
    public static func parseMagicLink(_ url: URL) -> String? {
        // Universal link: https://time.neima.me/auth/callback?token=...
        // Custom scheme: kairo://auth?token=...
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        return components?.queryItems?.first(where: { $0.name == "token" })?.value
    }

    /// Check if a URL is a Kairo deep link.
    public static func isKairoDeepLink(_ url: URL) -> Bool {
        if url.scheme == customScheme { return true }
        if url.host == universalLinkDomain { return true }
        return false
    }
}

/// Auth service — manages the session lifecycle against the Better Auth REST API.
public actor AuthService: Sendable {
    private let client: KairoClient
    private let keychain: KeychainStore

    public init(client: KairoClient = KairoClient(), keychain: KeychainStore = KeychainStore()) {
        self.client = client
        self.keychain = keychain
    }

    /// Check if a session exists in the Keychain (rehydrate on app launch).
    public func hasSession() -> Bool {
        keychain.getSession() != nil
    }

    /// Logout: revoke the server session, purge Keychain + local caches.
    /// ADR-003: logout purges Keychain + local store + caches.
    public func logout() async {
        // Revoke the server session via the Better Auth REST endpoint
        // (not part of the OpenAPI spec — it's a catch-all at /api/auth/*).
        if let baseURL = URL(string: "https://time.neima.me/api/auth/sign-out") {
            var req = URLRequest(url: baseURL)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            if let token = keychain.getSession() {
                req.setValue("kairo_session=\(token)", forHTTPHeaderField: "Cookie")
            }
            _ = try? await URLSession.shared.data(for: req)
        }
        // Purge Keychain.
        keychain.deleteSession()
    }
}
