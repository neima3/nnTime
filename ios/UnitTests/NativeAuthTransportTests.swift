import Foundation
import HTTPTypes
import KairoAPIClient
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
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            plannerTransport: NativeAuthPlannerTransport(recorder: recorder),
            session: session,
            sessionController: NativeSessionController(
                baseURL: URL(string: "https://time.neima.me")!,
                cookieStorage: storage,
                envelopeStore: vault
            ),
            timezoneIdentifierProvider: { "UTC" },
            idempotencyKeyProvider: { UUID().uuidString }
        )

        let capabilities = try await api.authCapabilities()
        XCTAssertEqual(capabilities, .init(magicLink: true, apple: true))

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

        _ = try await api.appleChallenge(intent: .link)
        let linkResult = try await api.exchangeAppleCredential(
            intent: .link,
            challenge: challenge,
            idToken: "identity-token"
        )
        XCTAssertNil(linkResult)

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
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            session: Self.session(storage: storage),
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
        let requests = NativeAuthURLProtocol.requests()
        XCTAssertEqual(
            requests.map { $0.url?.path },
            [
                "/api/auth/sign-in/magic-link",
                "/api/auth/magic-link/verify",
            ]
        )
        let requestBody = try XCTUnwrap(
            KairoAPI.magicLinkRequest(
                baseURL: URL(string: "https://time.neima.me")!,
                email: "synthetic@example.test"
            ).httpBody
        )
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
            response = (.ok, #"{"magicLink":true,"apple":true}"#)
        case "createAppleAuthChallenge":
            response = (
                .created,
                #"{"state":"state-1","nonce":"nonce-1","expiresAt":"2026-07-29T12:05:00Z"}"#
            )
        case "exchangeAppleCredential":
            response = (.ok, #"{"redirect":false,"status":true}"#)
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

private final class NativeAuthURLProtocol: URLProtocol {
    struct Fixture {
        let status: Int
        let body: String
        var headers: [String: String] = [:]
        var cookieStorage: HTTPCookieStorage?
        var urlErrorCode: URLError.Code?
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
