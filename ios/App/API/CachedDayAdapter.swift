import Foundation

enum CachedDayAdapter {
    enum AdapterError: Error, Equatable {
        case invalidOccurrenceIdentity
        case occurrenceNotFound
        case ambiguousOccurrence
    }

    static func blocks(
        from snapshot: DayCache.Snapshot
    ) -> [DayBlock] {
        snapshot.blocks.enumerated().map { index, cached in
            DayBlock(
                id: cached.activityId
                    ?? [
                        "cached",
                        snapshot.date,
                        String(index),
                        String(cached.startMin),
                    ].joined(separator: "-"),
                title: cached.title,
                emoji: cached.emoji,
                startMin: cached.startMin,
                durationMin: cached.durationMin,
                category:
                    KairoCategory(rawValue: cached.category) ?? .sky,
                done: cached.done,
                recurring: false,
                revision: cached.revision ?? 0,
                occurrenceKey: cached.occurrenceKey,
                checklist: []
            )
        }
        .sorted { $0.startMin < $1.startMin }
    }

    static func settingCompletion(
        _ done: Bool,
        for block: DayBlock,
        in blocks: [DayBlock]
    ) throws -> [DayBlock] {
        guard OfflineTodayOccurrenceIdentity(block: block) != nil else {
            throw AdapterError.invalidOccurrenceIdentity
        }
        let matches = blocks.indices.filter { index in
            let candidate = blocks[index]
            return candidate.id == block.id
                &&
                candidate.occurrenceKey == block.occurrenceKey
        }
        guard !matches.isEmpty else {
            throw AdapterError.occurrenceNotFound
        }
        guard matches.count == 1, let index = matches.first else {
            throw AdapterError.ambiguousOccurrence
        }
        var updated = blocks
        let candidate = updated[index]
        updated[index] = DayBlock(
            id: candidate.id,
            title: candidate.title,
            emoji: candidate.emoji,
            startMin: candidate.startMin,
            durationMin: candidate.durationMin,
            category: candidate.category,
            done: done,
            recurring: candidate.recurring,
            revision: candidate.revision,
            occurrenceKey: candidate.occurrenceKey,
            checklist: candidate.checklist
        )
        return updated
    }

    static func overlayPendingStatuses(
        _ statuses: [NativeSyncPendingActivityStatus],
        on blocks: [DayBlock]
    ) -> [DayBlock] {
        let desired = statuses.reduce(
            into: [OfflineTodayOccurrenceIdentity: ActivityStatus]()
        ) { result, pending in
            guard let identity = OfflineTodayOccurrenceIdentity(
                activityID: pending.activityID,
                occurrenceKey: pending.occurrenceKey
            ) else {
                return
            }
            result[identity] = pending.status
        }
        return blocks.map { block in
            guard
                let identity = OfflineTodayOccurrenceIdentity(block: block),
                let status = desired[identity]
            else {
                return block
            }
            return DayBlock(
                id: block.id,
                title: block.title,
                emoji: block.emoji,
                startMin: block.startMin,
                durationMin: block.durationMin,
                category: block.category,
                done: status == .completed,
                recurring: block.recurring,
                revision: block.revision,
                occurrenceKey: block.occurrenceKey,
                checklist: block.checklist
            )
        }
    }

    static func visiblePendingOccurrences(
        _ statuses: [NativeSyncPendingActivityStatus],
        inFlight: Set<OfflineTodayOccurrenceIdentity>,
        blocks: [DayBlock]
    ) -> Set<OfflineTodayOccurrenceIdentity> {
        let queued = Set(statuses.compactMap {
            OfflineTodayOccurrenceIdentity(
                activityID: $0.activityID,
                occurrenceKey: $0.occurrenceKey
            )
        })
        let visible = Set(blocks.compactMap {
            OfflineTodayOccurrenceIdentity(block: $0)
        })
        return queued.union(inFlight).intersection(visible)
    }
}

struct TodayLoadPolicy {
    enum MutationRenderDisposition: Equatable {
        case exactLoad
        case sameVisibleDay
        case differentVisibleDay
    }

    enum NoticeMode: Equatable {
        case hidden
        case dayUnavailable
        case savedDay
        case savedOnDevice
    }

    struct FailureState {
        let blocks: [DayBlock]
        let usingCachedDay: Bool
        let mutationsLocked: Bool
        let loading: Bool
    }

    static func shouldApply(
        responseDate: String,
        requestedDate: String
    ) -> Bool {
        responseDate == requestedDate
    }

    static func failureState(
        cachedBlocks: [DayBlock]?
    ) -> FailureState {
        .init(
            blocks: cachedBlocks ?? [],
            usingCachedDay: cachedBlocks != nil,
            mutationsLocked: true,
            loading: false
        )
    }

    static func noticeMode(
        mutationsLocked: Bool,
        usingCachedDay: Bool,
        hasDurableVisiblePending: Bool,
        hasSubmittingVisible _: Bool
    ) -> NoticeMode {
        if hasDurableVisiblePending {
            return .savedOnDevice
        }
        if mutationsLocked {
            return usingCachedDay ? .savedDay : .dayUnavailable
        }
        return .hidden
    }

