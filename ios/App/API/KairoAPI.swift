import Foundation
import KairoAPIClient
import OpenAPIRuntime

enum SocialAuthFailureReason: Equatable, Sendable {
    case accountConflict
    case providerFailure
}

enum APIError: LocalizedError {
    case http(Int, ServerErrorData)
    case unauthorized(Int, ServerErrorData)
    case conflict(Int, ServerErrorData)
    case authHTTP(Int, String?)
    case authUnauthorized(String?)
    case socialAuth(Int, SocialAuthFailureReason)
    case network(Error)
    case decoding(Error)

    var statusCode: Int? {
        switch self {
        case let .http(statusCode, _),
             let .unauthorized(statusCode, _),
             let .conflict(statusCode, _),
             let .authHTTP(statusCode, _),
             let .socialAuth(statusCode, _):
            statusCode
        case .authUnauthorized:
            401
        case .network, .decoding:
            nil
        }
    }

    var serverError: ServerErrorData? {
        switch self {
        case let .http(_, error),
             let .unauthorized(_, error),
             let .conflict(_, error):
            error
        case .authHTTP, .authUnauthorized, .socialAuth, .network, .decoding:
            nil
        }
    }

    var errorDescription: String? {
        switch self {
        case let .http(code, error):
            error.message.isEmpty
                ? "Request failed (\(code))"
                : error.message
        case let .unauthorized(_, error):
            error.message.isEmpty
                ? "Please sign in again."
                : error.message
        case let .conflict(_, error):
            error.message.isEmpty
                ? "Someone else changed this — pull to refresh."
                : error.message
        case let .authHTTP(code, message):
            message ?? "Request failed (\(code))"
        case let .authUnauthorized(message):
            message ?? "Please sign in again."
        case .socialAuth:
            "Google authentication couldn't be completed. Try again."
        case .network:
            "Couldn't reach Kairo — check your connection."
        case .decoding:
            "Unexpected response from the server."
        }
    }
}

enum UUIDv7Generator {
    static func generate() -> String {
        var random = [UInt8](repeating: 0, count: 10)
        for index in random.indices {
            random[index] = UInt8.random(in: .min ... .max)
        }
        return generate(
            timestampMilliseconds: UInt64(
                Date().timeIntervalSince1970 * 1_000
            ),
            randomBytes: random
        )
    }

    static func generate(
        timestampMilliseconds: UInt64,
        randomBytes: [UInt8]
    ) -> String {
        precondition(randomBytes.count >= 10)
        let timestamp = timestampMilliseconds & 0x0000_FFFF_FFFF_FFFF
        var bytes = [UInt8](repeating: 0, count: 16)
        bytes[0] = UInt8((timestamp >> 40) & 0xff)
        bytes[1] = UInt8((timestamp >> 32) & 0xff)
        bytes[2] = UInt8((timestamp >> 24) & 0xff)
        bytes[3] = UInt8((timestamp >> 16) & 0xff)
        bytes[4] = UInt8((timestamp >> 8) & 0xff)
        bytes[5] = UInt8(timestamp & 0xff)
        bytes[6] = 0x70 | (randomBytes[0] & 0x0f)
        bytes[7] = randomBytes[1]
        bytes[8] = 0x80 | (randomBytes[2] & 0x3f)
        for index in 9 ..< 16 {
            bytes[index] = randomBytes[index - 6]
        }
        let hex = bytes.map { String(format: "%02x", $0) }.joined()
        return [
            String(hex.prefix(8)),
            String(hex.dropFirst(8).prefix(4)),
            String(hex.dropFirst(12).prefix(4)),
            String(hex.dropFirst(16).prefix(4)),
            String(hex.dropFirst(20).prefix(12)),
        ].joined(separator: "-")
    }
}

