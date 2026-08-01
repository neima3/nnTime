import AppIntents
import Foundation

// MARK: - Focus Live Activity controls (H04)
//
// LiveActivityIntents run in the APP process, so these buttons remote-control
// the same focus machinery the Focus screen uses — no second transport, no
// widget-side state. The bridge is the seam: the app registers a handler at
// launch; in the widget process (which only renders) it stays nil.

enum FocusIntentAction: Equatable, Sendable {
    case setPaused(sessionId: String, paused: Bool)
    case complete(sessionId: String)
}

enum FocusIntentBridge {
    nonisolated(unsafe) private static var handler:
        (@Sendable (FocusIntentAction) async -> Void)?
    private static let lock = NSLock()

    static func install(
        _ newHandler: @escaping @Sendable (FocusIntentAction) async -> Void
    ) {
        lock.withLock { handler = newHandler }
    }

    static func dispatch(_ action: FocusIntentAction) async {
        let current = lock.withLock { handler }
        await current?(action)
    }
}

struct ToggleFocusIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Pause or resume focus"
    static let isDiscoverable = false

    @Parameter(title: "Session") var sessionId: String
    @Parameter(title: "Pause") var shouldPause: Bool

    init() {}

    init(sessionId: String, shouldPause: Bool) {
        self.sessionId = sessionId
        self.shouldPause = shouldPause
    }

    func perform() async throws -> some IntentResult {
        await FocusIntentBridge.dispatch(
            .setPaused(sessionId: sessionId, paused: shouldPause)
        )
        return .result()
    }
}

struct CompleteFocusIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Complete focus session"
    static let isDiscoverable = false

    @Parameter(title: "Session") var sessionId: String

    init() {}

    init(sessionId: String) {
        self.sessionId = sessionId
    }

    func perform() async throws -> some IntentResult {
        await FocusIntentBridge.dispatch(.complete(sessionId: sessionId))
        return .result()
    }
}
