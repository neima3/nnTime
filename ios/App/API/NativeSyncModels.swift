import Foundation

struct NativeSyncDocument: Codable, Equatable, Sendable {
    static let currentVersion = 1

    var version: Int
    var scope: String
    var cursor: String?
    var pendingMutations: [NativeSyncMutation]
    var conflicts: [NativeSyncConflict]
    var lastSuccessfulSyncAt: Date?
}

struct NativeSyncMutation: Codable, Equatable, Sendable {
    enum Kind: Codable, Equatable, Sendable {
        case taskCreate(PendingTaskCreate)
        case activityStatus(PendingActivityStatus)
    }

    var id: UUID
    var createdAt: Date
    var nextAttemptAt: Date?
    var attemptCount: Int? = nil
    var kind: Kind
}

struct PendingTaskCreate: Codable, Equatable, Sendable {
    var idempotencyKey: String
    var title: String
    var bucket: String
}

struct PendingActivityStatus: Codable, Equatable, Sendable {
    var idempotencyKey: String
    var activityID: String
    var status: String
    var occurredAt: Date
    var occurrenceKey: String
}

struct NativeSyncConflict: Codable, Equatable, Sendable {
    enum Operation: String, Codable, Equatable, Sendable {
        case taskCreate
        case activityStatus
    }

    enum Reason: String, Codable, Equatable, Sendable {
        case activityMissing
        case clientError
    }

    var id: UUID
    var mutationID: UUID
    var operation: Operation
    var reason: Reason? = nil
    var recordedAt: Date
}

struct NativeSyncChangeEntry: Equatable, Sendable {
    let id: String
    let entityType: String
    let entityID: String
    let operation: String
    let revision: Int
    let occurredAt: Date
}

struct ChangesPage: Equatable, Sendable {
    let entries: [NativeSyncChangeEntry]
    let nextCursor: String?
    let checkpointCursor: String?
}

protocol NativeSyncTransport: Sendable {
    func createTask(
        title: String,
        bucket: String,
        idempotencyKey: String?
    ) async throws -> TaskItem

    func activity(id: String) async throws -> Activity

    func setStatus(
        activityId: String,
        revision: Int,
        occurrenceKey: String?,
        status: ActivityStatus,
        completedAt: String?,
        idempotencyKey: String?
    ) async throws -> Activity

    func changes(cursor: String?, limit: Int?) async throws -> ChangesPage
}
