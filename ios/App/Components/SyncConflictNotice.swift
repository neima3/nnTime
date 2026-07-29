import SwiftUI

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
        title = "Server version kept"
        canRetry = conflict.retryMutation != nil

        switch conflict.operation {
        case .taskCreate:
            operationLabel = "Inbox capture"
            message = canRetry
                ? "Your Inbox capture couldn’t be saved. Retry sync, or dismiss this notice."
                : "This older Inbox capture can’t be retried. Dismiss this notice when you’re ready."
        case .activityStatus:
            operationLabel = "Activity status change"
            message = canRetry
                ? "Your activity status change couldn’t be applied. Retry sync, or dismiss this notice."
                : "This older activity status change can’t be retried. Dismiss this notice when you’re ready."
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

    func retry(
        conflictID: UUID,
        retry: (UUID) async -> Void
    ) async {
        guard !isRetrying else { return }
        isRetrying = true
        defer { isRetrying = false }
        await retry(conflictID)
    }

    func dismiss(
        conflictID: UUID,
        acknowledge: (UUID) async -> Void
    ) async {
        await acknowledge(conflictID)
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

struct SyncConflictNotice: View {
    let presentation: SyncConflictPresentation
    let onRetry: (UUID) async -> Void
    let onDismiss: (UUID) async -> Void

    @State private var model = SyncConflictNoticeModel()

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

            HStack(spacing: 8) {
                if let retryLabel =
                    presentation.retryAccessibilityLabel
                {
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
                        .frame(minHeight: 44)
                        .padding(.horizontal, 16)
                        .background(
                            Capsule()
                                .fill(
                                    Color.kSurfaceRaised.opacity(0.72)
                                )
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
                        .frame(minHeight: 44)
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

    @State private var confirmation:
        SyncReplayConfirmationPresentation?
    @State private var confirmationTask: Task<Void, Never>?

    private var conflict: SyncConflictPresentation? {
        app.syncConflicts.lazy.compactMap {
            SyncConflictPresentation(
                conflict: $0,
                surface: surface
            )
        }.first
    }

    private var reducesStimulation: Bool {
        reduceMotion || app.reducedStimulation
    }

    var body: some View {
        Group {
            if conflict != nil || confirmation != nil {
                VStack(spacing: 8) {
                    if let conflict {
                        SyncConflictNotice(
                            presentation: conflict,
                            onRetry: { id in
                                await app.retrySyncConflict(id: id)
                            },
                            onDismiss: { id in
                                await app.acknowledgeSyncConflict(id: id)
                            }
                        )
                    }
                    if let confirmation {
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
        }
    }

    private func showConfirmation() {
        confirmationTask?.cancel()
        let next = SyncReplayConfirmationPresentation(
            operation: surface.operation
        )
        withAnimation(
            reducesStimulation
                ? nil
                : .spring(response: 0.35, dampingFraction: 0.86)
        ) {
            confirmation = next
        }
        confirmationTask = Task {
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            withAnimation(
                reducesStimulation ? nil : .easeOut(duration: 0.2)
            ) {
                confirmation = nil
            }
        }
    }
}
