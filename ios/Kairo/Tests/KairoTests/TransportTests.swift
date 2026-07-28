import Foundation
import HTTPTypes
import OpenAPIRuntime
import Testing
@testable import KairoAPIClient

@Suite struct TransportTests {
    @Test func productionAndOverriddenServersIncludeAPIVersion() {
        #expect(KairoClient.productionServerURL.absoluteString == "https://time.neima.me/api/v1")

        let overridden = KairoClient(
            baseURL: URL(string: "http://127.0.0.1:3456/api/v1")!,
            transport: RecordingTransport(recorder: .init())
        )
        #expect(overridden.serverURL.absoluteString == "http://127.0.0.1:3456/api/v1")
    }

    @Test func sharedCookieSessionPersistsAuthenticationCookies() {
        let cookieStorage = HTTPCookieStorage()
        let session = KairoClient.makeSharedCookieSession(cookieStorage: cookieStorage)

        #expect(session.configuration.httpCookieStorage === cookieStorage)
        #expect(session.configuration.httpShouldSetCookies)
        #expect(session.configuration.timeoutIntervalForRequest == 20)
    }

    @Test func timezoneMiddlewareInjectsHeaderWithoutClobberingExplicitValue() async throws {
        let name = try #require(HTTPField.Name("x-timezone"))
        let middleware = TimezoneMiddleware(timezoneIdentifier: "America/New_York")
        let headers = HeaderRecorder()
        let request = HTTPRequest(
            method: .get,
            scheme: "https",
            authority: "time.neima.me",
            path: "/api/v1/settings"
        )

        _ = try await middleware.intercept(
            request,
            body: nil,
            baseURL: KairoClient.productionServerURL,
            operationID: "getUserSettings"
        ) { request, _, _ in
            await headers.record(request.headerFields[name])
            return (HTTPResponse(status: .ok), nil)
        }
        #expect(await headers.latest == "America/New_York")

        var explicit = request
        explicit.headerFields[name] = "Europe/Paris"
        _ = try await middleware.intercept(
            explicit,
            body: nil,
            baseURL: KairoClient.productionServerURL,
            operationID: "getUserSettings"
        ) { request, _, _ in
            await headers.record(request.headerFields[name])
            return (HTTPResponse(status: .ok), nil)
        }
        #expect(await headers.latest == "Europe/Paris")
    }

    @Test func timezoneMiddlewareEvaluatesItsProviderForEveryRequest() async throws {
        let name = try #require(HTTPField.Name("x-timezone"))
        let source = MutableTimezoneSource("America/New_York")
        let middleware = TimezoneMiddleware(
            timezoneIdentifierProvider: { source.timezoneIdentifier }
        )
        let headers = HeaderRecorder()
        let request = HTTPRequest(
            method: .get,
            scheme: "https",
            authority: "time.neima.me",
            path: "/api/v1/settings"
        )

        _ = try await middleware.intercept(
            request,
            body: nil,
            baseURL: KairoClient.productionServerURL,
            operationID: "getUserSettings"
        ) { request, _, _ in
            await headers.record(request.headerFields[name])
            return (HTTPResponse(status: .ok), nil)
        }
        #expect(await headers.latest == "America/New_York")

        source.timezoneIdentifier = "America/Chicago"
        _ = try await middleware.intercept(
            request,
            body: nil,
            baseURL: KairoClient.productionServerURL,
            operationID: "getUserSettings"
        ) { request, _, _ in
            await headers.record(request.headerFields[name])
            return (HTTPResponse(status: .ok), nil)
        }
        #expect(await headers.latest == "America/Chicago")

        var explicit = request
        explicit.headerFields[name] = "Europe/Paris"
        source.timezoneIdentifier = "America/Los_Angeles"
        _ = try await middleware.intercept(
            explicit,
            body: nil,
            baseURL: KairoClient.productionServerURL,
            operationID: "getUserSettings"
        ) { request, _, _ in
            await headers.record(request.headerFields[name])
            return (HTTPResponse(status: .ok), nil)
        }
        #expect(await headers.latest == "Europe/Paris")
    }

