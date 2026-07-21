import Foundation

// MARK: - Minimal networking usable from BOTH the app and widget/intent
// processes. Uses an app-group-shared cookie store so an AppIntent running
// in the extension carries the same Better Auth session as the app.

enum KairoRemote {
    static let groupID = "group.me.neima.kairo"

    static var baseURL: URL {
        if let raw = ProcessInfo.processInfo.environment["KAIRO_BASE_URL"],
           let url = URL(string: raw) { return url }
        return URL(string: "https://time.neima.me")!
    }

    private static var session: URLSession {
        let config = URLSessionConfiguration.default
        if let shared = HTTPCookieStorage.sharedCookieStorage(forGroupContainerIdentifier: groupID) as HTTPCookieStorage? {
            config.httpCookieStorage = shared
        }
        config.httpShouldSetCookies = true
        config.timeoutIntervalForRequest = 15
        return URLSession(configuration: config)
    }

    /// Complete one occurrence (used by the widget's AppIntent). Returns true
    /// on a 2xx.
    @discardableResult
    static func completeOccurrence(activityId: String, revision: Int, occurrenceKey: String?) async -> Bool {
        var req = URLRequest(url: baseURL.appending(path: "/api/v1/activities/\(activityId)"))
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(String(revision), forHTTPHeaderField: "If-Match")
        req.setValue(TimeZone.current.identifier, forHTTPHeaderField: "x-timezone")
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let body: [String: Any?] = [
            "editScope": "this",
            "occurrenceKey": occurrenceKey,
            "status": "completed",
            "completedAt": iso.string(from: Date()),
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body.compactMapValues { $0 })
        guard let (_, resp) = try? await session.data(for: req),
              let http = resp as? HTTPURLResponse else { return false }
        return (200...299).contains(http.statusCode)
    }

    /// Act on the active focus session (used by Live Activity buttons).
    @discardableResult
    static func focusAction(sessionId: String, body: [String: Any?]) async -> Bool {
        var req = URLRequest(url: baseURL.appending(path: "/api/v1/focus-sessions/\(sessionId)"))
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body.compactMapValues { $0 })
        guard let (_, resp) = try? await session.data(for: req),
              let http = resp as? HTTPURLResponse else { return false }
        return (200...299).contains(http.statusCode)
    }
}
