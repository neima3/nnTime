import SwiftUI
import UIKit

enum SyncConflictSurface {
    case today
    case inbox

    fileprivate var operation: NativeSyncConflict.Operation {
        switch self {
        case .today:
            .activityStatus
        case .inbox:
            .taskCreate
        }
    }
}

struct SyncConflictPresentation: Equatable, Identifiable {
    let id: UUID
    let operation: NativeSyncConflict.Operation
    let operationLabel: String
    let title: String
    let message: String
    let canRetry: Bool
    let retryAccessibilityLabel: String?
    let dismissAccessibilityLabel: String

    init?(
        conflict: NativeSyncConflict,
        surface: SyncConflictSurface
    ) {
        guard conflict.operation == surface.operation else {
            return nil
        }
        id = conflict.id
        operation = conflict.operation
        canRetry = conflict.retryMutation != nil

        switch conflict.operation {
        case .taskCreate:
            operationLabel = "Inbox capture"
            title = "Inbox capture not saved"
            message = canRetry
                ? "Kairo didn’t save this capture on the server. Retry, or dismiss to remove this saved recovery copy."
                : "Kairo didn’t save this capture on the server. This older recovery copy can’t be retried. Dismiss to remove it."
        case .activityStatus:
            operationLabel = "Activity status change"
            switch conflict.reason {
            case .activityMissing:
                title = "Activity unavailable"
                message = canRetry
                    ? "This activity is no longer available, so the status change wasn’t applied. Retry, or dismiss to remove this saved recovery copy."
                    : "This activity is no longer available, so the status change wasn’t applied. This older recovery copy can’t be retried. Dismiss to remove it."
            case .clientError, .none:
                title = "Status change not applied"
                message = canRetry
                    ? "Kairo didn’t apply this status change. Retry, or dismiss to remove this saved recovery copy."
                    : "Kairo didn’t apply this status change. This older recovery copy can’t be retried. Dismiss to remove it."
            }
        }

        retryAccessibilityLabel = canRetry
            ? "Retry syncing \(operationLabel)"
            : nil
        dismissAccessibilityLabel = "Dismiss \(operationLabel) conflict"
    }
}

@Observable @MainActor
final class SyncConflictNoticeModel {
    private(set) var isRetrying = false
    private(set) var retryingConflictID: UUID?
    private(set) var retryFailureConflictID: UUID?
    private(set) var retryFailureMessage: String?
    private(set) var retryAnnouncementGeneration = 0

    @discardableResult
    func retry(
        conflictID: UUID,
        retry: (UUID) async -> SyncConflictRetryOutcome
    ) async -> SyncConflictRetryOutcome {
        guard !isRetrying else { return .cancelled }
        isRetrying = true
        retryingConflictID = conflictID
        retryFailureConflictID = nil
        retryFailureMessage = nil
        defer {
            isRetrying = false
            retryingConflictID = nil
        }
        let outcome = await retry(conflictID)
        if outcome == .failed {
            retryFailureConflictID = conflictID
            retryFailureMessage =
                SyncAccessibilityAnnouncementPolicy.retryFailure.message
            retryAnnouncementGeneration += 1
        }
        return outcome
    }

    func dismiss(
        conflictID: UUID,
        acknowledge: (UUID) async -> Void
    ) async {
        await acknowledge(conflictID)
    }
}

@Observable @MainActor
final class SyncConflictInteractionModel {
    let notice = SyncConflictNoticeModel()
    let carousel = SyncConflictCarouselModel()

    func update(ids: [UUID]) {
        carousel.update(ids: ids)
    }

    func next() {
        guard !notice.isRetrying else { return }
        carousel.next()
    }

    func previous() {
        guard !notice.isRetrying else { return }
        carousel.previous()
    }
}

@Observable @MainActor
final class SyncConflictCarouselModel {
    private var orderedIDs: [UUID] = []
    private(set) var selectedID: UUID?

    var count: Int { orderedIDs.count }

    var position: Int? {
        guard
            let selectedID,
            let index = orderedIDs.firstIndex(of: selectedID)
        else {
            return nil
        }
        return index + 1
    }