    @Test func injectedTransportCapturesGeneratedMethodPathQueryHeadersAndBody() async throws {
        let recorder = RequestRecorder()
        let kairo = KairoClient(
            baseURL: URL(string: "http://127.0.0.1:3456/api/v1")!,
            transport: RecordingTransport(recorder: recorder),
            middlewares: [TimezoneMiddleware(timezoneIdentifier: "America/Chicago")]
        )
        _ = try await kairo.client.listTasks(.init(query: .init(bucket: .inbox, limit: 10)))
        let input = Operations.createTask.Input(
            headers: .init(
                Idempotency_hyphen_Key: "0198f834-c9ab-7e12-b1cf-1faebad8f4fd"
            ),
            body: .json(.init(bucket: .inbox, title: "Capture"))
        )

        _ = try await kairo.client.createTask(input)

        let captures = await recorder.captures
        #expect(captures[0].method == "GET")
        #expect(captures[0].path == "/tasks?bucket=inbox&limit=10")

        let capture = try #require(captures.last)
        #expect(capture.method == "POST")
        #expect(capture.path == "/tasks")
        #expect(capture.baseURL.absoluteString == "http://127.0.0.1:3456/api/v1")
        #expect(capture.operationID == "createTask")
        #expect(capture.headers["idempotency-key"] == "0198f834-c9ab-7e12-b1cf-1faebad8f4fd")
        #expect(capture.headers["x-timezone"] == "America/Chicago")
        let body = try #require(
            JSONSerialization.jsonObject(with: Data(capture.body.utf8))
                as? [String: String]
        )
        #expect(body["title"] == "Capture")
        #expect(body["bucket"] == "inbox")
    }
}

private struct CapturedRequest: Sendable {
    let method: String
    let path: String
    let baseURL: URL
    let operationID: String
    let headers: [String: String]
    let body: String
}

private actor RequestRecorder {
    private(set) var captures: [CapturedRequest] = []

    func record(_ capture: CapturedRequest) {
        captures.append(capture)
    }
}

private actor HeaderRecorder {
    private(set) var latest: String?

    func record(_ value: String?) {
        latest = value
    }
}

private final class MutableTimezoneSource: @unchecked Sendable {
    private let lock = NSLock()
    private var value: String

    init(_ value: String) {
        self.value = value
    }

    var timezoneIdentifier: String {
        get {
            lock.withLock { value }
        }
        set {
            lock.withLock { value = newValue }
        }
    }
}

private struct RecordingTransport: ClientTransport {
    let recorder: RequestRecorder

    func send(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String
    ) async throws -> (HTTPResponse, HTTPBody?) {
        let bodyText = if let body {
            try await String(collecting: body, upTo: 1_000_000)
        } else {
            ""
        }
        let headers = Dictionary(
            uniqueKeysWithValues: request.headerFields.map {
                ($0.name.canonicalName, $0.value)
            }
        )
        await recorder.record(.init(
            method: request.method.rawValue,
            path: request.path ?? "",
            baseURL: baseURL,
            operationID: operationID,
            headers: headers,
            body: bodyText
        ))

        let (status, payload): (HTTPResponse.Status, String) = if operationID == "listTasks" {
            (
                .ok,
                """
                {"items":[],"nextCursor":null}
                """
            )
        } else {
            (
                .created,
                """
                {
                  "id":"0198f834-c9ab-7e12-b1cf-1faebad8f4fd",
                  "userId":"0198f834-c9ab-7e12-b1cf-1faebad8f4fe",
                  "bucket":"inbox",
                  "title":"Capture",
                  "priority":"none",
                  "revision":1,
                  "createdAt":"2026-07-28T12:00:00Z",
                  "updatedAt":"2026-07-28T12:00:00Z"
                }
                """
            )
        }
        return (
            HTTPResponse(
                status: status,
                headerFields: [.contentType: "application/json"]
            ),
            HTTPBody(payload)
        )
    }
}
