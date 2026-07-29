import CryptoKit
import Foundation
import Observation

@Observable
@MainActor
final class NativeAuthCoordinator {
    enum Phase: Equatable {
        case idle
        case verifying
        case failed(String)
    }

    enum Outcome: Equatable {
        case ignored
        case duplicate
        case busy
        case completed
        case blocked
        case cancelled
        case failed
    }

    private(set) var phase: Phase = .idle
    private var inFlightCallbacks: Set<String> = []
    private var completedCallbacks: Set<String> = []

    var failureMessage: String? {
        guard case let .failed(message) = phase else {
            return nil
        }
        return message
    }

    func dismissFailure() {
        if case .failed = phase {
            phase = .idle
        }
    }

    func handle(
        _ url: URL,
        currentScope: String?,
        prepareForAuthentication: () async -> Void = {},
        redeem: (String) async throws
            -> NativeSessionController.PersistResult,
        prepareForAccountSwitch: (String) async -> Bool,
        bootstrap: () async -> Void
    ) async -> Outcome {
        guard let callback = AuthCallback.parse(url) else {
            return .ignored
        }
        let callbackKey = Self.digest(callback.token)
        guard !completedCallbacks.contains(callbackKey) else {
            return .duplicate
        }
        guard !inFlightCallbacks.contains(callbackKey) else {
            return .duplicate
        }
        guard inFlightCallbacks.isEmpty else {
            return .busy
        }

        inFlightCallbacks.insert(callbackKey)
        defer { inFlightCallbacks.remove(callbackKey) }
        phase = .verifying

        do {
            await prepareForAuthentication()
            let session: NativeSessionController.PersistResult =
                try await redeem(callback.token)
            if session.replacedScope != nil
                || currentScope.map({ $0 != session.scope }) == true
            {
                guard await prepareForAccountSwitch(session.scope) else {
                    phase = .idle
                    return .blocked
                }
            }
            await bootstrap()
            completedCallbacks.insert(callbackKey)
            phase = .idle
            return .completed
        } catch is CancellationError {
            phase = .idle
            return .cancelled
        } catch {
            phase = .failed(Self.message(for: error))
            return .failed
        }
    }

    private static func digest(_ token: String) -> String {
        SHA256.hash(data: Data(token.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    private static func message(for error: Error) -> String {
        if let localized = error as? LocalizedError,
           let description = localized.errorDescription,
           !description.isEmpty
        {
            return description
        }
        return "We couldn't finish signing you in. Request a new link and try again."
    }
}
