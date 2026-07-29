import Foundation

struct NativeSyncPresentationSnapshot: Equatable, Sendable {
    var pendingCount: Int
    var pendingTaskCreates: [NativeSyncPendingTaskCreate]
    var pendingActivityStatuses: [NativeSyncPendingActivityStatus]
    var conflicts: [NativeSyncConflict]
    var lastSuccessfulSyncAt: Date?
}

struct NativeSyncPendingTaskCreate: Equatable, Identifiable, Sendable {
    let mutationID: UUID
    let title: String
    let bucket: String
    let createdAt: Date

    var id: UUID { mutationID }
}

struct NativeSyncPendingActivityStatus: Equatable, Sendable {
    let mutationID: UUID
    let activityID: String
    let occurrenceKey: String
    let status: ActivityStatus
}

struct NativeSyncSynchronizationResult: Equatable, Sendable {
    var refreshRequired: Bool
}

struct NativeSyncConflictRetryResult: Equatable, Sendable {
    let operation: NativeSyncConflict.Operation
}

enum SyncConflictRetryOutcome: Equatable, Sendable {
    case succeeded
    case failed
    case cancelled
}

struct NativeSyncPartialFailure: Error {
    let underlying: Error
    let refreshRequired: Bool
}

enum NativeSyncCoordinatorError: Error, Equatable {
    case inactiveScope
    case invalidOccurrenceKey
    case invalidStatus
    case conflictNotFound
    case conflictRetryUnavailable
    case conflictRetryInProgress
}

