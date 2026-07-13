// Phase 7C tests — sync state, offline queue, purge.
import Testing
import Foundation
@testable import Kairo

@Suite struct SyncTests {

    // SyncState defaults.
    @Test func syncStateDefaults() {
        let state = SyncState()
        #expect(state.cursor == 0)
        #expect(state.lastSyncedAt == .distantPast)
    }

    // QueuedMutation initializes with idempotency key.
    @Test func queuedMutationInit() {
        let mut = QueuedMutation(method: "POST", path: "/tasks")
        #expect(mut.method == "POST")
        #expect(mut.path == "/tasks")
        #expect(mut.idempotencyKey.count == 36) // UUID string
        #expect(mut.attempts == 0)
        #expect(mut.status == .pending)
        #expect(mut.id != QueuedMutation(method: "GET", path: "/").id)
    }

    // QueuedMutation with body.
    @Test func queuedMutationWithBody() {
        let body = Data("{}".utf8)
        let mut = QueuedMutation(method: "PATCH", path: "/tasks/123", body: body, idempotencyKey: "key-123")
        #expect(mut.body == body)
        #expect(mut.idempotencyKey == "key-123")
    }

    // MutationStatus enum.
    @Test func mutationStatusEnum() {
        #expect(QueuedMutation.MutationStatus.pending.rawValue == "pending")
        #expect(QueuedMutation.MutationStatus.terminal.rawValue == "terminal")
    }

    // SyncManager initializes with pending count 0.
    @Test func syncManagerInit() async {
        let manager = SyncManager(userId: "test-user-sync")
        #expect(await manager.pendingCount == 0)
    }

    // SyncManager purge clears state.
    @Test func syncManagerPurge() async throws {
        let manager = SyncManager(userId: "test-user-purge")
        try await manager.purge()
        #expect(await manager.pendingCount == 0)
    }
}
