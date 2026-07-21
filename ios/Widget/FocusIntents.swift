import AppIntents
#if canImport(ActivityKit)
import ActivityKit

// MARK: - Live Activity buttons: +10 and Done

struct ExtendFocusIntent: AppIntent {
    static var title: LocalizedStringResource = "Add 10 minutes"
    static var isDiscoverable = false

    @Parameter(title: "Session ID") var sessionId: String
    init() {}
    init(sessionId: String) { self.sessionId = sessionId }

    func perform() async throws -> some IntentResult {
        _ = await KairoRemote.focusAction(sessionId: sessionId, body: ["action": "extend", "addMinutes": 10])
        return .result()
    }
}

struct CompleteFocusIntent: AppIntent {
    static var title: LocalizedStringResource = "Finish focus"
    static var isDiscoverable = false

    @Parameter(title: "Session ID") var sessionId: String
    init() {}
    init(sessionId: String) { self.sessionId = sessionId }

    func perform() async throws -> some IntentResult {
        _ = await KairoRemote.focusAction(sessionId: sessionId, body: ["action": "transition", "state": "completed"])
        return .result()
    }
}
#endif
