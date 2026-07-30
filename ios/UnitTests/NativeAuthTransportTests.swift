import Foundation
import HTTPTypes
import KairoAPIClient
import Network
import OpenAPIRuntime
import XCTest
@testable import Kairo

final class NativeAuthTransportTests: XCTestCase {
    override func tearDown() {
        NativeAuthURLProtocol.reset()
        super.tearDown()
    }

    func testGeneratedCapabilityChallengeAndExchangeOperations() async throws {
        let recorder = NativeAuthOperationRecorder()
        let storage = Self.cookieStorage()
        storage.setCookie(try Self.sessionCookie(value: "session-a"))
        let vault = MemorySessionEnvelopeStore()
        let session = Self.session(storage: storage)
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: vault
        )
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            plannerTransport: NativeAuthPlannerTransport(recorder: recorder),
            session: session,
            sessionController: controller,
            timezoneIdentifierProvider: { "UTC" },
            idempotencyKeyProvider: { UUID().uuidString }
        )

        let capabilities = try await api.authCapabilities()
        XCTAssertEqual(
            capabilities,
            .init(magicLink: true, apple: true, google: true)
        )

        let challenge = try await api.appleChallenge(intent: .signIn)
        XCTAssertEqual(challenge.state, "state-1")
        XCTAssertEqual(challenge.nonce, "nonce-1")

        let result = try await api.exchangeAppleCredential(
            intent: .signIn,
            challenge: challenge,
            idToken: "identity-token"
        )
        XCTAssertEqual(result?.scope.count, 64)
        let savedSignInEnvelope = await vault.savedEnvelope()
        XCTAssertNotNil(savedSignInEnvelope)
        let signInScope = await api.sessionScope()
        XCTAssertNotNil(signInScope)

        let linkBaselineEnvelope = await vault.savedEnvelope()
        let linkBaselineScope = await api.sessionScope()
        _ = try await api.appleChallenge(intent: .link)
        let linkResult = try await api.exchangeAppleCredential(
            intent: .link,
            challenge: challenge,
            idToken: "identity-token"
        )
        XCTAssertNil(linkResult)
        let linkedEnvelope = await vault.savedEnvelope()
        let linkedScope = await api.sessionScope()
        XCTAssertEqual(linkedEnvelope, linkBaselineEnvelope)
        XCTAssertEqual(linkedScope, linkBaselineScope)

        let captures = await recorder.captures
        XCTAssertEqual(captures.map(\.operationID), [
            "getAuthCapabilities",
            "createAppleAuthChallenge",
            "exchangeAppleCredential",
            "createAppleAuthChallenge",
            "exchangeAppleCredential",
        ])
        XCTAssertEqual(
            try Self.jsonBody(captures[1].body)["intent"] as? String,
            "sign_in"
        )
        XCTAssertEqual(
            try Self.jsonBody(captures[3].body)["intent"] as? String,
            "link"
        )
        XCTAssertEqual(
            try Self.jsonBody(captures[2].body)["idToken"] as? String,
            "identity-token"
        )
    }

    func testRealGeneratedAppleSignInTransportPersistsResponseCookie() async throws {
        let server = try await LocalAppleAuthHTTPServer.start()
        defer { server.stop() }
        let storage = Self.cookieStorage()
        let vault = MemorySessionEnvelopeStore()
        let session = KairoClient.makeSharedCookieSession(
            cookieStorage: storage
        )
        let api = KairoAPI(
            baseURL: server.baseURL,
            session: session,
            sessionController: NativeSessionController(
                baseURL: server.baseURL,
                cookieStorage: storage,
                envelopeStore: vault
            )
        )

        let challenge = try await api.appleChallenge(intent: .signIn)
        let result = try await api.exchangeAppleCredential(
            intent: .signIn,
            challenge: challenge,
            idToken: "identity-token"
        )

        XCTAssertEqual(result?.scope.count, 64)
        let savedEnvelope = await vault.savedEnvelope()
        let savedScope = await api.sessionScope()
        XCTAssertNotNil(savedEnvelope)
        XCTAssertNotNil(savedScope)
        XCTAssertEqual(
            (storage.cookies ?? []).first {
                $0.name == "better-auth.session_token"
            }?.value,
            "apple-session"
        )
    }

    func testMagicRequestMarksIOSAndRedemptionPersistsSharedCookie() async throws {
        let storage = Self.cookieStorage()
        NativeAuthURLProtocol.install([
            .init(status: 200, body: #"{"status":true}"#),
            .init(
                status: 200,
                body: #"{"token":"session-token"}"#,
                headers: [
                    "Set-Cookie":
                        "better-auth.session_token=session-a; Path=/; Secure; HttpOnly",
                ],
                cookieStorage: storage
            ),
        ])
        let vault = MemorySessionEnvelopeStore()
        let transport = CapturingNativeAuthTransport(
            session: Self.session(storage: storage)
        )
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            session: transport.session,
            authTransport: transport,
            sessionController: NativeSessionController(
                baseURL: URL(string: "https://time.neima.me")!,
                cookieStorage: storage,
                envelopeStore: vault
            )
        )

        try await api.requestMagicLink(email: "synthetic@example.test")
        let result = try await api.redeemMagicLink(token: "opaque-token")

        XCTAssertEqual(result.scope.count, 64)
        let savedMagicEnvelope = await vault.savedEnvelope()
        XCTAssertNotNil(savedMagicEnvelope)
        let requests = await transport.requests()
        XCTAssertEqual(
            requests.map { $0.url?.path },
            [
                "/api/auth/sign-in/magic-link",
                "/api/auth/magic-link/verify",
            ]
        )
        let requestBody = try XCTUnwrap(requests[0].httpBody)
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: requestBody)
                as? [String: Any]
        )
        XCTAssertEqual(json["email"] as? String, "synthetic@example.test")
        XCTAssertEqual(
            (json["metadata"] as? [String: String])?["platform"],
            "ios"
        )
        XCTAssertEqual(
            URLComponents(
                url: try XCTUnwrap(requests[1].url),
                resolvingAgainstBaseURL: false
            )?.queryItems,
            [URLQueryItem(name: "token", value: "opaque-token")]
        )
    }

    func testMagicProviderErrorDoesNotPurgeValidSession() async throws {
        NativeAuthURLProtocol.install([
            .init(
                status: 400,
                body:
                    #"{"error":{"code":"invalid_token","message":"Link expired","retryable":false}}"#
            ),
        ])
        let storage = Self.cookieStorage()
        storage.setCookie(try Self.sessionCookie(value: "session-a"))
        let vault = MemorySessionEnvelopeStore()
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: vault
        )
        _ = try await controller.persist()
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            session: Self.session(storage: storage),
            sessionController: controller
        )

        do {
            _ = try await api.redeemMagicLink(token: "expired-token")
            XCTFail("Expected provider error")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 400)
        }

        let savedEnvelope = await vault.savedEnvelope()
        let sessionScope = await api.sessionScope()
        XCTAssertNotNil(savedEnvelope)
        XCTAssertNotNil(sessionScope)
    }

    func testMagicCancellationRemainsCancellationError() async throws {
        NativeAuthURLProtocol.install([
            .init(
                status: 0,
                body: "",
                urlErrorCode: .cancelled
            ),
        ])
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            session: Self.session(storage: Self.cookieStorage())
        )

        do {
            try await api.requestMagicLink(email: "synthetic@example.test")
            XCTFail("Expected cancellation")
        } catch {
            XCTAssertTrue(error is CancellationError)
        }
    }

    func testMagicUnauthorizedInvalidatesValidSession() async throws {
        NativeAuthURLProtocol.install([
            .init(
                status: 401,
                body:
                    #"{"error":{"code":"unauthorized","message":"Sign in again","retryable":false}}"#
            ),
        ])
        let storage = Self.cookieStorage()
        storage.setCookie(try Self.sessionCookie(value: "session-a"))
        let vault = MemorySessionEnvelopeStore()
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: vault
        )
        _ = try await controller.persist()
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            session: Self.session(storage: storage),
            sessionController: controller
        )

        do {
            try await api.requestMagicLink(email: "synthetic@example.test")
            XCTFail("Expected unauthorized")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 401)
        }

        let savedEnvelope = await vault.savedEnvelope()
        let sessionScope = await api.sessionScope()
        XCTAssertNil(savedEnvelope)
        XCTAssertNil(sessionScope)
    }

    func testAppleLinkInvalidCredentialPreservesValidSession() async throws {
        let recorder = NativeAuthOperationRecorder()
        let storage = Self.cookieStorage()
        storage.setCookie(try Self.sessionCookie(value: "session-a"))
        let vault = MemorySessionEnvelopeStore()
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: vault
        )
        _ = try await controller.persist()
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            plannerTransport: NativeAuthPlannerTransport(
                recorder: recorder,
                exchangeStatus: .badRequest
            ),
            session: Self.session(storage: storage),
            sessionController: controller,
            timezoneIdentifierProvider: { "UTC" },
            idempotencyKeyProvider: { UUID().uuidString }
        )
        let challenge = try await api.appleChallenge(intent: .link)

        do {
            _ = try await api.exchangeAppleCredential(
                intent: .link,
                challenge: challenge,
                idToken: "identity-token"
            )
            XCTFail("Expected invalid credential")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 400)
        }

        let savedEnvelope = await vault.savedEnvelope()
        let sessionScope = await api.sessionScope()
        XCTAssertNotNil(savedEnvelope)
        XCTAssertNotNil(sessionScope)
    }

    func testGoogleSignInPostsExactTokenBodyAndPersistsResponseCookie() async throws {
        let storage = Self.cookieStorage()
        NativeAuthURLProtocol.install([
            .init(
                status: 200,
                body: #"{"redirect":false,"token":"session-token"}"#,
                headers: [
                    "Set-Cookie":
                        "better-auth.session_token=google-session; Path=/; Secure; HttpOnly",
                ],
                cookieStorage: storage
            ),
        ])
        let vault = MemorySessionEnvelopeStore()
        let transport = CapturingNativeAuthTransport(
            session: Self.session(storage: storage)
        )
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            session: transport.session,
            authTransport: transport,
            sessionController: NativeSessionController(
                baseURL: URL(string: "https://time.neima.me")!,
                cookieStorage: storage,
                envelopeStore: vault
            )
        )

        let result = try await api.googleSignIn(
            credential: .init(
                idToken: "google-id-token",
                accessToken: "google-access-token"
            )
        )

        XCTAssertEqual(result.scope.count, 64)
        let savedEnvelope = await vault.savedEnvelope()
        XCTAssertNotNil(savedEnvelope)
        let capturedRequests = await transport.requests()
        let request = try XCTUnwrap(capturedRequests.first)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/auth/sign-in/social")
        let encodedBody = try XCTUnwrap(request.httpBody)
        XCTAssertEqual(
            try Self.jsonBody(encodedBody)
                as NSDictionary,
            [
                "provider": "google",
                "idToken": [
                    "token": "google-id-token",
                    "accessToken": "google-access-token",
                ],
            ] as NSDictionary
        )
    }

    func testGoogleLinkIsAuthenticatedAndPreservesSessionEnvelopeAndScope() async throws {
        let storage = Self.cookieStorage()
        storage.setCookie(try Self.sessionCookie(value: "session-a"))
        let vault = MemorySessionEnvelopeStore()
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: vault
        )
        let baseline = try await controller.persist()
        let baselineEnvelope = await vault.savedEnvelope()
        NativeAuthURLProtocol.install([
            .init(status: 200, body: #"{"status":true}"#),
        ])
        let transport = CapturingNativeAuthTransport(
            session: Self.session(storage: storage)
        )
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            session: transport.session,
            authTransport: transport,
            sessionController: controller
        )

        try await api.googleLink(
            credential: .init(
                idToken: "google-id-token",
                accessToken: "google-access-token"
            )
        )

        let capturedRequests = await transport.requests()
        let request = try XCTUnwrap(capturedRequests.first)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/auth/link-social")
        XCTAssertTrue(
            try XCTUnwrap(request.value(forHTTPHeaderField: "Cookie"))
                .contains("better-auth.session_token=session-a")
        )
        let encodedBody = try XCTUnwrap(request.httpBody)
        XCTAssertEqual(
            try Self.jsonBody(encodedBody)
                as NSDictionary,
            [
                "provider": "google",
                "idToken": [
                    "token": "google-id-token",
                    "accessToken": "google-access-token",
                ],
            ] as NSDictionary
        )
        let persistedEnvelope = await vault.savedEnvelope()
        let retainedScope = await api.sessionScope()
        XCTAssertEqual(persistedEnvelope, baselineEnvelope)
        XCTAssertEqual(retainedScope, baseline.scope)
    }

    func testGoogleAccountConflictFlowsFromTransportToEmailFirstGuidance()
        async throws
    {
        let (api, vault) = try await Self.googleAPIWithPersistedSession(
            fixture: .init(
                status: 401,
                body:
                    #"{"code":"OAUTH_LINK_ERROR","message":"opaque provider payload"}"#
            )
        )
        let baselineEnvelope = await vault.savedEnvelope()
        let model = await MainActor.run { SignInPresentationModel() }

        let result = await model.authenticate(using: .google) {
            try await api.googleSignIn(
                credential: .init(idToken: "id", accessToken: "access")
            )
        }

        XCTAssertNil(result)
        let status = await MainActor.run { model.status }
        XCTAssertEqual(status, .duplicateAccount)
        let retainedEnvelope = await vault.savedEnvelope()
        XCTAssertEqual(retainedEnvelope, baselineEnvelope)
    }

    func testReviewedNonConflictGoogleFailureStaysGenericInPresentation()
        async throws
    {
        let (api, vault) = try await Self.googleAPIWithPersistedSession(
            fixture: .init(
                status: 401,
                body:
                    #"{"code":"INVALID_TOKEN","message":"raw provider payload"}"#
            )
        )
        let baselineEnvelope = await vault.savedEnvelope()
        let model = await MainActor.run { SignInPresentationModel() }

        let result = await model.authenticate(using: .google) {
            try await api.googleSignIn(
                credential: .init(idToken: "id", accessToken: "access")
            )
        }

        XCTAssertNil(result)
        let status = await MainActor.run { model.status }
        XCTAssertEqual(
            status,
            .failed(
                "Google authentication couldn't be completed. Try again."
            )
        )
        XCTAssertFalse(String(describing: status).contains("INVALID_TOKEN"))
        XCTAssertFalse(String(describing: status).contains("raw provider"))
        let retainedEnvelope = await vault.savedEnvelope()
        XCTAssertEqual(retainedEnvelope, baselineEnvelope)
    }

    func testGoogleLinkedStateUsesAuthenticatedClosedAccountInventory()
        async throws
    {
        let storage = Self.cookieStorage()
        storage.setCookie(try Self.sessionCookie(value: "session-a"))
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: MemorySessionEnvelopeStore()
        )
        _ = try await controller.persist()
        NativeAuthURLProtocol.install([
            .init(
                status: 200,
                body:
                    #"[{"providerId":"credential"},{"providerId":"Google"},{"providerId":"google","accessToken":"must-not-escape"}]"#
            ),
        ])
        let transport = CapturingNativeAuthTransport(
            session: Self.session(storage: storage)
        )
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            session: transport.session,
            authTransport: transport,
            sessionController: controller
        )

        let linked = try await api.isGoogleAccountLinked()
        XCTAssertTrue(linked)
        let requests = await transport.requests()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.url?.path, "/api/auth/list-accounts")
        XCTAssertNil(request.httpBody)
        XCTAssertTrue(
            try XCTUnwrap(request.value(forHTTPHeaderField: "Cookie"))
                .contains("better-auth.session_token=session-a")
        )
    }

    func testGoogleLinkedStateRejectsNonCanonicalProviderSpelling()
        async throws
    {
        let (api, _) = try await Self.googleAPIWithPersistedSession(
            fixture: .init(
                status: 200,
                body:
                    #"[{"providerId":"Google"},{"providerId":"google-oauth"}]"#
            )
        )

        let linked = try await api.isGoogleAccountLinked()
        XCTAssertFalse(linked)
    }

    func testGoogleAccountInventory401InvalidatesSession() async throws {
        let (api, vault) = try await Self.googleAPIWithPersistedSession(
            fixture: .init(
                status: 401,
                body: #"{"code":"UNAUTHORIZED","message":"Expired"}"#
            )
        )

        do {
            _ = try await api.isGoogleAccountLinked()
            XCTFail("Expected account inventory to require a valid session")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 401)
        }

        let envelope = await vault.savedEnvelope()
        let scope = await api.sessionScope()
        XCTAssertNil(envelope)
        XCTAssertNil(scope)
    }

    func testGoogleProviderErrorIsRedactedAndPreservesValidSession() async throws {
        let storage = Self.cookieStorage()
        storage.setCookie(try Self.sessionCookie(value: "session-a"))
        let vault = MemorySessionEnvelopeStore()
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: vault
        )
        let baseline = try await controller.persist()
        let baselineEnvelope = await vault.savedEnvelope()
        NativeAuthURLProtocol.install([
            .init(
                status: 400,
                body:
                    #"{"message":"google-id-token google-access-token provider payload"}"#
            ),
        ])
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            session: Self.session(storage: storage),
            sessionController: controller
        )

        do {
            try await api.googleLink(
                credential: .init(
                    idToken: "google-id-token",
                    accessToken: "google-access-token"
                )
            )
            XCTFail("Expected provider error")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 400)
            XCTAssertEqual(
                error.errorDescription,
                "Google authentication couldn't be completed. Try again."
            )
            XCTAssertFalse(
                String(describing: error).contains("google-id-token")
            )
            XCTAssertFalse(
                String(describing: error).contains("google-access-token")
            )
        }

        let persistedEnvelope = await vault.savedEnvelope()
        let retainedScope = await api.sessionScope()
        XCTAssertEqual(persistedEnvelope, baselineEnvelope)
        XCTAssertEqual(retainedScope, baseline.scope)
    }

    func testReviewedGoogle401CodesPreserveValidSessionByEndpoint()
        async throws
    {
        let cases: [(GoogleIdentityEndpoint, String)] = [
            (.signIn, "INVALID_TOKEN"),
            (.signIn, "FAILED_TO_GET_USER_INFO"),
            (.signIn, "USER_EMAIL_NOT_FOUND"),
            (.signIn, "OAUTH_LINK_ERROR"),
            (.link, "INVALID_TOKEN"),
            (.link, "FAILED_TO_GET_USER_INFO"),
            (.link, "USER_EMAIL_NOT_FOUND"),
            (.link, "LINKING_NOT_ALLOWED"),
            (.link, "LINKING_DIFFERENT_EMAILS_NOT_ALLOWED"),
        ]

        for (endpoint, code) in cases {
            let (api, vault) = try await Self.googleAPIWithPersistedSession(
                fixture: .init(
                    status: 401,
                    body: #"{"code":"\#(code)","message":"Provider error"}"#
                )
            )
            let baselineEnvelope = await vault.savedEnvelope()
            let baselineScope = await api.sessionScope()

            await Self.assertGoogle401(api: api, endpoint: endpoint)

            let envelope = await vault.savedEnvelope()
            let scope = await api.sessionScope()
            XCTAssertEqual(envelope, baselineEnvelope, "\(endpoint): \(code)")
            XCTAssertEqual(scope, baselineScope, "\(endpoint): \(code)")
        }
    }

    func testGoogle401DefaultDenyInvalidatesByEndpoint() async throws {
        let cases: [(GoogleIdentityEndpoint, String?)] = [
            (.signIn, "LINKING_NOT_ALLOWED"),
            (.signIn, "LINKING_DIFFERENT_EMAILS_NOT_ALLOWED"),
            (.link, "OAUTH_LINK_ERROR"),
            (.signIn, "UNAUTHORIZED"),
            (.link, "UNAUTHORIZED"),
            (.signIn, "UNKNOWN_PROVIDER_CODE"),
            (.link, "UNKNOWN_PROVIDER_CODE"),
            (.signIn, nil),
            (.link, nil),
        ]

        for (endpoint, code) in cases {
            let body = code.map {
                #"{"code":"\#($0)","message":"Provider error"}"#
            } ?? #"{"message":"Provider error"}"#
            let (api, vault) = try await Self.googleAPIWithPersistedSession(
                fixture: .init(status: 401, body: body)
            )

            await Self.assertGoogle401(api: api, endpoint: endpoint)

            let envelope = await vault.savedEnvelope()
            let scope = await api.sessionScope()
            XCTAssertNil(envelope, "\(endpoint): \(code ?? "missing")")
            XCTAssertNil(scope, "\(endpoint): \(code ?? "missing")")
        }
    }

    func testLateGoogleSignInCannotRestoreSessionAfterSignOut() async throws {
        let storage = Self.cookieStorage()
        storage.setCookie(try Self.sessionCookie(value: "session-a"))
        let vault = MemorySessionEnvelopeStore()
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: vault
        )
        _ = try await controller.persist()
        let responseGate = NativeAuthResponseGate()
        NativeAuthURLProtocol.install([
            .init(
                status: 200,
                body: #"{"redirect":false,"token":"late"}"#,
                headers: [
                    "Set-Cookie":
                        "better-auth.session_token=late-session; Path=/; Secure; HttpOnly",
                ],
                cookieStorage: storage,
                responseGate: responseGate
            ),
            .init(status: 200, body: #"{"status":true}"#),
        ])
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            session: Self.session(storage: storage),
            sessionController: controller
        )
        let signIn = Task {
            try await api.googleSignIn(
                credential: .init(idToken: "id", accessToken: "access")
            )
        }
        while NativeAuthURLProtocol.requests().isEmpty {
            await Task.yield()
        }

        await api.signOut()
        responseGate.open()

        do {
            _ = try await signIn.value
            XCTFail("Expected stale sign-in cancellation")
        } catch {
            XCTAssertTrue(error is CancellationError)
        }
        let envelope = await vault.savedEnvelope()
        let scope = await api.sessionScope()
        XCTAssertNil(envelope)
        XCTAssertNil(scope)
        XCTAssertFalse(
            (storage.cookies ?? []).contains {
                $0.name == "better-auth.session_token"
            }
        )
    }

    private static func googleAPIWithPersistedSession(
        fixture: NativeAuthURLProtocol.Fixture
    ) async throws -> (KairoAPI, MemorySessionEnvelopeStore) {
        let storage = cookieStorage()
        storage.setCookie(try sessionCookie(value: "session-a"))
        let vault = MemorySessionEnvelopeStore()
        let controller = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: storage,
            envelopeStore: vault
        )
        _ = try await controller.persist()
        NativeAuthURLProtocol.install([fixture])
        return (
            KairoAPI(
                baseURL: URL(string: "https://time.neima.me")!,
                session: session(storage: storage),
                sessionController: controller
            ),
            vault
        )
    }

    private static func assertGoogle401(
        api: KairoAPI,
        endpoint: GoogleIdentityEndpoint
    ) async {
        do {
            switch endpoint {
            case .signIn:
                _ = try await api.googleSignIn(
                    credential: .init(idToken: "bad", accessToken: "bad")
                )
            case .link:
                try await api.googleLink(
                    credential: .init(idToken: "bad", accessToken: "bad")
                )
            }
            XCTFail("Expected Google 401 for \(endpoint)")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 401)
            XCTAssertEqual(
                error.errorDescription,
                "Google authentication couldn't be completed. Try again."
            )
        } catch {
            XCTFail("Unexpected error for \(endpoint): \(error)")
        }
    }

    private static func cookieStorage() -> HTTPCookieStorage {
        .sharedCookieStorage(
            forGroupContainerIdentifier: "NativeAuthTransport.\(UUID())"
        )
    }

    private static func session(storage: HTTPCookieStorage) -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = storage
        configuration.httpShouldSetCookies = true
        configuration.protocolClasses = [NativeAuthURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    private static func sessionCookie(value: String) throws -> HTTPCookie {
        try XCTUnwrap(
            HTTPCookie(
                properties: [
                    .name: "better-auth.session_token",
                    .value: value,
                    .domain: "time.neima.me",
                    .path: "/",
                    .secure: "TRUE",
                ]
            )
        )
    }

    private static func jsonBody(
        _ body: String
    ) throws -> [String: Any] {
        try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(body.utf8))
                as? [String: Any]
        )
    }

    private static func jsonBody(
        _ body: Data
    ) throws -> [String: Any] {
        try XCTUnwrap(
            JSONSerialization.jsonObject(with: body)
                as? [String: Any]
        )
    }
}

