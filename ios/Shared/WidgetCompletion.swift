import Foundation

// MARK: - Complete-from-widget (H03)
//
// The widget's done-button path. Network-first by contract: the day cache is
// only touched after the server confirms the write — the failure mode the
// parity checklist forbade was a control that could fail remotely while
// optimistically changing only the cache.

struct WidgetCompletionService: Sendable {
    enum Failure: Error, Equatable {
        /// No live session cookie for the configured origin.
        case notSignedIn
        /// No cached day snapshot to reflect the change into.
        case cacheUnavailable
        /// The cache belongs to a different session than the keychain
        /// envelope — the tapped row was rendered from stale state.
        case scopeMismatch
        /// Server said no (status code preserved for diagnostics).
        case httpStatus(Int)
        /// The PATCH landed but the snapshot no longer contains the
        /// occurrence; the app reconciles on next open.
        case cacheUpdateFailed
    }

    let baseURL: URL
    let session: URLSession
    let envelopeStore: any SessionEnvelopeStoring
    let cacheStore: DayCacheStore

    init(
        baseURL: URL,
        session: URLSession = WidgetCompletionService.makeSession(),
        envelopeStore: any SessionEnvelopeStoring =
            KeychainSessionEnvelopeStore(),
        cacheStore: DayCacheStore = DayCache.defaultStore
    ) {
        self.baseURL = baseURL
        self.session = session
        self.envelopeStore = envelopeStore
        self.cacheStore = cacheStore
    }

    /// The widget process against the origin the app recorded at launch.
    static func live() -> WidgetCompletionService {
        WidgetCompletionService(
            baseURL: KairoPrefs.apiBaseURL
                ?? URL(string: "https://time.neima.me")!
        )
    }

    /// A session that never injects stored cookies — the envelope's `Cookie`
    /// header must be the only credential on the wire.
    static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.timeoutIntervalForRequest = 15
        return URLSession(configuration: config)
    }

    @discardableResult
    func setDone(
        _ done: Bool,
        activityID: String,
        occurrenceKey: String,
        revision: Int,
        now: Date = Date()
    ) async throws -> Int {
        guard let envelope = try? await envelopeStore.load() else {
            throw Failure.notSignedIn
        }
        guard
            let cookieHeader = SessionCookieRules.cookieHeader(
                for: envelope,
                baseURL: baseURL,
                at: now
            )
        else {
            throw Failure.notSignedIn
        }
        let scope = SessionCookieRules.scope(for: envelope.cookies)
        guard let snapshot = cacheStore.readLatest() else {
            throw Failure.cacheUnavailable
        }
        guard snapshot.scope == scope else {
            throw Failure.scopeMismatch
        }

        var request = URLRequest(
            url: baseURL
                .appending(path: "api/v1/activities")
                .appending(path: activityID)
        )
        request.httpMethod = "PATCH"
        request.setValue(String(revision), forHTTPHeaderField: "If-Match")
        request.setValue(
            "application/json",
            forHTTPHeaderField: "Content-Type"
        )
        request.setValue(
            UUID().uuidString.lowercased(),
            forHTTPHeaderField: "Idempotency-Key"
        )
        request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        // ADR-002 PATCH shape — status flips need editScope "this" plus the
        // exact occurrence; pending must carry completedAt null so the
        // server records an uncomplete, not a bare field wipe.
        let body: [String: Any] = [
            "editScope": "this",
            "occurrenceKey": occurrenceKey,
            "status": done ? "completed" : "pending",
            "completedAt": done ? iso.string(from: now) : NSNull(),
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard
            let http = response as? HTTPURLResponse,
            (200..<300).contains(http.statusCode)
        else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw Failure.httpStatus(code)
        }

        let newRevision = Self.revision(inBody: data)
            ?? (http.value(forHTTPHeaderField: "ETag").flatMap(Int.init))
            ?? revision
        do {
            _ = try cacheStore.updateStatus(
                scope: scope,
                date: snapshot.date,
                activityID: activityID,
                occurrenceKey: occurrenceKey,
                done: done,
                newRevision: newRevision
            )
        } catch {
            throw Failure.cacheUpdateFailed
        }
        return newRevision
    }

    private static func revision(inBody data: Data) -> Int? {
        guard
            let object = try? JSONSerialization.jsonObject(with: data),
            let dictionary = object as? [String: Any]
        else {
            return nil
        }
        return dictionary["revision"] as? Int
    }
}
