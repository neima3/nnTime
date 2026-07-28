import OpenAPIRuntime
import OpenAPIURLSession
import Foundation

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
