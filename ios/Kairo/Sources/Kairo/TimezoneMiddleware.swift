import Foundation
import HTTPTypes
import OpenAPIRuntime

public struct TimezoneMiddleware: ClientMiddleware {
    private let timezoneIdentifierProvider: @Sendable () -> String

    public init() {
        timezoneIdentifierProvider = { TimeZone.current.identifier }
    }

    public init(timezoneIdentifier: String) {
        timezoneIdentifierProvider = { timezoneIdentifier }
    }

    public init(
        timezoneIdentifierProvider: @escaping @Sendable () -> String
    ) {
        self.timezoneIdentifierProvider = timezoneIdentifierProvider
    }

    public func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: @Sendable (
            HTTPRequest,
            HTTPBody?,
            URL
        ) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        let headerName = HTTPField.Name("x-timezone")!
        if request.headerFields[headerName] == nil {
            request.headerFields[headerName] = timezoneIdentifierProvider()
        }
        return try await next(request, body, baseURL)
    }
}