private enum GoogleIdentityEndpoint {
    case signIn
    case link
}

private final class LocalAppleAuthHTTPServer {
    enum ServerError: Error {
        case stoppedBeforeReady
    }

    private let listener: NWListener
    private let queue = DispatchQueue(
        label: "NativeAuthTransportTests.local-http"
    )
    private let lock = NSLock()
    private var responseIndex = 0
    private(set) var baseURL = URL(string: "http://127.0.0.1")!

    private init(listener: NWListener) {
        self.listener = listener
    }

    static func start() async throws -> LocalAppleAuthHTTPServer {
        let server = LocalAppleAuthHTTPServer(
            listener: try NWListener(using: .tcp, on: .any)
        )
        try await server.startListening()
        return server
    }

    func stop() {
        listener.cancel()
    }

    private func startListening() async throws {
        try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<Void, Error>) in
            let gate = ListenerContinuationGate(continuation)

            listener.stateUpdateHandler = { [weak self] state in
                guard let self else { return }
                switch state {
                case .ready:
                    guard let port = self.listener.port else {
                        gate.resume(.failure(ServerError.stoppedBeforeReady))
                        return
                    }
                    self.baseURL = URL(
                        string: "http://127.0.0.1:\(port.rawValue)"
                    )!
                    gate.resume(.success(()))
                case let .failed(error):
                    gate.resume(.failure(error))
                case .cancelled:
                    gate.resume(.failure(ServerError.stoppedBeforeReady))
                default:
                    break
                }
            }
            listener.newConnectionHandler = { [weak self] connection in
                self?.serve(connection)
            }
            listener.start(queue: queue)
        }
    }

    private func serve(_ connection: NWConnection) {
        connection.start(queue: queue)
        connection.receive(
            minimumIncompleteLength: 1,
            maximumLength: 65_536
        ) { [weak self] _, _, _, error in
            guard let self, error == nil else {
                connection.cancel()
                return
            }
            let index = lock.withLock {
                defer { self.responseIndex += 1 }
                return self.responseIndex
            }
            let response = index == 0
                ? Self.challengeResponse
                : Self.exchangeResponse
            connection.send(
                content: Data(response.utf8),
                completion: .contentProcessed { _ in
                    connection.cancel()
                }
            )
        }
    }

    private static let challengeResponse = httpResponse(
        status: "201 Created",
        body:
            #"{"state":"state-1","nonce":"nonce-1","expiresAt":"2026-07-29T12:05:00Z"}"#
    )

    private static let exchangeResponse = httpResponse(
        status: "200 OK",
        body: #"{"redirect":false,"status":true}"#,
        headers: [
            "Set-Cookie":
                "better-auth.session_token=apple-session; Path=/; HttpOnly; SameSite=Lax",
        ]
    )

    private static func httpResponse(
        status: String,
        body: String,
        headers: [String: String] = [:]
    ) -> String {
        let customHeaders = headers
            .map { "\($0.key): \($0.value)\r\n" }
            .joined()
        return """
        HTTP/1.1 \(status)\r
        Content-Type: application/json\r
        Content-Length: \(body.utf8.count)\r
        Connection: close\r
        \(customHeaders)\r
        \(body)
        """
    }
}

