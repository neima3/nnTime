import Foundation
import HTTPTypes
import OpenAPIRuntime

public struct TimezoneMiddleware: ClientMiddleware {
    public let timezoneIdentifier: String

    public init(
        timezoneIdentifier: String = TimeZone.current.identifier
    ) {
        self.timezoneIdentifier = timezoneIdentifier
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
            request.headerFields[headerName] = timezoneIdentifier
        }
        return try await next(request, body, baseURL)
    }
}
