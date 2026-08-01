import CryptoKit
import Foundation
import Security

// MARK: - Native session envelope (shared with the widget extension)
//
// The Better Auth cookie envelope lives in a keychain item tagged with the
// app-group access group so the widget extension can authenticate its own
// requests (H03 complete-from-widget). App-group identifiers are valid
// keychain access groups on iOS without any team-prefix entitlement, so both
// targets' existing `com.apple.security.application-groups` grant is enough.

struct NativeSessionCookie: Codable, Equatable, Sendable {
    let name: String
    let value: String
    let domain: String
    let path: String
    let secure: Bool
    let expiresAt: Date?
}

struct NativeSessionEnvelope: Codable, Equatable, Sendable {
    let version: Int
    let cookies: [NativeSessionCookie]
}

protocol SessionEnvelopeStoring: Sendable {
    func load() async throws -> NativeSessionEnvelope?
    func save(_ envelope: NativeSessionEnvelope) async throws
    func clear() async throws
}

enum NativeSessionError: Error {
    case invalidOrigin
    case invalidEnvelope
    case missingAuthCookie
    case cookieRestoreFailed
    case keychain(OSStatus)
}

// MARK: - Keychain seam

/// The three SecItem calls the store needs, behind a protocol so migration
/// logic is testable without the (access-group-lax) simulator keychain.
protocol KeychainClient: Sendable {
    func copyMatching(_ query: [String: Any]) -> (status: OSStatus, data: Data?)
    func add(_ attributes: [String: Any]) -> OSStatus
    func delete(_ query: [String: Any]) -> OSStatus
}

struct SystemKeychainClient: KeychainClient {
    func copyMatching(
        _ query: [String: Any]
    ) -> (status: OSStatus, data: Data?) {
        var query = query
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        return (status, result as? Data)
    }

    func add(_ attributes: [String: Any]) -> OSStatus {
        SecItemAdd(attributes as CFDictionary, nil)
    }

    func delete(_ query: [String: Any]) -> OSStatus {
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Store

actor KeychainSessionEnvelopeStore: SessionEnvelopeStoring {
    /// App-group identifiers double as keychain access groups on iOS.
    static let sharedAccessGroup = "group.me.neima.kairo"

    private let service: String
    private let account: String
    private let accessGroup: String?
    private let client: any KeychainClient

    init(
        service: String = "me.neima.kairo.native-session",
        account: String = "better-auth-cookie-envelope",
        accessGroup: String? = KeychainSessionEnvelopeStore.sharedAccessGroup,
        client: any KeychainClient = SystemKeychainClient()
    ) {
        self.service = service
        self.account = account
        self.accessGroup = accessGroup
        self.client = client
    }

    func load() throws -> NativeSessionEnvelope? {
        let (status, data) = client.copyMatching(groupedQuery)
        if status == errSecItemNotFound {
            return try migrateLegacyItem()
        }
        guard status == errSecSuccess, let data else {
            throw NativeSessionError.keychain(status)
        }
        return try decode(data)
    }

    func save(_ envelope: NativeSessionEnvelope) throws {
        let data = try JSONEncoder().encode(envelope)
        // The group-less query matches every reachable access group, so this
        // also sweeps out any pre-shared-group copy in one pass.
        _ = client.delete(legacyQuery)
        var attributes = groupedQuery
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] =
            kSecAttrAccessibleAfterFirstUnlock
        let status = client.add(attributes)
        guard status == errSecSuccess else {
            throw NativeSessionError.keychain(status)
        }
    }

    func clear() throws {
        // The legacy (pre-shared-group) query matches every access group the
        // caller can reach, including the shared one — one delete covers both.
        let status = client.delete(legacyQuery)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw NativeSessionError.keychain(status)
        }
    }

    /// Sessions persisted before the shared access group existed live in the
    /// app's default group, invisible to the widget. Move them on first read
    /// so signing in again is never required.
    private func migrateLegacyItem() throws -> NativeSessionEnvelope? {
        guard accessGroup != nil else { return nil }
        let (status, data) = client.copyMatching(legacyQuery)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess, let data else {
            throw NativeSessionError.keychain(status)
        }
        let envelope = try decode(data)
        try save(envelope)
        return envelope
    }

    private func decode(_ data: Data) throws -> NativeSessionEnvelope {
        do {
            return try JSONDecoder().decode(
                NativeSessionEnvelope.self,
                from: data
            )
        } catch {
            try? clear()
            throw NativeSessionError.invalidEnvelope
        }
    }

    private var groupedQuery: [String: Any] {
        var query = legacyQuery
        if let accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }
        return query
    }

    private var legacyQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}

// MARK: - Cookie rules

/// The single definition of "which cookies are the session" and "what scope
/// hash they produce" — the app's session controller and the widget's
/// completion service must agree byte-for-byte or the widget would refuse to
/// touch a cache the app just wrote.
enum SessionCookieRules {
    static func isConfigured(
        _ cookie: NativeSessionCookie,
        baseURL: URL
    ) -> Bool {
        guard let host = baseURL.host?.lowercased() else {
            return false
        }
        let domain = cookie.domain
            .lowercased()
            .trimmingCharacters(
                in: CharacterSet(charactersIn: ".")
            )
        let configuredPath = baseURL.path.isEmpty ? "/" : baseURL.path
        let name = cookie.name.lowercased()
        return domain == host
            && cookie.path == configuredPath
            && (
                name.hasPrefix("better-auth.")
                    || name.hasPrefix("__secure-better-auth.")
                    || name.hasPrefix("__host-better-auth.")
            )
    }

    static func scope(for cookies: [NativeSessionCookie]) -> String {
        let material = cookies
            .sorted {
                ($0.name, $0.domain, $0.path) <
                    ($1.name, $1.domain, $1.path)
            }
            .map {
                [$0.name, $0.value, $0.domain, $0.path]
                    .joined(separator: "\u{0}")
            }
            .joined(separator: "\u{1}")
        return SHA256.hash(data: Data(material.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    /// A `Cookie` header for the configured origin, or nil when no live
    /// session cookie remains (expired or wrong origin).
    static func cookieHeader(
        for envelope: NativeSessionEnvelope,
        baseURL: URL,
        at now: Date
    ) -> String? {
        let live = envelope.cookies.filter { cookie in
            guard isConfigured(cookie, baseURL: baseURL) else {
                return false
            }
            if let expiresAt = cookie.expiresAt, expiresAt <= now {
                return false
            }
            return true
        }
        guard !live.isEmpty else { return nil }
        return live
            .sorted {
                ($0.name, $0.domain, $0.path) <
                    ($1.name, $1.domain, $1.path)
            }
            .map { "\($0.name)=\($0.value)" }
            .joined(separator: "; ")
    }
}
