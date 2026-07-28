import OpenAPIRuntime
import OpenAPIURLSession
import Foundation

private struct RFC3339DateTranscoder: DateTranscoder {
    private let fractional: ISO8601DateTranscoder =
        .iso8601WithFractionalSeconds
    private let wholeSeconds: ISO8601DateTranscoder = .iso8601

    func encode(_ date: Date) throws -> String {
        try wholeSeconds.encode(date)
    }

    func decode(_ dateString: String) throws -> Date {
        if let date = try? fractional.decode(dateString) {
            return date
        }
        return try wholeSeconds.decode(dateString)
    }
}

public struct KairoClient: Sendable {
    public static let productionServerURL = URL(
        string: "https://time.neima.me/api/v1"
    )!

    public let serverURL: URL
    public let client: Client

    public init(
        baseURL: URL = productionServerURL,
        session: URLSession = makeSharedCookieSession(),
        middlewares: [any ClientMiddleware] = [TimezoneMiddleware()]
    ) {
        self.init(
            baseURL: baseURL,
            transport: URLSessionTransport(
                configuration: .init(session: session)
            ),
            middlewares: middlewares
        )
    }

    public init(
        baseURL: URL = productionServerURL,
        transport: any ClientTransport,
        middlewares: [any ClientMiddleware] = [TimezoneMiddleware()]
    ) {
        serverURL = baseURL
        self.client = Client(
            serverURL: baseURL,
            configuration: .init(
                dateTranscoder: RFC3339DateTranscoder()
            ),
            transport: transport,
            middlewares: middlewares
        )
    }

    public static func makeSharedCookieSession(
        cookieStorage: HTTPCookieStorage = .shared
    ) -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = cookieStorage
        configuration.httpShouldSetCookies = true
        configuration.timeoutIntervalForRequest = 20
        return URLSession(configuration: configuration)
    }
}
