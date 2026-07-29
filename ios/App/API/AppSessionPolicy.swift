import Foundation

enum AppSessionFailure: Equatable {
    case unauthorized
    case network
    case rateLimited
    case server
    case decoding
    case other
    case cancelled

    static func classify(_ error: Error) -> AppSessionFailure {
        if error is CancellationError {
            return .cancelled
        }
        guard let apiError = error as? APIError else {
            return .other
        }
        switch apiError {
        case .unauthorized, .authUnauthorized:
            return .unauthorized
        case .network:
            return .network
        case .decoding:
            return .decoding
        case let .http(status, _),
             let .authHTTP(status, _):
            if status == 429 {
                return .rateLimited
            }
            if status >= 500 {
                return .server
            }
            return .other
        case .conflict:
            return .other
        }
    }
}

enum AppSessionDecision: Equatable {
    case signedInOnline(scope: String?)
    case signedInOffline(scope: String)
    case signedOut
    case connectionRequired(scope: String?)
    case unchanged
}

enum AppSessionPolicy {
    static func decide(
        scope: String?,
        hasMatchingCache: Bool,
        failure: AppSessionFailure?
    ) -> AppSessionDecision {
        guard let failure else {
            return .signedInOnline(scope: scope)
        }
        switch failure {
        case .unauthorized:
            return .signedOut
        case .cancelled:
            return .unchanged
        case .network, .rateLimited, .server, .decoding, .other:
            guard let scope, hasMatchingCache else {
                return .connectionRequired(scope: scope)
            }
            return .signedInOffline(scope: scope)
        }
    }
}
