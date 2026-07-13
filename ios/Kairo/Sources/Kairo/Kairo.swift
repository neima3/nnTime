import OpenAPIRuntime
import OpenAPIURLSession
import Foundation

public struct KairoClient: Sendable {
    public let client: Client
    public init(baseURL: URL = URL(string: "https://time.neima.me/api/v1")!, session: URLSession = .shared) {
        self.client = Client(
            serverURL: baseURL,
            transport: URLSessionTransport(configuration: .init(session: session))
        )
    }
}