    func update(ids: [UUID]) {
        let oldIDs = orderedIDs
        let oldSelection = selectedID
        orderedIDs = ids

        guard !ids.isEmpty else {
            selectedID = nil
            return
        }
        if let oldSelection, ids.contains(oldSelection) {
            selectedID = oldSelection
            return
        }
        guard
            let oldSelection,
            let oldIndex = oldIDs.firstIndex(of: oldSelection)
        else {
            selectedID = ids.first
            return
        }

        if let successor = oldIDs
            .suffix(from: oldIndex + 1)
            .first(where: ids.contains)
        {
            selectedID = successor
            return
        }
        selectedID =
            oldIDs.prefix(upTo: oldIndex).reversed()
                .first(where: ids.contains)
                ?? ids.first
    }

    func next() {
        move(by: 1)
    }

    func previous() {
        move(by: -1)
    }

    private func move(by offset: Int) {
        guard !orderedIDs.isEmpty else { return }
        let current = selectedID.flatMap(orderedIDs.firstIndex) ?? 0
        let next = (current + offset + orderedIDs.count)
            % orderedIDs.count
        selectedID = orderedIDs[next]
    }
}

enum SyncConflictActionLayout: Equatable {
    case horizontal
    case vertical
}

enum SyncConflictActionLayoutPolicy {
    static let candidates: [SyncConflictActionLayout] = [
        .horizontal,
        .vertical,
    ]
    static let minimumTarget: CGFloat = 44
}

struct SyncAccessibilityAnnouncement: Equatable {
    let message: String
}

enum SyncAccessibilityAnnouncementPolicy {
    static let retryFailure = SyncAccessibilityAnnouncement(
        message:
            "Couldn’t retry this change. Your recovery copy is still saved here."
    )

    static func replaySuccess(
        _ presentation: SyncReplayConfirmationPresentation
    ) -> SyncAccessibilityAnnouncement {
        .init(message: presentation.accessibilityLabel)
    }
}

enum SyncReplayConfirmationPolicy {
    static func operations(
        before: [UUID: NativeSyncConflict.Operation],
        afterPendingIDs: Set<UUID>,
        conflicts: [NativeSyncConflict]
    ) -> [NativeSyncConflict.Operation] {
        let terminalIDs = Set(conflicts.map(\.mutationID))
        let succeededIDs = Set(before.keys)
            .subtracting(afterPendingIDs)
            .subtracting(terminalIDs)

        var operations: [NativeSyncConflict.Operation] = []
        for operation in [
            NativeSyncConflict.Operation.taskCreate,
            .activityStatus,
        ] where succeededIDs.contains(where: { before[$0] == operation }) {
            operations.append(operation)
        }
        return operations
    }
}

struct SyncReplayConfirmationPresentation: Equatable {
    let title = "Synced"
    let message: String
    let accessibilityLabel: String

    init(operation: NativeSyncConflict.Operation) {
        let detail: String
        switch operation {
        case .taskCreate:
            detail = "Your Inbox capture is up to date."
        case .activityStatus:
            detail = "Your activity status change is up to date."
        }
        message = detail
        accessibilityLabel = "Sync complete. \(detail)"
    }
}

@Observable @MainActor
final class SyncReplayConfirmationModel {
    private(set) var presentation:
        SyncReplayConfirmationPresentation?
    private(set) var expirationGeneration = 0

    @discardableResult
    func show(
        operation: NativeSyncConflict.Operation,
        announce: (SyncAccessibilityAnnouncement) -> Void
    ) -> Int {
        let next = SyncReplayConfirmationPresentation(
            operation: operation
        )
        presentation = next
        expirationGeneration += 1
        announce(
            SyncAccessibilityAnnouncementPolicy.replaySuccess(next)
        )
        return expirationGeneration
    }

    @discardableResult
    func clear(ifGeneration generation: Int) -> Bool {
        guard generation == expirationGeneration else {
            return false
        }
        presentation = nil
        return true
    }

