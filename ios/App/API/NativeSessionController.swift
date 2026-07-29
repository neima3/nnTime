import CryptoKit
import Foundation
import Security

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

actor KeychainSessionEnvelopeStore: SessionEnvelopeStoring {
    private let service: String
    private let account: String

    init(
        service: String = "me.neima.kairo.native-session",
        account: String = "better-auth-cookie-envelope"
    ) {
        self.service = service
        self.account = account
    }

    func load() throws -> NativeSessionEnvelope? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess, let data = result as? Data else {
            throw NativeSessionError.keychain(status)
        }
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

    func save(_ envelope: NativeSessionEnvelope) throws {
        let data = try JSONEncoder().encode(envelope)
        SecItemDelete(baseQuery as CFDictionary)
        var attributes = baseQuery
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] =
            kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NativeSessionError.keychain(status)
        }
    }

    func clear() throws {
        let status = SecItemDelete(baseQuery as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw NativeSessionError.keychain(status)
        }
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}

actor NativeSessionController {
    struct PersistResult: Equatable, Sendable {
        let scope: String
        let replacedScope: String?
    }

    private static let envelopeVersion = 1

    private let baseURL: URL
    private let cookieStorage: HTTPCookieStorage
    private let envelopeStore: any SessionEnvelopeStoring
    private var restoredScope: String?

    init(
        baseURL: URL,
        cookieStorage: HTTPCookieStorage,
        envelopeStore: any SessionEnvelopeStoring =
            KeychainSessionEnvelopeStore()
    ) {
        self.baseURL = baseURL
        self.cookieStorage = cookieStorage
        self.envelopeStore = envelopeStore
    }

    func persist() async throws -> PersistResult {
        let cookies = configuredCookies()
            .map(Self.storedCookie)
            .sorted {
                ($0.name, $0.domain, $0.path) <
                    ($1.name, $1.domain, $1.path)
            }
        guard !cookies.isEmpty else {
            throw NativeSessionError.missingAuthCookie
        }
        let envelope = NativeSessionEnvelope(
            version: Self.envelopeVersion,
            cookies: cookies
        )
        let priorScope = try await envelopeStore.load().flatMap {
            try? validatedScope(for: $0)
        }
        let scope = Self.scope(for: cookies)
        try await envelopeStore.save(envelope)
        restoredScope = scope
        return PersistResult(
            scope: scope,
            replacedScope: priorScope == scope ? nil : priorScope
        )
    }

    func restore() async throws -> String? {
        guard let envelope = try await envelopeStore.load() else {
            restoredScope = nil
            return nil
        }
        do {
            let scope = try validatedScope(for: envelope)
            clearConfiguredCookies()
            for stored in envelope.cookies {
                guard let cookie = Self.cookie(from: stored) else {
                    throw NativeSessionError.cookieRestoreFailed
                }
                cookieStorage.setCookie(cookie)
            }
            restoredScope = scope
            return scope
        } catch {
            await invalidate()
            throw error
        }
    }

    func currentScope() -> String? {
        restoredScope
    }

    @discardableResult
    func invalidate() async -> Bool {
        let hadLocalAuth = restoredScope != nil
            || !configuredCookies().isEmpty
        clearConfiguredCookies()
        restoredScope = nil
        try? await envelopeStore.clear()
        return hadLocalAuth
    }

    private func validatedScope(
        for envelope: NativeSessionEnvelope
    ) throws -> String {
        guard
            envelope.version == Self.envelopeVersion,
            !envelope.cookies.isEmpty,
            envelope.cookies.allSatisfy(isConfiguredCookie)
        else {
            throw NativeSessionError.invalidEnvelope
        }
        return Self.scope(for: envelope.cookies)
    }

    private func configuredCookies() -> [HTTPCookie] {
        (cookieStorage.cookies ?? []).filter {
            isConfiguredCookie(Self.storedCookie($0))
        }
    }

    private func clearConfiguredCookies() {
        for cookie in configuredCookies() {
            cookieStorage.deleteCookie(cookie)
        }
    }

    private func isConfiguredCookie(
        _ cookie: NativeSessionCookie
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

    private static func storedCookie(
        _ cookie: HTTPCookie
    ) -> NativeSessionCookie {
        NativeSessionCookie(
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.isSecure,
            expiresAt: cookie.expiresDate
        )
    }

    private static func cookie(
        from stored: NativeSessionCookie
    ) -> HTTPCookie? {
        var properties: [HTTPCookiePropertyKey: Any] = [
            .name: stored.name,
            .value: stored.value,
            .domain: stored.domain,
            .path: stored.path,
        ]
        if stored.secure {
            properties[.secure] = "TRUE"
        }
        if let expiresAt = stored.expiresAt {
            properties[.expires] = expiresAt
        }
        return HTTPCookie(properties: properties)
    }

    private static func scope(
        for cookies: [NativeSessionCookie]
    ) -> String {
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
}

extension Notification.Name {
    static let kairoSessionInvalidated: Notification.Name = Notification.Name(
        "kairoSessionInvalidated"
    )
}
