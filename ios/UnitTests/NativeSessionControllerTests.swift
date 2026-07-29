import Foundation
import XCTest
@testable import Kairo

final class NativeSessionControllerTests: XCTestCase {
    func testPersistStoresOnlyConfiguredKairoAuthCookies() async throws {
        let storage = Self.cookieStorage()
        let vault = MemorySessionEnvelopeStore()
        for cookie in try [
            Self.cookie(
                name: "better-auth.session_token",
                value: "session-a",
                domain: "time.neima.me",
                path: "/"
            ),
            Self.cookie(
                name: "__Secure-better-auth.device",
                value: "device-a",
                domain: ".time.neima.me",
                path: "/"
            ),
            Self.cookie(
                name: "analytics",
                value: "keep",
                domain: "time.neima.me",
                path: "/"
            ),
            Self.cookie(
                name: "better-auth.session_token",
                value: "other",
                domain: "other.neima.me",
                path: "/"
            ),
        ] {
            storage.setCookie(cookie)
        }
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: vault
        )

        let result = try await controller.persist()
        let loaded = await vault.savedEnvelope()
        let saved = try XCTUnwrap(loaded)

        XCTAssertEqual(saved.cookies.map(\.name).sorted(), [
            "__Secure-better-auth.device",
            "better-auth.session_token",
        ])
        XCTAssertEqual(result.scope.count, 64)
        XCTAssertNil(result.replacedScope)
        XCTAssertFalse(result.scope.contains("session-a"))
    }

    func testRestoreRehydratesConfiguredCookiesAndStableScope() async throws {
        let sourceStorage = Self.cookieStorage()
        sourceStorage.setCookie(
            try Self.cookie(
                name: "better-auth.session_token",
                value: "session-a",
                domain: "time.neima.me",
                path: "/"
            )
        )
        let vault = MemorySessionEnvelopeStore()
        let source = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: sourceStorage,
            envelopeStore: vault
        )
        let persisted = try await source.persist()

        let restoredStorage = Self.cookieStorage()
        restoredStorage.setCookie(
            try Self.cookie(
                name: "analytics",
                value: "keep",
                domain: "time.neima.me",
                path: "/"
            )
        )
        let restored = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: restoredStorage,
            envelopeStore: vault
        )

        let scope = try await restored.restore()

        XCTAssertEqual(scope, persisted.scope)
        XCTAssertEqual(
            Set((restoredStorage.cookies ?? []).map(\.name)),
            ["analytics", "better-auth.session_token"]
        )
    }

    func testPersistReportsAccountScopeReplacement() async throws {
        let storage = Self.cookieStorage()
        let vault = MemorySessionEnvelopeStore()
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: vault
        )
        storage.setCookie(
            try Self.cookie(
                name: "better-auth.session_token",
                value: "session-a",
                domain: "time.neima.me",
                path: "/"
            )
        )
        let first = try await controller.persist()
        for cookie in storage.cookies ?? [] {
            storage.deleteCookie(cookie)
        }
        storage.setCookie(
            try Self.cookie(
                name: "better-auth.session_token",
                value: "session-b",
                domain: "time.neima.me",
                path: "/"
            )
        )

        let second = try await controller.persist()

        XCTAssertNotEqual(second.scope, first.scope)
        XCTAssertEqual(second.replacedScope, first.scope)
    }

    func testInvalidateClearsVaultAndOnlyConfiguredCookies() async throws {
        let storage = Self.cookieStorage()
        let vault = MemorySessionEnvelopeStore()
        for cookie in try [
            Self.cookie(
                name: "better-auth.session_token",
                value: "session-a",
                domain: "time.neima.me",
                path: "/"
            ),
            Self.cookie(
                name: "analytics",
                value: "keep",
                domain: "time.neima.me",
                path: "/"
            ),
            Self.cookie(
                name: "better-auth.session_token",
                value: "other",
                domain: "other.neima.me",
                path: "/"
            ),
        ] {
            storage.setCookie(cookie)
        }
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: vault
        )
        _ = try await controller.persist()

        await controller.invalidate()

        let saved = await vault.savedEnvelope()
        XCTAssertNil(saved)
        XCTAssertEqual(
            Set((storage.cookies ?? []).map {
                "\($0.name)|\($0.domain)|\($0.path)"
            }),
            [
                "analytics|time.neima.me|/",
                "better-auth.session_token|other.neima.me|/",
            ]
        )
    }

    func testRestoreRejectsEnvelopeForAnotherOrigin() async throws {
        let vault = MemorySessionEnvelopeStore(
            envelope: .init(
                version: 1,
                cookies: [
                    .init(
                        name: "better-auth.session_token",
                        value: "session-a",
                        domain: "other.neima.me",
                        path: "/",
                        secure: true,
                        expiresAt: nil
                    ),
                ]
            )
        )
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: Self.cookieStorage(),
            envelopeStore: vault
        )

        await XCTAssertThrowsErrorAsync {
            _ = try await controller.restore()
        }
        let saved = await vault.savedEnvelope()
        XCTAssertNil(saved)
    }

    private static func cookieStorage() -> HTTPCookieStorage {
        HTTPCookieStorage.sharedCookieStorage(
            forGroupContainerIdentifier: "NativeSessionTests.\(UUID())"
        )
    }

    private static func cookie(
        name: String,
        value: String,
        domain: String,
        path: String
    ) throws -> HTTPCookie {
        try XCTUnwrap(
            HTTPCookie(
                properties: [
                    .name: name,
                    .value: value,
                    .domain: domain,
                    .path: path,
                    .secure: "TRUE",
                ]
            )
        )
    }
}

actor MemorySessionEnvelopeStore: SessionEnvelopeStoring {
    private var envelope: NativeSessionEnvelope?

    init(envelope: NativeSessionEnvelope? = nil) {
        self.envelope = envelope
    }

    func load() -> NativeSessionEnvelope? {
        envelope
    }

    func save(_ envelope: NativeSessionEnvelope) {
        self.envelope = envelope
    }

    func clear() {
        envelope = nil
    }

    func savedEnvelope() -> NativeSessionEnvelope? {
        envelope
    }
}

private func XCTAssertThrowsErrorAsync(
    _ expression: () async throws -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
) async {
    do {
        try await expression()
        XCTFail("Expected expression to throw", file: file, line: line)
    } catch {
        // Expected.
    }
}