actor NativeSyncCoordinator {
    private struct InFlightSynchronization {
        let id: UUID
        let task: Task<NativeSyncSynchronizationResult, Error>
    }

    private struct InFlightConflictRetry {
        let id: UUID
        let scope: String
        let conflictID: UUID
        let task: Task<NativeSyncConflictRetryResult, Error>
    }

    private enum ReplayDisposition {
        case continueQueue
        case stopQueue
    }

    private let store: NativeSyncStore
    private let transport: any NativeSyncTransport
    private let clock: @Sendable () -> Date
    private let uuidProvider: @Sendable () -> UUID
    private let idempotencyKeyProvider: @Sendable () -> String
    private let inFlightIDProvider: @Sendable () -> UUID
    private var activeScope: String?
    private var inFlight: InFlightSynchronization?
    private var inFlightConflictRetry: InFlightConflictRetry?

    init(
        store: NativeSyncStore,
        transport: any NativeSyncTransport,
        clock: @escaping @Sendable () -> Date = { Date() },
        uuidProvider: @escaping @Sendable () -> UUID = { UUID() },
        idempotencyKeyProvider: @escaping @Sendable () -> String = {
            UUIDv7Generator.generate()
        },
        inFlightIDProvider: @escaping @Sendable () -> UUID = { UUID() }
    ) {
        self.store = store
        self.transport = transport
        self.clock = clock
        self.uuidProvider = uuidProvider
        self.idempotencyKeyProvider = idempotencyKeyProvider
        self.inFlightIDProvider = inFlightIDProvider
    }

    func activate(scope: String) throws {
        guard !scope.isEmpty else {
            throw NativeSyncStore.StoreError.emptyScope
        }
        if let activeScope, activeScope != scope {
            cancelInFlightSynchronization()
            cancelInFlightConflictRetry()
            try store.purge()
        }
        activeScope = scope
        if try store.read(scope: scope) == nil {
            try store.write(emptyDocument(scope: scope))
        }
    }

    func snapshot(scope: String) throws -> NativeSyncPresentationSnapshot {
        let document = try document(for: scope)
        return .init(
            pendingCount: document.pendingMutations.count,
            pendingTaskCreates:
                document.pendingMutations.compactMap { mutation in
                    guard case let .taskCreate(task) = mutation.kind else {
                        return nil
                    }
                    return .init(
                        mutationID: mutation.id,
                        title: task.title,
                        bucket: task.bucket,
                        createdAt: mutation.createdAt
                    )
                },
            pendingActivityStatuses:
                document.pendingMutations.compactMap { mutation in
                    guard
                        case let .activityStatus(status) = mutation.kind,
                        let desiredStatus = ActivityStatus(
                            rawValue: status.status
                        )
                    else {
                        return nil
                    }
                    return .init(
                        mutationID: mutation.id,
                        activityID: status.activityID,
                        occurrenceKey: status.occurrenceKey,
                        status: desiredStatus
                    )
                },
            conflicts: document.conflicts,
            lastSuccessfulSyncAt: document.lastSuccessfulSyncAt
        )
    }

    @discardableResult
    func enqueueTaskCreate(
        title: String,
        bucket: String,
        scope expectedScope: String? = nil
    ) throws -> NativeSyncMutation {
        let scope: String
        if let expectedScope {
            scope = try requiredActiveScope(matching: expectedScope)
        } else {
            scope = try requiredActiveScope()
        }
        var document = try document(for: scope)
        let mutation = NativeSyncMutation(
            id: uuidProvider(),
            createdAt: clock(),
            nextAttemptAt: nil,
            kind: .taskCreate(.init(
                idempotencyKey: idempotencyKeyProvider(),
                title: title,
                bucket: bucket
            ))
        )
        document.pendingMutations.append(mutation)
        try persist(document, for: scope)
        return mutation
    }

    @discardableResult
    func enqueueActivityStatus(
        activityID: String,
        status: ActivityStatus,
        occurredAt: Date,
        occurrenceKey: String,
        scope expectedScope: String? = nil
    ) throws -> NativeSyncMutation {
        guard !occurrenceKey.trimmingCharacters(in: .whitespacesAndNewlines)
            .isEmpty
        else {
            throw NativeSyncCoordinatorError.invalidOccurrenceKey
        }
        let scope: String
        if let expectedScope {
            scope = try requiredActiveScope(matching: expectedScope)
        } else {
            scope = try requiredActiveScope()
        }
        var document = try document(for: scope)
        let mutation = NativeSyncMutation(
            id: uuidProvider(),
            createdAt: clock(),
            nextAttemptAt: nil,
            kind: .activityStatus(.init(
                idempotencyKey: idempotencyKeyProvider(),
                activityID: activityID,
                status: status.rawValue,
                occurredAt: occurredAt,
                occurrenceKey: occurrenceKey
            ))
        )
        document.pendingMutations.append(mutation)
        try persist(document, for: scope)
        return mutation
    }

    func synchronize(
        scope: String,
        explicitRetry: Bool = false
    ) async throws -> NativeSyncSynchronizationResult {
        _ = try requiredActiveScope(matching: scope)
        if let inFlight {
            return try await inFlight.task.value
        }

        let id = inFlightIDProvider()
        let task = Task { [weak self] () throws -> NativeSyncSynchronizationResult in
            guard let self else {
                throw CancellationError()
            }
            return try await self.performSynchronization(
                scope: scope,
                explicitRetry: explicitRetry
            )
        }
        inFlight = .init(id: id, task: task)
        do {
            let result = try await task.value
            clearInFlightSynchronization(id: id)
            return result
        } catch {
            clearInFlightSynchronization(id: id)
            throw error
        }
    }

    func acknowledgeConflict(scope: String, id: UUID) throws {
        var document = try document(for: scope)
        document.conflicts.removeAll { $0.id == id }
        try persist(document, for: scope)
    }

    func retryConflict(
        scope: String,
        id conflictID: UUID
    ) async throws -> NativeSyncConflictRetryResult {
        _ = try requiredActiveScope(matching: scope)
        if let inFlightConflictRetry {
            guard
                inFlightConflictRetry.scope == scope,
                inFlightConflictRetry.conflictID == conflictID
            else {
                throw NativeSyncCoordinatorError.conflictRetryInProgress
            }
            return try await inFlightConflictRetry.task.value
        }

        let id = inFlightIDProvider()
        let task = Task {
            [weak self] () throws -> NativeSyncConflictRetryResult in
            guard let self else {
                throw CancellationError()
            }
            return try await self.performConflictRetry(
                scope: scope,
                conflictID: conflictID
            )
        }
        inFlightConflictRetry = .init(
            id: id,
            scope: scope,
            conflictID: conflictID,
            task: task
        )
        do {
            let result = try await task.value
            clearInFlightConflictRetry(id: id)
            return result
        } catch {
            clearInFlightConflictRetry(id: id)
            throw error
        }
    }

    func purge() throws {
        cancelInFlightSynchronization()
        cancelInFlightConflictRetry()
        try store.purge()
        activeScope = nil
    }

    func suspendSynchronization() async {
        let synchronization = inFlight
        let conflictRetry = inFlightConflictRetry
        synchronization?.task.cancel()
        conflictRetry?.task.cancel()
        if let synchronization {
            _ = await synchronization.task.result
            clearInFlightSynchronization(id: synchronization.id)
        }
        if let conflictRetry {
            _ = await conflictRetry.task.result
            clearInFlightConflictRetry(id: conflictRetry.id)
        }
    }

    private func performConflictRetry(
        scope: String,
        conflictID: UUID
    ) async throws -> NativeSyncConflictRetryResult {
        let document = try document(for: scope)
        guard
            let conflict = document.conflicts.first(
                where: { $0.id == conflictID }
            )
        else {
            throw NativeSyncCoordinatorError.conflictNotFound
        }
        guard let mutation = conflict.retryMutation else {
            throw NativeSyncCoordinatorError.conflictRetryUnavailable
        }

        try await replay(mutation, scope: scope)
        try Task.checkCancellation()
        _ = try requiredActiveScope(matching: scope)
        try removeConflict(
            id: conflictID,
            mutationID: mutation.id,
            from: scope
        )
        return .init(operation: conflict.operation)
    }

    private func performSynchronization(
        scope: String,
        explicitRetry: Bool
    ) async throws -> NativeSyncSynchronizationResult {
        _ = try requiredActiveScope(matching: scope)
        let initialPresentationDocument = try document(for: scope)
        var replaySucceeded = false
        var queueBlocked = false

        let queuedIDs = try document(for: scope).pendingMutations.map(\.id)
        for mutationID in queuedIDs {
            let currentDocument = try document(for: scope)
            guard let mutation = currentDocument.pendingMutations.first(
                where: { $0.id == mutationID }
            ) else {
                continue
            }
            if !explicitRetry,
               let nextAttemptAt = mutation.nextAttemptAt,
               nextAttemptAt > clock()
            {
                queueBlocked = true
                break
            }

            do {
                try await replay(mutation, scope: scope)
                try removeMutation(id: mutation.id, from: scope)
                replaySucceeded = true
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                switch try handleReplayFailure(
                    error,
                    mutation: mutation,
                    scope: scope
                ) {
                case .continueQueue:
                    continue
                case .stopQueue:
                    queueBlocked = true
                }
            }
            if queueBlocked {
                break
            }
        }

        do {
            let feedAdvanced = try await drainChanges(scope: scope)
            try markSuccessfulSync(scope: scope)
            let didChangePresentation = try presentationChanged(
                from: initialPresentationDocument,
                scope: scope
            )
            return .init(
                refreshRequired:
                    replaySucceeded
                        || feedAdvanced
                        || didChangePresentation
            )
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            let didChangePresentation = try presentationChanged(
                from: initialPresentationDocument,
                scope: scope
            )
            let refreshRequired =
                replaySucceeded || didChangePresentation
            guard refreshRequired else { throw error }
            throw NativeSyncPartialFailure(
                underlying: error,
                refreshRequired: true
            )
        }
    }

    private func presentationChanged(
        from initial: NativeSyncDocument,
        scope: String
    ) throws -> Bool {
        let current = try document(for: scope)
        return initial.pendingMutations.map(\.id)
            != current.pendingMutations.map(\.id)
            || initial.conflicts.map(\.id) != current.conflicts.map(\.id)
    }

    private func replay(
        _ mutation: NativeSyncMutation,
        scope: String
    ) async throws {
        switch mutation.kind {
        case let .taskCreate(task):
            _ = try await transport.createTask(
                title: task.title,
                bucket: task.bucket,
                idempotencyKey: task.idempotencyKey
            )
            try Task.checkCancellation()
            _ = try requiredActiveScope(matching: scope)
        case let .activityStatus(status):
            guard let activityStatus = ActivityStatus(rawValue: status.status) else {
                throw NativeSyncCoordinatorError.invalidStatus
            }
            let activity = try await transport.activity(id: status.activityID)
            try Task.checkCancellation()
            _ = try requiredActiveScope(matching: scope)
            _ = try await transport.setStatus(
                activityId: status.activityID,
                revision: activity.revision,
                occurrenceKey: status.occurrenceKey,
                status: activityStatus,
                completedAt: timestamp(status.occurredAt),
                idempotencyKey: status.idempotencyKey
            )
            try Task.checkCancellation()
            _ = try requiredActiveScope(matching: scope)
        }
    }

    private func handleReplayFailure(
        _ error: Error,
        mutation: NativeSyncMutation,
        scope: String
    ) throws -> ReplayDisposition {
        guard let apiError = error as? APIError else {
            throw error
        }
        if apiError.statusCode == 401 {
            throw apiError
        }
        if retryable(apiError) {
            try scheduleRetry(for: mutation.id, in: scope)
            return .stopQueue
        }
        if case .activityStatus = mutation.kind,
           apiError.statusCode == 409
        {
            try scheduleRetry(for: mutation.id, in: scope)
            return .stopQueue
        }
        if let statusCode = apiError.statusCode,
           (400 ... 499).contains(statusCode)
        {
            let reason: NativeSyncConflict.Reason
            if case .activityStatus = mutation.kind,
               statusCode == 404 || statusCode == 410
            {
                reason = .activityMissing
            } else {
                reason = .clientError
            }
            try recordConflict(
                for: mutation,
                reason: reason,
                in: scope
            )
            return .continueQueue
        }
        throw apiError
    }

    private func drainChanges(scope: String) async throws -> Bool {
        var cursor = try document(for: scope).cursor
        var feedAdvanced = false

        for _ in 0 ..< 10 {
            let page = try await transport.changes(cursor: cursor, limit: 100)
            try Task.checkCancellation()
            _ = try requiredActiveScope(matching: scope)
            if let checkpointCursor = page.checkpointCursor {
                var document = try document(for: scope)
                if document.cursor != checkpointCursor {
                    document.cursor = checkpointCursor
                    try persist(document, for: scope)
                    feedAdvanced = true
                }
            }
            guard let nextCursor = page.nextCursor, !nextCursor.isEmpty else {
                break
            }
            cursor = nextCursor
        }
        return feedAdvanced
    }

    private func removeMutation(id: UUID, from scope: String) throws {
        var document = try document(for: scope)
        document.pendingMutations.removeAll { $0.id == id }
        try persist(document, for: scope)
    }

    private func scheduleRetry(for mutationID: UUID, in scope: String) throws {
        var document = try document(for: scope)
        guard let index = document.pendingMutations.firstIndex(
            where: { $0.id == mutationID }
        ) else {
            return
        }
        let attempt = (document.pendingMutations[index].attemptCount ?? 0) + 1
        document.pendingMutations[index].attemptCount = attempt
        document.pendingMutations[index].nextAttemptAt = clock().addingTimeInterval(
            retryDelay(for: attempt)
        )
        try persist(document, for: scope)
    }

    private func recordConflict(
        for mutation: NativeSyncMutation,
        reason: NativeSyncConflict.Reason,
        in scope: String
    ) throws {
        var document = try document(for: scope)
        document.pendingMutations.removeAll { $0.id == mutation.id }
        document.conflicts.append(.init(
            id: uuidProvider(),
            mutationID: mutation.id,
            operation: operation(for: mutation),
            reason: reason,
            recordedAt: clock(),
            retryMutation: mutation
        ))
        try persist(document, for: scope)
    }

    private func removeConflict(
        id: UUID,
        mutationID: UUID,
        from scope: String
    ) throws {
        var document = try document(for: scope)
        document.conflicts.removeAll {
            $0.id == id && $0.mutationID == mutationID
        }
        try persist(document, for: scope)
    }

    private func markSuccessfulSync(scope: String) throws {
        var document = try document(for: scope)
        document.lastSuccessfulSyncAt = clock()
        try persist(document, for: scope)
    }

    private func retryable(_ error: APIError) -> Bool {
        if case .network = error {
            return true
        }
        guard let statusCode = error.statusCode else {
            return false
        }
        return statusCode == 429 || statusCode >= 500
    }

    private func retryDelay(for attempt: Int) -> TimeInterval {
        let exponent = min(max(attempt - 1, 0), 5)
        return min(60 * Double(1 << exponent), 30 * 60)
    }

    private func operation(
        for mutation: NativeSyncMutation
    ) -> NativeSyncConflict.Operation {
        switch mutation.kind {
        case .taskCreate:
            .taskCreate
        case .activityStatus:
            .activityStatus
        }
    }

    private func timestamp(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }

    private func requiredActiveScope(
        matching scope: String? = nil
    ) throws -> String {
        guard let activeScope,
              scope == nil || activeScope == scope
        else {
            throw NativeSyncCoordinatorError.inactiveScope
        }
        return activeScope
    }

    private func document(for scope: String) throws -> NativeSyncDocument {
        _ = try requiredActiveScope(matching: scope)
        guard let document = try store.read(scope: scope) else {
            throw NativeSyncCoordinatorError.inactiveScope
        }
        return document
    }

    private func persist(_ document: NativeSyncDocument, for scope: String) throws {
        _ = try requiredActiveScope(matching: scope)
        try store.write(document)
    }

    private func emptyDocument(scope: String) -> NativeSyncDocument {
        .init(
            version: NativeSyncDocument.currentVersion,
            scope: scope,
            cursor: nil,
            pendingMutations: [],
            conflicts: [],
            lastSuccessfulSyncAt: nil
        )
    }

    private func cancelInFlightSynchronization() {
        inFlight?.task.cancel()
        inFlight = nil
    }

    private func cancelInFlightConflictRetry() {
        inFlightConflictRetry?.task.cancel()
        inFlightConflictRetry = nil
    }

    private func clearInFlightSynchronization(id: UUID) {
        guard inFlight?.id == id else {
            return
        }
        inFlight = nil
    }

    private func clearInFlightConflictRetry(id: UUID) {
        guard inFlightConflictRetry?.id == id else {
            return
        }
        inFlightConflictRetry = nil
    }
}