private final class ListenerContinuationGate: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<Void, Error>?

    init(_ continuation: CheckedContinuation<Void, Error>) {
        self.continuation = continuation
    }

    func resume(_ result: Result<Void, Error>) {
        lock.withLock {
            guard let continuation else { return }
            self.continuation = nil
            continuation.resume(with: result)
        }
    }
}

private actor NativeAuthOperationRecorder {
    struct Capture: Sendable {
        let operationID: String
        let body: String
    }

    private(set) var captures: [Capture] = []

    func record(_ capture: Capture) {
        captures.append(capture)
    }
}

private struct NativeAuthPlannerTransport: ClientTransport {
    let recorder: NativeAuthOperationRecorder
    var exchangeStatus: HTTPResponse.Status = .ok

    func send(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String
    ) async throws -> (HTTPResponse, HTTPBody?) {
        let data = try await Data(
            collecting: body ?? HTTPBody(),
            upTo: 1_000_000
        )
        await recorder.record(.init(
            operationID: operationID,
            body: String(decoding: data, as: UTF8.self)
        ))
        let response: (HTTPResponse.Status, String)
        switch operationID {
        case "getAuthCapabilities":
            response = (
                .ok,
                #"{"magicLink":true,"apple":true,"google":true}"#
            )
        case "createAppleAuthChallenge":
            response = (
                .created,
                #"{"state":"state-1","nonce":"nonce-1","expiresAt":"2026-07-29T12:05:00Z"}"#
            )
        case "exchangeAppleCredential":
            if exchangeStatus == .unauthorized {
                response = (
                    .unauthorized,
                    #"{"error":{"code":"unauthorized","message":"Sign in again","retryable":false}}"#
                )
            } else if exchangeStatus == .badRequest {
                response = (
                    .badRequest,
                    #"{"error":{"code":"invalid_credential","message":"Apple could not verify this sign-in.","retryable":false}}"#
                )
            } else {
                response = (.ok, #"{"redirect":false,"status":true}"#)
            }
        default:
            response = (.notFound, #"{}"#)
        }
        return (
            HTTPResponse(
                status: response.0,
                headerFields: [.contentType: "application/json"]
            ),
            HTTPBody(response.1)
        )
    }
}

private actor CapturingNativeAuthTransport: NativeAuthRequestTransport {
    nonisolated let session: URLSession
    private var captured: [URLRequest] = []

    init(session: URLSession) {
        self.session = session
    }

    func data(
        for request: URLRequest
    ) async throws -> (Data, URLResponse) {
        captured.append(request)
        return try await session.data(for: request)
    }

    func requests() -> [URLRequest] {
        captured
    }
}

private final class NativeAuthURLProtocol: URLProtocol {
    struct Fixture {
        let status: Int
        let body: String
        var headers: [String: String] = [:]
        var cookieStorage: HTTPCookieStorage?
        var urlErrorCode: URLError.Code?
        var responseGate: NativeAuthResponseGate?
    }

    nonisolated(unsafe) private static var fixtures: [Fixture] = []
    nonisolated(unsafe) private static var captured: [URLRequest] = []
    private static let lock = NSLock()

    static func install(_ values: [Fixture]) {
        lock.withLock {
            fixtures = values
            captured = []
        }
    }

    static func reset() {
        install([])
    }

    static func requests() -> [URLRequest] {
        lock.withLock { captured }
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(
        for request: URLRequest
    ) -> URLRequest {
        request
    }

    override func startLoading() {
        var capturedRequest = request
        if capturedRequest.httpBody == nil,
           let stream = capturedRequest.httpBodyStream
        {
            capturedRequest.httpBody = Self.read(stream)
            capturedRequest.httpBodyStream = nil
        }
        let fixture: Fixture? = Self.lock.withLock {
            Self.captured.append(capturedRequest)
            return Self.fixtures.isEmpty
                ? nil
                : Self.fixtures.removeFirst()
        }
        guard let fixture else {
            client?.urlProtocol(
                self,
                didFailWithError: URLError(.badServerResponse)
            )
            return
        }
        if let code = fixture.urlErrorCode {
            client?.urlProtocol(self, didFailWithError: URLError(code))
            return
        }
        let deliver = { [self] in
            var headers = fixture.headers
            headers["Content-Type"] = "application/json"
            if let storage = fixture.cookieStorage {
                storage.setCookies(
                    HTTPCookie.cookies(
                        withResponseHeaderFields: headers,
                        for: request.url!
                    ),
                    for: request.url,
                    mainDocumentURL: nil
                )
            }
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: fixture.status,
                httpVersion: nil,
                headerFields: headers
            )!
            client?.urlProtocol(
                self,
                didReceive: response,
                cacheStoragePolicy: .notAllowed
            )
            client?.urlProtocol(self, didLoad: Data(fixture.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }
        if let responseGate = fixture.responseGate {
            responseGate.hold(deliver)
        } else {
            deliver()
        }
    }

    override func stopLoading() {}

    private static func read(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4_096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count > 0 else {
                break
            }
            data.append(buffer, count: count)
        }
        return data
    }
}

private final class NativeAuthResponseGate: @unchecked Sendable {
    private let lock = NSLock()
    private var delivery: (() -> Void)?
    private var isOpen = false

    func hold(_ delivery: @escaping () -> Void) {
        let deliverImmediately = lock.withLock {
            if isOpen {
                return true
            }
            self.delivery = delivery
            return false
        }
        if deliverImmediately {
            delivery()
        }
    }

    func open() {
        let delivery = lock.withLock {
            isOpen = true
            defer { self.delivery = nil }
            return self.delivery
        }
        delivery?()
    }
}