    func clearForDisappearance() {
        _ = clear(ifGeneration: expirationGeneration)
    }
}

struct SyncConflictNotice: View {
    let presentation: SyncConflictPresentation
    let model: SyncConflictNoticeModel
    let onRetry: (UUID) async -> SyncConflictRetryOutcome
    let onDismiss: (UUID) async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 11) {
                Image(systemName: "arrow.trianglehead.2.clockwise.rotate.90")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.kCatRoseInk)
                    .frame(width: 34, height: 34)
                    .background(
                        RoundedRectangle(
                            cornerRadius: 10,
                            style: .continuous
                        )
                        .fill(Color.kSurfaceRaised.opacity(0.72))
                    )
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 3) {
                    Text(presentation.operationLabel.uppercased())
                        .font(.kBody(10.5, weight: .bold))
                        .tracking(1.1)
                        .foregroundStyle(Color.kCatRoseInk)
                    Text(presentation.title)
                        .font(.kDisplay(17, relativeTo: .headline))
                        .foregroundStyle(Color.kInk)
                    Text(presentation.message)
                        .font(.kBody(13))
                        .foregroundStyle(Color.kInkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
            }

            if
                model.retryFailureConflictID == presentation.id,
                let retryFailureMessage = model.retryFailureMessage
            {
                Text(retryFailureMessage)
                    .font(.kBody(12, weight: .semibold))
                    .foregroundStyle(Color.kCatRoseInk)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel(
                        "Retry failed. \(retryFailureMessage)"
                    )
            }

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) {
                    actionButtons(expand: false)
                }
                VStack(spacing: 8) {
                    actionButtons(expand: true)
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.kCatRose.opacity(0.72))
                .overlay(
                    RoundedRectangle(
                        cornerRadius: 18,
                        style: .continuous
                    )
                    .stroke(
                        Color.kCatRoseInk.opacity(0.24),
                        lineWidth: 1
                    )
                )
        )
        .onChange(of: model.retryAnnouncementGeneration) {
            UIAccessibility.post(
                notification: .announcement,
                argument:
                    SyncAccessibilityAnnouncementPolicy
                        .retryFailure.message
            )
        }
    }

    @ViewBuilder
    private func actionButtons(expand: Bool) -> some View {
        if let retryLabel = presentation.retryAccessibilityLabel {
            Button {
                Task {
                    await model.retry(
                        conflictID: presentation.id,
                        retry: onRetry
                    )
                }
            } label: {
                HStack(spacing: 7) {
                    if model.isRetrying {
                        ProgressView()
                            .controlSize(.small)
                            .tint(.kCatRoseInk)
                    }
                    Text(model.isRetrying ? "Retrying…" : "Retry")
                        .font(.kBody(13, weight: .bold))
                }
                .frame(
                    maxWidth: expand ? .infinity : nil,
                    minHeight:
                        SyncConflictActionLayoutPolicy.minimumTarget
                )
                .padding(.horizontal, 16)
                .background(
                    Capsule()
                        .fill(Color.kSurfaceRaised.opacity(0.72))
                )
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color.kCatRoseInk)
            .disabled(model.isRetrying)
            .accessibilityLabel(
                model.isRetrying
                    ? "Retrying \(presentation.operationLabel) sync"
                    : retryLabel
            )
        }

        Button {
            Task {
                await model.dismiss(
                    conflictID: presentation.id,
                    acknowledge: onDismiss
                )
            }
        } label: {
            Text("Dismiss")
                .font(.kBody(13, weight: .semibold))
                .frame(
                    maxWidth: expand ? .infinity : nil,
                    minHeight:
                        SyncConflictActionLayoutPolicy.minimumTarget
                )
                .padding(.horizontal, 14)
        }
        .buttonStyle(.plain)
        .foregroundStyle(Color.kCatRoseInk)
        .disabled(model.isRetrying)
        .accessibilityLabel(
            presentation.dismissAccessibilityLabel
        )
    }
}

