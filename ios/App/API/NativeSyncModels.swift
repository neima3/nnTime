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
    var id: UUID
    var mutationID: UUID
    var operation: String
    var recordedAt: Date
}