actor KairoAPI: NativeSyncTransport {
    static let shared = KairoAPI()

    nonisolated let baseURL: URL
    private let authSession: URLSession
    private let authTransport: any NativeAuthRequestTransport
    private let planner: KairoAPIClient.Client
    private let sessionController: NativeSessionController
    private let idempotencyKeyProvider: @Sendable () -> String
    private var authOperationGeneration: UInt = 0

    init(
        baseURL: URL = KairoAPI.defaultBaseURL(),
        session: URLSession = KairoClient.makeSharedCookieSession(),
        authTransport: (any NativeAuthRequestTransport)? = nil,
        sessionController: NativeSessionController? = nil,
        timezoneIdentifierProvider: @escaping @Sendable () -> String = {
            TimeZone.current.identifier
        },
        idempotencyKeyProvider: @escaping @Sendable () -> String = {
            UUIDv7Generator.generate()
        }
    ) {
        self.baseURL = baseURL
        authSession = session
        self.authTransport = authTransport ?? session
        self.sessionController = sessionController ?? NativeSessionController(
            baseURL: baseURL,
            cookieStorage:
                session.configuration.httpCookieStorage ?? .shared
        )
        planner = KairoClient(
            baseURL: Self.plannerServerURL(baseURL),
            session: session,
            middlewares: [
                TimezoneMiddleware(
                    timezoneIdentifierProvider:
                        timezoneIdentifierProvider
                ),
            ]
        ).client
        self.idempotencyKeyProvider = idempotencyKeyProvider
    }

    init(
        baseURL: URL,
        plannerTransport: any ClientTransport,
        session: URLSession = KairoClient.makeSharedCookieSession(),
        authTransport: (any NativeAuthRequestTransport)? = nil,
        sessionController: NativeSessionController? = nil,
        timezoneIdentifierProvider: @escaping @Sendable () -> String,
        idempotencyKeyProvider: @escaping @Sendable () -> String
    ) {
        self.baseURL = baseURL
        authSession = session
        self.authTransport = authTransport ?? session
        self.sessionController = sessionController ?? NativeSessionController(
            baseURL: baseURL,
            cookieStorage:
                session.configuration.httpCookieStorage ?? .shared
        )
        planner = KairoClient(
            baseURL: Self.plannerServerURL(baseURL),
            transport: plannerTransport,
            middlewares: [
                TimezoneMiddleware(
                    timezoneIdentifierProvider:
                        timezoneIdentifierProvider
                ),
            ]
        ).client
        self.idempotencyKeyProvider = idempotencyKeyProvider
    }

    private static func defaultBaseURL() -> URL {
        if let raw = ProcessInfo.processInfo.environment["KAIRO_BASE_URL"],
           let url = URL(string: raw)
        {
            return url
        }
        return URL(string: "https://time.neima.me")!
    }

    private static func plannerServerURL(_ baseURL: URL) -> URL {
        baseURL
            .appending(path: "api")
            .appending(path: "v1")
    }

    // MARK: Better Auth

    private enum AuthEndpoint {
        case signIn
        case signUp
        case signOut
        case googleSignIn
        case googleLink
        case listAccounts

        var pathComponents: [String] {
            switch self {
            case .signIn: ["api", "auth", "sign-in", "email"]
            case .signUp: ["api", "auth", "sign-up", "email"]
            case .signOut: ["api", "auth", "sign-out"]
            case .googleSignIn: ["api", "auth", "sign-in", "social"]
            case .googleLink: ["api", "auth", "link-social"]
            case .listAccounts: ["api", "auth", "list-accounts"]
            }
        }

        var httpMethod: String {
            switch self {
            case .listAccounts:
                "GET"
            case .signIn, .signUp, .signOut, .googleSignIn, .googleLink:
                "POST"
            }
        }
    }

    @discardableResult
    private func authRequest<T: Decodable, Body: Encodable>(
        _ endpoint: AuthEndpoint,
        body: Body?,
        as type: T.Type
    ) async throws -> T {
        let url = endpoint.pathComponents.reduce(baseURL) {
            $0.appending(path: $1)
        }
        var request = URLRequest(url: url)
        request.httpMethod = endpoint.httpMethod
        if let body {
            request.setValue(
                "application/json",
                forHTTPHeaderField: "Content-Type"
            )
            request.httpBody = try JSONEncoder().encode(body)
        }

        let data = try await authData(for: request)
        if T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    private static func authErrorMessage(_ data: Data) -> String? {
        guard
            let object = try? JSONSerialization.jsonObject(with: data)
                as? [String: Any]
        else {
            return nil
        }
        return (object["error"] as? [String: Any])?["message"] as? String
            ?? object["message"] as? String
    }

    private static func authErrorCode(_ data: Data) -> String? {
        guard
            let object = try? JSONSerialization.jsonObject(with: data)
                as? [String: Any]
        else {
            return nil
        }
        let code = object["code"] as? String
            ?? (object["error"] as? [String: Any])?["code"] as? String
        return code?.uppercased()
    }

    @discardableResult
    func signIn(
        email: String,
        password: String
    ) async throws -> NativeSessionController.PersistResult {
        let generation = authOperationGeneration
        _ = try await authRequest(
            .signIn,
            body: ["email": email, "password": password],
            as: AuthResponse.self
        )
        return try await persistSession(generation: generation)
    }

    @discardableResult
    func signUp(
        name: String,
        email: String,
        password: String
    ) async throws -> NativeSessionController.PersistResult {
        let generation = authOperationGeneration
        _ = try await authRequest(
            .signUp,
            body: [
                "name": name.isEmpty ? "Planner" : name,
                "email": email,
                "password": password,
            ],
            as: AuthResponse.self
        )
        return try await persistSession(generation: generation)
    }

    func signOut() async {
        authOperationGeneration &+= 1
        _ = try? await authRequest(
            .signOut,
            body: [String: String](),
            as: EmptyResponse.self
        )
        await sessionController.invalidate()
    }

    func authCapabilities() async throws -> NativeAuthCapabilities {
        try await plannerCall {
            try GeneratedAPIAdapters.authCapabilities(
                await planner.getAuthCapabilities()
            )
        }
    }

    @discardableResult
    func googleSignIn(
        credential: NativeGoogleCredential
    ) async throws -> NativeSessionController.PersistResult {
        let generation = authOperationGeneration
        do {
            _ = try await authRequest(
                .googleSignIn,
                body: GoogleIdentityRequest(credential: credential),
                as: AuthResponse.self
            )
        } catch let error as APIError {
            if case .socialAuth = error {
                throw error
            }
            throw APIError.socialAuth(
                error.statusCode ?? 0,
                .providerFailure
            )
        }
        return try await persistSession(generation: generation)
    }

    func googleLink(
        credential: NativeGoogleCredential
    ) async throws {
        guard await sessionController.currentScope() != nil else {
            throw APIError.socialAuth(401, .providerFailure)
        }
        do {
            _ = try await authRequest(
                .googleLink,
                body: GoogleIdentityRequest(credential: credential),
                as: EmptyResponse.self
            )
        } catch let error as APIError {
            if case .socialAuth = error {
                throw error
            }
            throw APIError.socialAuth(
                error.statusCode ?? 0,
                .providerFailure
            )
        }
    }

    func isGoogleAccountLinked() async throws -> Bool {
        guard await sessionController.currentScope() != nil else {
            throw APIError.authUnauthorized(nil)
        }
        let accounts = try await authRequest(
            .listAccounts,
            body: Optional<[String: String]>.none,
            as: [BetterAuthAccount].self
        )
        return accounts.contains { $0.providerId == "google" }
    }

    func appleChallenge(
        intent: NativeAppleIntent
    ) async throws -> NativeAppleChallenge {
        try await plannerCall {
            try GeneratedAPIAdapters.appleChallenge(
                await planner.createAppleAuthChallenge(
                    body: .json(.init(intent: intent.generated))
                )
            )
        }
    }

    @discardableResult
    func exchangeAppleCredential(
        intent: NativeAppleIntent,
        challenge: NativeAppleChallenge,
        idToken: String
    ) async throws -> NativeSessionController.PersistResult? {
        let generation = authOperationGeneration
        try await plannerCall {
            try GeneratedAPIAdapters.appleExchange(
                await planner.exchangeAppleCredential(
                    body: .json(.init(
                        intent: intent.generated,
                        state: challenge.state,
                        nonce: challenge.nonce,
                        idToken: idToken
                    ))
                )
            )
        }
        guard intent == .signIn else {
            return nil
        }
        return try await persistSession(generation: generation)
    }

    func requestMagicLink(email: String) async throws {
        _ = try await authData(
            for: Self.magicLinkRequest(baseURL: baseURL, email: email)
        )
    }

    nonisolated static func magicLinkRequest(
        baseURL: URL,
        email: String
    ) throws -> URLRequest {
        let url = ["api", "auth", "sign-in", "magic-link"].reduce(baseURL) {
            $0.appending(path: $1)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(
            "application/json",
            forHTTPHeaderField: "Content-Type"
        )
        request.httpBody = try JSONEncoder().encode(
            MagicLinkRequest(
                email: email,
                metadata: .init(platform: "ios")
            )
        )
        return request
    }

    @discardableResult
    func redeemMagicLink(
        token: String
    ) async throws -> NativeSessionController.PersistResult {
        let generation = authOperationGeneration
        var components = URLComponents(
            url: ["api", "auth", "magic-link", "verify"].reduce(baseURL) {
                $0.appending(path: $1)
            },
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [
            URLQueryItem(name: "token", value: token),
        ]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        _ = try await authData(for: request)
        return try await persistSession(generation: generation)
    }

    func restoreSession() async throws -> String? {
        try await sessionController.restore()
    }

    /// The scope of the currently restored session, if any — lets background
    /// intent launches decide whether cookies still need hydrating.
    func currentSessionScope() async -> String? {
        await sessionController.currentScope()
    }

    func sessionScope() async -> String? {
        await sessionController.currentScope()
    }

    @discardableResult
    func persistCurrentSession() async throws
        -> NativeSessionController.PersistResult
    {
        try await persistSession(generation: authOperationGeneration)
    }

    func invalidateSession() async {
        authOperationGeneration &+= 1
        await sessionController.invalidate()
    }

    // MARK: Settings and categories

    func settings() async throws -> UserSettings {
        try await plannerCall {
            try GeneratedAPIAdapters.settings(
                await planner.getUserSettings()
            )
        }
    }

    func updateSettings(
        update: SettingsUpdate,
        revision: Int
    ) async throws -> UserSettings {
        let key = idempotencyKeyProvider()
        return try await plannerCall {
            let output = try await planner.updateUserSettings(
                headers: .init(
                    Idempotency_hyphen_Key: key,
                    If_hyphen_Match: String(revision)
                ),
                body: .json(
                    try GeneratedAPIAdapters.settingsUpdate(update)
                )
            )
            return try GeneratedAPIAdapters.updatedSettings(output)
        }
    }

    func categories() async throws -> [PlannerCategory] {
        try await plannerCall {
            try GeneratedAPIAdapters.categories(
                await planner.listCategories()
            )
        }
    }

    // MARK: Day and activities

    func day(_ date: String) async throws -> DayResponse {
        try await plannerCall {
            try GeneratedAPIAdapters.day(
                await planner.getDay(path: .init(date: date))
            )
        }
    }

    func activity(id: String) async throws -> Activity {
        try await plannerCall {
            try GeneratedAPIAdapters.activitySeries(
                await planner.getActivitySeries(path: .init(id: id))
            )
        }
    }

    func changes(
        cursor: String?,
        limit: Int?
    ) async throws -> ChangesPage {
        try await plannerCall {
            try GeneratedAPIAdapters.changes(
                await planner.getChanges(
                    query: .init(cursor: cursor, limit: limit)
                )
            )
        }
    }

    func createActivity(
        tz: String,
        dtstartLocal: String,
        title: String,
        emoji: String,
        durationMin: Int,
        rrule: String?,
        categoryId: String?,
        checklist: [ChecklistUpdateItem]? = nil
    ) async throws -> Activity {
        let key = idempotencyKeyProvider()
        return try await plannerCall {
            let checklist = try checklist?.map {
                Components.Schemas.ActivitySeriesCreateRequest
                    .checklistTemplatePayloadPayload(
                        additionalProperties:
                            try GeneratedAPIAdapters.checklistObject($0)
                    )
            }
            let output = try await planner.createActivitySeries(
                headers: .init(Idempotency_hyphen_Key: key),
                body: .json(.init(
                    tz: tz,
                    dtstartLocal: try Self.date(dtstartLocal),
                    rrule: rrule,
                    title: title,
                    emoji: emoji,
                    categoryId: categoryId,
                    durationMin: try Self.int32(durationMin),
                    checklistTemplate: checklist,
                    source: .manual
                ))
            )
            return try GeneratedAPIAdapters.activity(output)
        }
    }

    func setStatus(
        activityId: String,
        revision: Int,
        occurrenceKey: String?,
        status: ActivityStatus,
        completedAt: String?,
        idempotencyKey: String? = nil
    ) async throws -> Activity {
        try await updateActivity(
            activityId: activityId,
            revision: revision,
            update: .init(
                editScope: .this,
                occurrenceKey: try occurrenceKey.map(Self.date),
                status: status,
                completedAt: try completedAt.map {
                    .value(try Self.date($0))
                } ?? .null
            ),
            idempotencyKey: idempotencyKey
        )
    }

    func updateActivity(
        activityId: String,
        revision: Int,
        update: ActivityUpdate,
        idempotencyKey: String? = nil
    ) async throws -> Activity {
        let key = idempotencyKey ?? idempotencyKeyProvider()
        var update = update
        if update.editScope == nil {
            // ADR-001 / the OpenAPI parameter both default to `this`. A caller
            // that identified a single day means that day; only a caller with
            // no day identity can mean the whole series.
            update.editScope = update.occurrenceKey == nil ? .all : .this
        }
        return try await plannerCall {
            let output = try await planner.updateActivitySeries(
                path: .init(id: activityId),
                query: .init(
                    editScope: update.editScope.map {
                        switch $0 {
                        case .this: .this
                        case .thisAndFuture: .this_and_future
                        case .all: .all
                        }
                    }
                ),
                headers: .init(
                    Idempotency_hyphen_Key: key,
                    If_hyphen_Match: String(revision)
                ),
                body: .json(
                    try GeneratedAPIAdapters.activityUpdate(update)
                )
            )
            return try GeneratedAPIAdapters.updatedActivity(output)
        }
    }

    func moveActivity(
        activityId: String,
        revision: Int,
        occurrenceKey: String?,
        startAt: String
    ) async throws -> Activity {
        try await updateActivity(
            activityId: activityId,
            revision: revision,
            update: .init(
                editScope: .this,
                occurrenceKey: try occurrenceKey.map(Self.date),
                startAt: try Self.date(startAt)
            )
        )
    }

    func setChecklist(
        activityId: String,
        revision: Int,
        occurrenceKey: String?,
        checklist: [ChecklistUpdateItem]
    ) async throws -> Activity {
        try await updateActivity(
            activityId: activityId,
            revision: revision,
            update: .init(
                editScope: .this,
                occurrenceKey: try occurrenceKey.map(Self.date),
                checklistOverride: .value(checklist)
            )
        )
    }

    /// Tombstone a series (ADR-001 delete scopes mirror the edit scopes).
    ///
    /// `editScope` defaults to `.all` so a one-off delete stays a one-liner;
    /// a repeating occurrence must pass `.this` / `.thisAndFuture` together
    /// with its `occurrenceKey`, which the route requires ("A valid
    /// occurrenceKey is required for scoped deletes").
    func deleteActivity(
        activityId: String,
        revision: Int,
        editScope: ActivityEditScope = .all,
        occurrenceKey: String? = nil
    ) async throws {
        let key = idempotencyKeyProvider()
        try await plannerCall {
            try GeneratedAPIAdapters.empty(
                await planner.deleteActivitySeries(
                    path: .init(id: activityId),
                    query: .init(
                        editScope: {
                            switch editScope {
                            case .this: .this
                            case .thisAndFuture: .this_and_future
                            case .all: .all
                            }
                        }(),
                        occurrenceKey: editScope == .all
                            ? nil
                            : try occurrenceKey.map(Self.date)
                    ),
                    headers: .init(
                        Idempotency_hyphen_Key: key,
                        If_hyphen_Match: String(revision)
                    )
                )
            )
        }
    }

    // MARK: Tasks

    func tasks(bucket: String?) async throws -> [TaskItem] {
        try await plannerCall {
            try GeneratedAPIAdapters.tasks(
                await planner.listTasks(
                    query: .init(bucket: try bucket.map(Self.taskBucket))
                )
            )
        }
    }

    func createTask(
        title: String,
        bucket: String,
        idempotencyKey: String? = nil
    ) async throws -> TaskItem {
        let key = idempotencyKey ?? idempotencyKeyProvider()
        return try await plannerCall {
            let output = try await planner.createTask(
                headers: .init(Idempotency_hyphen_Key: key),
                body: .json(.init(
                    bucket: try Self.taskBucket(bucket),
                    title: title
                ))
            )
            return try GeneratedAPIAdapters.task(output)
        }
    }

    func deleteTask(id: String, revision: Int) async throws {
        let key = idempotencyKeyProvider()
        try await plannerCall {
            try GeneratedAPIAdapters.empty(
                await planner.deleteTask(
                    path: .init(id: id),
                    headers: .init(
                        Idempotency_hyphen_Key: key,
                        If_hyphen_Match: String(revision)
                    )
                )
            )
        }
    }

    // MARK: Search, stats, and mood

    func search(_ query: String, limit: Int = 25) async throws
        -> SearchResponse
    {
        try await plannerCall {
            try GeneratedAPIAdapters.search(
                await planner.search(query: .init(q: query, limit: limit))
            )
        }
    }

    func stats() async throws -> StatsResponse {
        try await plannerCall {
            try GeneratedAPIAdapters.stats(await planner.getStats())
        }
    }

    func postMood(_ mood: String) async throws {
        let key = idempotencyKeyProvider()
        try await plannerCall {
            try GeneratedAPIAdapters.empty(
                await planner.createMoodCheckin(
                    headers: .init(Idempotency_hyphen_Key: key),
                    body: .json(.init(mood: try Self.mood(mood)))
                )
            )
        }
    }

    // MARK: Routines

    func routines() async throws -> [Routine] {
        try await plannerCall {
            try GeneratedAPIAdapters.routines(await planner.listRoutines())
        }
    }

    // MARK: Focus sessions

    func activeFocus() async throws -> FocusSnapshot {
        try await plannerCall {
            try GeneratedAPIAdapters.focus(
                await planner.getActiveFocusSession()
            )
        }
    }

    func startFocus(
        minutes: Int,
        title: String,
        emoji: String
    ) async throws -> FocusSnapshot {
        let key = idempotencyKeyProvider()
        return try await plannerCall {
            try GeneratedAPIAdapters.startedFocus(
                await planner.startFocusSession(
                    headers: .init(Idempotency_hyphen_Key: key),
                    body: .json(.init(
                        targetDurationMin: minutes,
                        title: title,
                        emoji: emoji
                    ))
                )
            )
        }
    }

    func focusAction(
        id: String,
        revision: Int,
        command: FocusCommand
    ) async throws -> FocusSnapshot {
        let key = idempotencyKeyProvider()
        return try await plannerCall {
            try GeneratedAPIAdapters.updatedFocus(
                await planner.updateFocusSession(
                    path: .init(id: id),
                    headers: .init(
                        Idempotency_hyphen_Key: key,
                        If_hyphen_Match: String(revision)
                    ),
                    body: .json(
                        try GeneratedAPIAdapters.focusCommand(command)
                    )
                )
            )
        }
    }

    // MARK: Boundary helpers

    private func plannerCall<T>(
        _ operation: () async throws -> T
    ) async throws -> T {
        do {
            return try await operation()
        } catch let error as GeneratedAPIAdapterError {
            let mapped = Self.apiError(error)
            if case .unauthorized = mapped {
                await invalidateAndNotify()
            }
            throw mapped
        } catch let error as APIError {
            if case .unauthorized = error {
                await invalidateAndNotify()
            }
            throw error
        } catch {
            if Self.isCancellation(error) {
                throw CancellationError()
            }
            if let decodingError = Self.decodingError(error) {
                throw APIError.decoding(decodingError)
            }
            throw APIError.network(error)
        }
    }

    private func authData(
        for request: URLRequest
    ) async throws -> Data {
        do {
            var authenticatedRequest = request
            if authenticatedRequest.value(
                forHTTPHeaderField: "Cookie"
            ) == nil,
               let storage = authSession.configuration.httpCookieStorage,
               let url = authenticatedRequest.url,
               let cookies = storage.cookies(for: url),
               !cookies.isEmpty
            {
                let fields = HTTPCookie.requestHeaderFields(with: cookies)
                authenticatedRequest.setValue(
                    fields["Cookie"],
                    forHTTPHeaderField: "Cookie"
                )
            }
            let (data, response) = try await authTransport.data(
                for: authenticatedRequest
            )
            guard let http = response as? HTTPURLResponse else {
                throw APIError.authHTTP(0, nil)
            }
            switch http.statusCode {
            case 200 ... 299:
                return data
            case 401:
                let preservesCredentialFailure =
                    Self.isAllowlistedGoogleCredentialError(
                        data,
                        path: request.url?.path
                    )
                if !preservesCredentialFailure {
                    await invalidateAndNotify()
                }
                if Self.isGoogleIdentityPath(request.url?.path) {
                    throw APIError.socialAuth(
                        http.statusCode,
                        Self.socialAuthFailureReason(
                            data,
                            path: request.url?.path
                        )
                    )
                }
                throw APIError.authUnauthorized(Self.authErrorMessage(data))
            default:
                if Self.isGoogleIdentityPath(request.url?.path) {
                    throw APIError.socialAuth(
                        http.statusCode,
                        Self.socialAuthFailureReason(
                            data,
                            path: request.url?.path
                        )
                    )
                }
                throw APIError.authHTTP(
                    http.statusCode,
                    Self.authErrorMessage(data)
                )
            }
        } catch let error as APIError {
            throw error
        } catch {
            if Self.isCancellation(error) {
                throw CancellationError()
            }
            throw APIError.network(error)
        }
    }

    private func invalidateAndNotify() async {
        authOperationGeneration &+= 1
        guard await sessionController.invalidate() else {
            return
        }
        await MainActor.run {
            NotificationCenter.default.post(
                name: .kairoSessionInvalidated,
                object: nil
            )
        }
    }

    private static func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError {
            return true
        }
        if let urlError = error as? URLError,
           urlError.code == .cancelled
        {
            return true
        }
        if let clientError = error as? ClientError {
            return isCancellation(clientError.underlyingError)
        }
        return false
    }

    private static func isAllowlistedGoogleCredentialError(
        _ data: Data,
        path: String?
    ) -> Bool {
        guard let code = authErrorCode(data) else {
            return false
        }
        switch path {
        case "/api/auth/sign-in/social":
            return [
                "INVALID_TOKEN",
                "FAILED_TO_GET_USER_INFO",
                "USER_EMAIL_NOT_FOUND",
                "OAUTH_LINK_ERROR",
            ].contains(code)
        case "/api/auth/link-social":
            return [
                "INVALID_TOKEN",
                "FAILED_TO_GET_USER_INFO",
                "USER_EMAIL_NOT_FOUND",
                "LINKING_NOT_ALLOWED",
                "LINKING_DIFFERENT_EMAILS_NOT_ALLOWED",
            ].contains(code)
        default:
            return false
        }
    }

    private static func isGoogleIdentityPath(_ path: String?) -> Bool {
        path == "/api/auth/sign-in/social"
            || path == "/api/auth/link-social"
    }

    private static func socialAuthFailureReason(
        _ data: Data,
        path: String?
    ) -> SocialAuthFailureReason {
        guard
            path == "/api/auth/sign-in/social",
            authErrorCode(data) == "OAUTH_LINK_ERROR"
        else {
            return .providerFailure
        }
        return .accountConflict
    }

    private func persistSession(
        generation: UInt
    ) async throws -> NativeSessionController.PersistResult {
        guard generation == authOperationGeneration else {
            await sessionController.invalidate()
            throw CancellationError()
        }
        let result = try await sessionController.persist()
        guard generation == authOperationGeneration else {
            await sessionController.invalidate()
            throw CancellationError()
        }
        return result
    }

    private static func decodingError(
        _ error: Error
    ) -> DecodingError? {
        if let decodingError = error as? DecodingError {
            return decodingError
        }
        if let clientError = error as? ClientError {
            return decodingError(clientError.underlyingError)
        }
        return nil
    }

    private static func apiError(
        _ error: GeneratedAPIAdapterError
    ) -> APIError {
        switch error {
        case let .http(_, statusCode, error):
            .http(statusCode, error)
        case let .unauthorized(_, _, error):
            .unauthorized(401, error)
        case let .conflict(_, _, error):
            .conflict(409, error)
        case let .notFound(_, statusCode, error):
            .http(statusCode, error)
        case let .undocumented(_, statusCode):
            .http(
                statusCode,
                .init(
                    code: "undocumented_response",
                    message: "Request failed (\(statusCode))",
                    retryable: statusCode == 429 || statusCode >= 500,
                    details: nil
                )
            )
        case let .malformedValue(path):
            .decoding(
                DecodingError.dataCorrupted(.init(
                    codingPath: [],
                    debugDescription: "Malformed generated value at \(path)"
                ))
            )
        }
    }

    private static func date(_ value: String) throws -> Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [
            .withInternetDateTime,
            .withFractionalSeconds,
        ]
        if let date = formatter.date(from: value) {
            return date
        }
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: value) {
            return date
        }
        throw GeneratedAPIAdapterError.malformedValue(path: "date")
    }

    private static func int32(_ value: Int) throws -> Int32 {
        guard let result = Int32(exactly: value) else {
            throw GeneratedAPIAdapterError.malformedValue(path: "Int32")
        }
        return result
    }

    private static func taskBucket(
        _ value: String
    ) throws -> Components.Schemas.TaskBucket {
        guard let bucket = Components.Schemas.TaskBucket(rawValue: value)
        else {
            throw GeneratedAPIAdapterError.malformedValue(
                path: "Task.bucket"
            )
        }
        return bucket
    }

    private static func mood(
        _ value: String
    ) throws -> Components.Schemas.MoodCheckinRequest.moodPayload {
        guard
            let mood = Components.Schemas.MoodCheckinRequest
                .moodPayload(rawValue: value)
        else {
            throw GeneratedAPIAdapterError.malformedValue(
                path: "MoodCheckin.mood"
            )
        }
        return mood
    }
}

private extension NativeAppleIntent {
    var generated: Components.Schemas.AppleAuthIntent {
        switch self {
        case .signIn: .sign_in
        case .link: .link
        }
    }
}

struct EmptyResponse: Decodable {
    init() {}
}

private struct BetterAuthAccount: Decodable {
    let providerId: String
}

private struct MagicLinkRequest: Encodable {
    struct Metadata: Encodable {
        let platform: String
    }

    let email: String
    let metadata: Metadata
}

struct GoogleIdentityRequest: Encodable {
    struct IDToken: Encodable {
        let token: String
        let accessToken: String
    }

    let provider = "google"
    let idToken: IDToken

    init(credential: NativeGoogleCredential) {
        idToken = .init(
            token: credential.idToken,
            accessToken: credential.accessToken
        )
    }
}