struct SyncReplayConfirmationNotice: View {
    let presentation: SyncReplayConfirmationPresentation

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 16, weight: .semibold))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(presentation.title)
                    .font(.kBody(13, weight: .bold))
                Text(presentation.message)
                    .font(.kBody(12.5))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color.kCatMintInk)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .fill(Color.kCatMint)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(presentation.accessibilityLabel)
    }
}

struct SyncStatusNotices: View {
    @Environment(AppState.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let surface: SyncConflictSurface

    @State private var confirmationTask: Task<Void, Never>?
    @State private var confirmationModel =
        SyncReplayConfirmationModel()
    @State private var interaction =
        SyncConflictInteractionModel()

    private var conflicts: [SyncConflictPresentation] {
        app.syncConflicts.compactMap {
            SyncConflictPresentation(
                conflict: $0,
                surface: surface
            )
        }
    }

    private var conflict: SyncConflictPresentation? {
        guard let selectedID = interaction.carousel.selectedID else {
            return conflicts.first
        }
        return conflicts.first(where: { $0.id == selectedID })
            ?? conflicts.first
    }

    private var reducesStimulation: Bool {
        reduceMotion || app.reducedStimulation
    }

    var body: some View {
        Group {
            if conflict != nil
                || confirmationModel.presentation != nil
            {
                VStack(spacing: 8) {
                    if let conflict {
                        if conflicts.count > 1 {
                            conflictNavigation
                        }
                        SyncConflictNotice(
                            presentation: conflict,
                            model: interaction.notice,
                            onRetry: { id in
                                await app.retrySyncConflict(id: id)
                            },
                            onDismiss: { id in
                                await app.acknowledgeSyncConflict(id: id)
                            }
                        )
                        .id(conflict.id)
                    }
                    if let confirmation =
                        confirmationModel.presentation
                    {
                        SyncReplayConfirmationNotice(
                            presentation: confirmation
                        )
                        .transition(
                            reducesStimulation
                                ? .opacity
                                : .move(edge: .top)
                                    .combined(with: .opacity)
                        )
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
            }
        }
        .onChange(
            of: conflicts.map(\.id),
            initial: true
        ) { _, ids in
            interaction.update(ids: ids)
        }
        .onChange(
            of: app.syncReplayConfirmationGeneration
        ) {
            guard
                app.lastReplayedOperations.contains(surface.operation)
            else {
                return
            }
            showConfirmation()
        }
        .onDisappear {
            confirmationTask?.cancel()
            confirmationTask = nil
            confirmationModel.clearForDisappearance()
        }
    }

    private var conflictNavigation: some View {
        HStack(spacing: 8) {
            Text(
                "\(interaction.carousel.position ?? 1) of \(interaction.carousel.count)"
            )
            .font(.kBody(11, weight: .bold))
            .foregroundStyle(Color.kCatRoseInk)
            .accessibilityLabel(
                "Sync conflict \(interaction.carousel.position ?? 1) of \(interaction.carousel.count)"
            )
            Spacer()
            Button {
                interaction.previous()
            } label: {
                Image(systemName: "chevron.left")
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color.kCatRoseInk)
            .disabled(interaction.notice.isRetrying)
            .accessibilityLabel("Previous sync conflict")

            Button {
                interaction.next()
            } label: {
                Image(systemName: "chevron.right")
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color.kCatRoseInk)
            .disabled(interaction.notice.isRetrying)
            .accessibilityLabel("Next sync conflict")
        }
        .padding(.horizontal, 4)
    }

    private func showConfirmation() {
        confirmationTask?.cancel()
        let generation = withAnimation(
            reducesStimulation
                ? nil
                : .spring(response: 0.35, dampingFraction: 0.86)
        ) {
            confirmationModel.show(
                operation: surface.operation
            ) { announcement in
                UIAccessibility.post(
                    notification: .announcement,
                    argument: announcement.message
                )
            }
        }
        confirmationTask = Task {
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            _ = withAnimation(
                reducesStimulation ? nil : .easeOut(duration: 0.2)
            ) {
                confirmationModel.clear(
                    ifGeneration: generation
                )
            }
        }
    }
}
