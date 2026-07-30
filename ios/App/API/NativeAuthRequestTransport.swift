import Foundation

protocol NativeAuthRequestTransport {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: NativeAuthRequestTransport {}
