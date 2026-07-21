import Foundation

// MARK: - Kairo REST client (ADR-002/003)
// Cookie-session auth via Better Auth; every /api/v1 mutation carries
// If-Match revision. Cookies persist in HTTPCookieStorage across launches.

enum APIError: LocalizedError {
    case http(Int, String?)
    case unauthorized
    case conflict
    case network(Error)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .http(let code, let message): message ?? "Request failed (\(code))"
        case .unauthorized: "Please sign in again."
        case .conflict: "Someone else changed this — pull to refresh."
        case .network: "Couldn't reach Kairo — check your connection."
        case .decoding: "Unexpected response from the server."
        }
    }
}

actor KairoAPI {
    static let shared = KairoAPI()

    /// Live by default; override with KAIRO_BASE_URL for local dev
    /// (simulator can hit http://127.0.0.1:3456 when ATS-exempted).
    nonisolated let baseURL: URL = {
        if let raw = ProcessInfo.processInfo.environment["KAIRO_BASE_URL"],
           let url = URL(string: raw) {
            return url
        }
        return URL(string: "https://time.neima.me")!
    }()

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        config.timeoutIntervalForRequest = 20
        return URLSession(configuration: config)
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let s = try decoder.singleValueContainer().decode(String.self)
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = iso.date(from: s) { return date }
            iso.formatOptions = [.withInternetDateTime]
            if let date = iso.date(from: s) { return date }
            // date-only (YYYY-MM-DD)
            let df = DateFormatter()
            df.dateFormat = "yyyy-MM-dd"
            df.timeZone = TimeZone(identifier: "UTC")
            if let date = df.date(from: s) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Bad date: \(s)"))
        }
        return d
    }()

    // MARK: Core request

    @discardableResult
    private func request<T: Decodable>(
        _ method: String,
        _ path: String,
        query: [URLQueryItem] = [],
        body: [String: Any?]? = nil,
        ifMatch: Int? = nil,
        as type: T.Type
    ) async throws -> T {
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }
        var req = URLRequest(url: components.url!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(TimeZone.current.identifier, forHTTPHeaderField: "x-timezone")
        if let ifMatch { req.setValue(String(ifMatch), forHTTPHeaderField: "If-Match") }
        if let body {
            let clean = body.compactMapValues { $0 }
            req.httpBody = try JSONSerialization.data(withJSONObject: clean)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.network(error)
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.http(0, nil) }
        switch http.statusCode {
        case 200...299: break
        case 401: throw APIError.unauthorized
        case 409: throw APIError.conflict
        default:
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
                .flatMap { $0["error"] as? [String: Any] }
                .flatMap { $0["message"] as? String }
            throw APIError.http(http.statusCode, message)
        }
        if T.self == EmptyResponse.self { return EmptyResponse() as! T }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    // MARK: Auth (Better Auth)

    func signIn(email: String, password: String) async throws {
        _ = try await request("POST", "/api/auth/sign-in/email",
                              body: ["email": email, "password": password],
                              as: AuthResponse.self)
    }

    func signUp(name: String, email: String, password: String) async throws {
        _ = try await request("POST", "/api/auth/sign-up/email",
                              body: ["name": name.isEmpty ? "Planner" : name, "email": email, "password": password],
                              as: AuthResponse.self)
    }

    func signOut() async {
        _ = try? await request("POST", "/api/auth/sign-out", body: [:], as: EmptyResponse.self)
        // Belt and braces: drop cookies locally too.
        for cookie in HTTPCookieStorage.shared.cookies ?? [] {
            HTTPCookieStorage.shared.deleteCookie(cookie)
        }
    }

    /// Settings fetch doubles as the session probe (and seeds timezone).
    func settings() async throws -> UserSettings {
        try await request("GET", "/api/v1/settings", as: UserSettings.self)
    }

    // MARK: Day + activities

    func day(_ date: String) async throws -> DayResponse {
        try await request("GET", "/api/v1/day/\(date)", as: DayResponse.self)
    }

    func createActivity(
        tz: String, dtstartLocal: String, title: String, emoji: String,
        durationMin: Int, rrule: String?, categoryId: String?,
        checklist: [[String: Any]]? = nil
    ) async throws -> Activity {
        try await request("POST", "/api/v1/activities", body: [
            "tz": tz, "dtstartLocal": dtstartLocal, "title": title,
            "emoji": emoji, "durationMin": durationMin, "rrule": rrule,
            "categoryId": categoryId, "source": "manual",
            "checklistTemplate": checklist,
        ], as: Activity.self)
    }

    func setStatus(
        activityId: String, revision: Int, occurrenceKey: String?,
        status: String, completedAt: String?
    ) async throws -> Activity {
        try await request("PATCH", "/api/v1/activities/\(activityId)", body: [
            "editScope": "this", "occurrenceKey": occurrenceKey,
            "status": status, "completedAt": completedAt,
        ], ifMatch: revision, as: Activity.self)
    }

    func updateActivity(
        activityId: String, revision: Int, patch: [String: Any?]
    ) async throws -> Activity {
        var body = patch
        body["editScope"] = "all"
        return try await request("PATCH", "/api/v1/activities/\(activityId)", body: body, ifMatch: revision, as: Activity.self)
    }

    /// Move one occurrence to a new start instant (15-min snapped upstream).
    func moveActivity(
        activityId: String, revision: Int, occurrenceKey: String?, startAt: String
    ) async throws -> Activity {
        try await request("PATCH", "/api/v1/activities/\(activityId)", body: [
            "editScope": "this", "occurrenceKey": occurrenceKey, "startAt": startAt,
        ], ifMatch: revision, as: Activity.self)
    }

    /// Persist a checklist state for one occurrence.
    func setChecklist(
        activityId: String, revision: Int, occurrenceKey: String?,
        checklist: [[String: Any]]
    ) async throws -> Activity {
        try await request("PATCH", "/api/v1/activities/\(activityId)", body: [
            "editScope": "this", "occurrenceKey": occurrenceKey,
            "checklistOverride": checklist,
        ], ifMatch: revision, as: Activity.self)
    }

    func deleteActivity(activityId: String, revision: Int) async throws {
        _ = try await request("DELETE", "/api/v1/activities/\(activityId)",
                              ifMatch: revision, as: EmptyResponse.self)
    }

    // MARK: Tasks (inbox / anytime)

    func tasks(bucket: String?) async throws -> [TaskItem] {
        var query: [URLQueryItem] = []
        if let bucket { query.append(URLQueryItem(name: "bucket", value: bucket)) }
        let page: Page<TaskItem> = try await request("GET", "/api/v1/tasks", query: query, as: Page<TaskItem>.self)
        return page.items
    }

    func createTask(title: String, bucket: String) async throws -> TaskItem {
        try await request("POST", "/api/v1/tasks",
                          body: ["title": title, "bucket": bucket],
                          as: TaskItem.self)
    }

    func deleteTask(id: String, revision: Int) async throws {
        _ = try await request("DELETE", "/api/v1/tasks/\(id)", ifMatch: revision, as: EmptyResponse.self)
    }

    // MARK: Stats

    func stats() async throws -> StatsResponse {
        try await request("GET", "/api/v1/stats", as: StatsResponse.self)
    }

    // MARK: Focus sessions (ADR-004, server-authoritative)

    func activeFocus() async throws -> FocusSnapshot {
        try await request("GET", "/api/v1/focus-sessions", as: FocusSnapshot.self)
    }

    func startFocus(minutes: Int, title: String, emoji: String) async throws -> FocusSnapshot {
        try await request("POST", "/api/v1/focus-sessions", body: [
            "targetDurationMin": minutes, "title": title, "emoji": emoji,
        ], as: FocusSnapshot.self)
    }

    func focusAction(id: String, body: [String: Any?]) async throws -> FocusSnapshot {
        try await request("PATCH", "/api/v1/focus-sessions/\(id)", body: body, as: FocusSnapshot.self)
    }
}

struct EmptyResponse: Decodable { init() {} }
