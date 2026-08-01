import Foundation

// The envelope types and keychain store live in Shared/SessionEnvelope.swift
// so the widget extension can read the same session (H03).

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
        SessionCookieRules.isConfigured(cookie, baseURL: baseURL)
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
        SessionCookieRules.scope(for: cookies)
    }
}

extension Notification.Name {
    static let kairoSessionInvalidated: Notification.Name = Notification.Name(
        "kairoSessionInvalidated"
    )
}
