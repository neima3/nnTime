import Foundation
import Observation

@Observable
@MainActor
final class AppleLinkPresentationModel {
    enum State: Equatable {
        case loadingAvailability
        case unavailable
        case ready
        case linking
        case linked
        case expired
        case sessionRequired
        case failed(String)
    }

    private(set) var state: State = .loadingAvailability
    private(set) var showsControl = false

    var canRetry: Bool {
        switch state {
        case .expired, .sessionRequired, .failed:
            true
        case .loadingAvailability, .unavailable, .ready, .linking, .linked:
            false
        }
    }

    var errorMessage: String? {
        switch state {
        case .sessionRequired:
            "Please sign in again."
        case .expired:
            "This Apple connection request expired. Try again."
        case let .failed(message):
            message
        case .loadingAvailability, .unavailable, .ready, .linking, .linked:
            nil
        }
    }

    func loadAvailability(
        using load: () async throws -> NativeAuthCapabilities
    ) async {
        do {
            let capabilities = try await load()
            showsControl = capabilities.apple
            state = capabilities.apple ? .ready : .unavailable
        } catch {
            showsControl = false
            state = .unavailable
        }
    }

    func link(
        currentScope: String?,
        perform: () async throws -> Void
    ) async -> String? {
        guard state != .linking else {
            return nil
        }
        guard let currentScope else {
            state = .sessionRequired
            return nil
        }
        guard state != .linked else {
            return currentScope
        }

        state = .linking
        do {
            try await perform()
            state = .linked
            return currentScope
        } catch is CancellationError {
            state = .ready
            return nil
        } catch let error as APIError {
            if error.serverError?.code == "expired_challenge" {
                state = .expired
                return nil
            }
            state = .failed(
                error.errorDescription
                    ?? "Apple couldn’t be connected. Please try again."
            )
            return nil
        } catch {
            state = .failed(
                (error as? LocalizedError)?.errorDescription
                    ?? "Apple couldn’t be connected. Please try again."
            )
            return nil
        }
    }

    func retry() {
        guard canRetry else {
            return
        }
        state = .ready
    }

#if DEBUG
    func installFixture(state: State) {
        showsControl = state != .unavailable
        self.state = state
    }
#endif
}
