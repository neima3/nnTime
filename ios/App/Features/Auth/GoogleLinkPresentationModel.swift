import Foundation
import Observation

@Observable
@MainActor
final class GoogleLinkPresentationModel {
    enum State: Equatable {
        case loadingAvailability
        case unavailable
        case ready
        case linking
        case linked
        case sessionRequired
        case failed(String)
    }

    private(set) var state: State = .loadingAvailability
    private(set) var showsControl = false

    var canRetry: Bool {
        switch state {
        case .sessionRequired, .failed:
            true
        case .loadingAvailability, .unavailable, .ready, .linking, .linked:
            false
        }
    }

    var errorMessage: String? {
        switch state {
        case .sessionRequired:
            "Please sign in again."
        case let .failed(message):
            message
        case .loadingAvailability, .unavailable, .ready, .linking, .linked:
            nil
        }
    }

    func loadConnection(
        capabilities loadCapabilities: () async throws
            -> NativeAuthCapabilities,
        isLinked loadLinkedState: () async throws -> Bool
    ) async {
        state = .loadingAvailability
        showsControl = false
        do {
            let capabilities = try await loadCapabilities()
            showsControl = capabilities.google
            guard capabilities.google else {
                state = .unavailable
                return
            }
            state = try await loadLinkedState() ? .linked : .ready
        } catch {
            if AppSessionFailure.classify(error) == .unauthorized {
                state = .sessionRequired
            } else if showsControl {
                state = .failed(
                    "Couldn't verify your Google connection. Try again."
                )
            } else {
                state = .unavailable
            }
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
        } catch {
            state = .failed(
                (error as? LocalizedError)?.errorDescription
                    ?? "Google authentication couldn't be completed. Try again."
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