    static func responseDateMismatchState() -> FailureState {
        failureState(cachedBlocks: nil)
    }

    static func canApplyMutationRender(
        capturedLoadID: UUID,
        currentLoadID: UUID,
        capturedDate: String,
        currentDate: String,
        capturedOffset: Int,
        currentOffset: Int
    ) -> Bool {
        mutationRenderDisposition(
            capturedLoadID: capturedLoadID,
            currentLoadID: currentLoadID,
            capturedDate: capturedDate,
            currentDate: currentDate,
            capturedOffset: capturedOffset,
            currentOffset: currentOffset
        ) != .differentVisibleDay
    }

    static func mutationRenderDisposition(
        capturedLoadID: UUID,
        currentLoadID: UUID,
        capturedDate: String,
        currentDate: String,
        capturedOffset: Int,
        currentOffset: Int
    ) -> MutationRenderDisposition {
        guard
            capturedDate == currentDate,
            capturedOffset == currentOffset
        else {
            return .differentVisibleDay
        }
        return capturedLoadID == currentLoadID
            ? .exactLoad
            : .sameVisibleDay
    }
}

struct TodayBlockActionPolicy {
    static func canExposeCompletionAction(
        readOnly: Bool,
        pending: Bool,
        offlineCompletionEligible: Bool
    ) -> Bool {
        !pending && (!readOnly || offlineCompletionEligible)
    }
}

struct OfflineTodayOccurrenceIdentity: Hashable {
    let activityID: String
    let occurrenceKey: String

    init?(activityID: String, occurrenceKey: String?) {
        let trimmedActivityID = activityID.trimmingCharacters(
            in: .whitespacesAndNewlines
        )
        let trimmedOccurrenceKey = (occurrenceKey ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            !trimmedActivityID.isEmpty,
            !trimmedOccurrenceKey.isEmpty
        else {
            return nil
        }
        self.activityID = trimmedActivityID
        self.occurrenceKey = trimmedOccurrenceKey
    }

    init?(block: DayBlock) {
        self.init(
            activityID: block.id,
            occurrenceKey: block.occurrenceKey
        )
    }
}

struct OfflineTodayMutationPolicy: Equatable {
    let canChangeCompletion: Bool
    let canEdit: Bool
    let canMove: Bool
    let canDelete: Bool
    let canFocus: Bool
    let canReview: Bool
    let canBrowseTemplates: Bool
    let canCreate: Bool

    static let cachedDay = Self(
        canChangeCompletion: true,
        canEdit: false,
        canMove: false,
        canDelete: false,
        canFocus: false,
        canReview: false,
        canBrowseTemplates: false,
        canCreate: false
    )

    func allowsCompletion(for block: DayBlock) -> Bool {
        canChangeCompletion
            && OfflineTodayOccurrenceIdentity(block: block) != nil
    }

    func canBegin(
        _ identity: OfflineTodayOccurrenceIdentity,
        pending: Set<OfflineTodayOccurrenceIdentity>
    ) -> Bool {
        canChangeCompletion && !pending.contains(identity)
    }
}

@MainActor
struct OfflineTodayStatusMutation {
    enum MutationError: Error, Equatable {
        case invalidScope
        case invalidDate
        case invalidOccurrenceIdentity
    }

    struct Failure: Error {
        enum Stage: Equatable {
            case enqueue
            case cachePersistence
        }

        let stage: Stage
        let underlying: Error
    }

    typealias Enqueue = (
        _ activityID: String,
        _ status: ActivityStatus,
        _ occurredAt: Date,
        _ occurrenceKey: String
    ) async throws -> Void
    typealias Persist = (
        _ scope: String,
        _ date: String,
        _ activityID: String,
        _ occurrenceKey: String,
        _ done: Bool
    ) throws -> Void

    let enqueue: Enqueue
    let persist: Persist

    func perform(
        scope: String,
        date: String,
        block: DayBlock,
        done: Bool,
        render: (Bool) -> Void
    ) async throws {
        guard !scope.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw MutationError.invalidScope
        }
        guard !date.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw MutationError.invalidDate
        }
        guard
            OfflineTodayMutationPolicy.cachedDay
                .allowsCompletion(for: block),
            let occurrenceKey = block.occurrenceKey
        else {
            throw MutationError.invalidOccurrenceIdentity
        }

        do {
            try await enqueue(
                block.id,
                done ? .completed : .pending,
                Date(),
                occurrenceKey
            )
        } catch {
            throw Failure(stage: .enqueue, underlying: error)
        }
        render(done)
        do {
            try persist(
                scope,
                date,
                block.id,
                occurrenceKey,
                done
            )
        } catch {
            render(block.done)
            throw Failure(
                stage: .cachePersistence,
                underlying: error
            )
        }
    }
}
