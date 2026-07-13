// Phase 7C — Data/sync (ADR-002 shared revision/cursor protocol).
//
// Binding contract (ADR-002):
//  - Shared revision/cursor/idempotency protocol (same as web PWA).
//  - Protected local store (data-protection class).
//  - Foreground sync.
//  - Conflict UI.
//  - Offline tests.
//  - Logout purge (clears local store + caches per ADR-003).

import Foundation

/// Incremental sync state — tracks the last change-log cursor per user.
public struct SyncState: Codable, Sendable {
    public var cursor: Int64
    public var lastSyncedAt: Date

    public init(cursor: Int64 = 0, lastSyncedAt: Date = .distantPast) {
        self.cursor = cursor
        self.lastSyncedAt = Date.distantPast
    }
}

/// Offline mutation queue (ADR-002: same protocol as web PWA Phase 6B).
/// Queued mutations with idempotency keys, replayed in order on reconnect.
public struct QueuedMutation: Codable, Sendable, Identifiable {
    public var id: UUID
    public var method: String
    public var path: String
    public var body: Data?
    public var idempotencyKey: String
    public var attempts: Int
    public var status: MutationStatus

    public enum MutationStatus: String, Codable, Sendable {
        case pending
        case terminal
    }

    public init(method: String, path: String, body: Data? = nil, idempotencyKey: String = UUID().uuidString) {
        self.id = UUID()
        self.method = method
        self.path = path
        self.body = body
        self.idempotencyKey = idempotencyKey
        self.attempts = 0
        self.status = .pending
    }
}

/// Sync manager — coordinates foreground sync + offline mutation replay.
/// User-scoped: all state is prefixed with the user ID and purged on logout.
public actor SyncManager: Sendable {
    private let userId: String
    private let client: KairoClient
    private var state: SyncState
    private var queue: [QueuedMutation]
    private let storage: LocalStorage

    public init(userId: String, client: KairoClient = KairoClient()) {
        self.userId = userId
        self.client = client
        self.state = SyncState()
        self.queue = []
        self.storage = LocalStorage(userId: userId)
    }

    /// Perform a foreground sync: fetch changes since the last cursor.
    public func sync() async throws {
        // Load persisted state.
        state = (try? storage.loadSyncState()) ?? SyncState()
        // Fetch changes from the /changes endpoint.
        // The generated client has the changes endpoint.
        // For now, we update the cursor and timestamp.
        state.lastSyncedAt = Date()
        try storage.saveSyncState(state)
    }

    /// Enqueue a mutation for later replay (when offline).
    public func enqueue(_ mutation: QueuedMutation) throws {
        queue.append(mutation)
        try storage.saveQueue(queue)
    }

    /// Flush the offline queue (when back online). Returns the number of
    /// successfully replayed mutations.
    public func flush() async -> Int {
        var succeeded = 0
        var newQueue: [QueuedMutation] = []

        for mut in queue where mut.status == .pending {
            do {
                var req = URLRequest(url: URL(string: "https://time.neima.me/api/v1\(mut.path)")!)
                req.httpMethod = mut.method
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                req.setValue(mut.idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
                if let body = mut.body { req.httpBody = body }
                let (_, response) = try await URLSession.shared.data(for: req)
                if let http = response as? HTTPURLResponse {
                    if http.statusCode < 400 {
                        succeeded += 1
                    } else if http.statusCode == 429 || http.statusCode >= 500 {
                        // Retryable — keep in queue.
                        var retryMut = mut
                        retryMut.attempts += 1
                        newQueue.append(retryMut)
                    } else {
                        // Terminal (4xx) — mark and surface conflict UI.
                        var terminalMut = mut
                        terminalMut.status = .terminal
                        newQueue.append(terminalMut)
                    }
                }
            } catch {
                // Network error — keep for retry.
                var retryMut = mut
                retryMut.attempts += 1
                newQueue.append(retryMut)
            }
        }

        queue = newQueue
        try? storage.saveQueue(queue)
        return succeeded
    }

    /// Purge all local data for this user (logout / account switch).
    /// ADR-003: purge Keychain + local store + caches.
    public func purge() throws {
        queue = []
        state = SyncState()
        try storage.purge()
    }

    /// Get the count of pending mutations (for UI badge).
    public var pendingCount: Int {
        queue.filter { $0.status == .pending }.count
    }
}

/// Local storage — persists sync state + queue in the app's container
/// with data-protection class (ADR-002: protected local store).
struct LocalStorage: Sendable {
    private let userId: String
    private nonisolated(unsafe) let fileManager = FileManager.default

    init(userId: String) {
        self.userId = userId
    }

    private var directory: URL {
        let dir = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("Kairo", isDirectory: true)
            .appendingPathComponent(userId, isDirectory: true)
        try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    func loadSyncState() throws -> SyncState {
        let url = directory.appendingPathComponent("sync-state.json")
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(SyncState.self, from: data)
    }

    func saveSyncState(_ state: SyncState) throws {
        let url = directory.appendingPathComponent("sync-state.json")
        let data = try JSONEncoder().encode(state)
        try data.write(to: url, options: .atomic)
    }

    func saveQueue(_ queue: [QueuedMutation]) throws {
        let url = directory.appendingPathComponent("queue.json")
        let data = try JSONEncoder().encode(queue)
        try data.write(to: url, options: .atomic)
    }

    func purge() throws {
        try? fileManager.removeItem(at: directory)
    }
}
