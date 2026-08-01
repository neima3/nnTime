import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

// MARK: - App-process executor for the Live Activity's focus buttons (H04)
//
// LiveActivityIntents run in the app process; this is the handler the app
// registers at launch. It drives the same KairoAPI calls the Focus screen
// uses, then reconciles every Live Activity for the session — a failed call
// changes nothing, so the shown state stays honest.

enum FocusRemoteControl {
    static func install() {
        FocusIntentBridge.install { action in
            await perform(action)
        }
    }

    /// The transition a desired-pause request implies, or nil when the
    /// session is already in that state (a stale button tap — no-op).
    static func command(
        forState state: String,
        desiredPaused: Bool
    ) -> FocusCommand? {
        switch (state, desiredPaused) {
        case ("running", true): .transition(.paused)
        case ("paused", false): .transition(.running)
        default: nil
        }
    }

    private static func perform(_ action: FocusIntentAction) async {
        // A background launch for the intent skips scene-driven bootstrap —
        // hydrate cookies from the keychain envelope if nothing is restored.
        if await KairoAPI.shared.currentSessionScope() == nil {
            _ = try? await KairoAPI.shared.restoreSession()
        }
        do {
            let snapshot = try await KairoAPI.shared.activeFocus()
            guard
                let session: FocusSession = snapshot.session,
                session.state == "running" || session.state == "paused"
            else { return }
            switch action {
            case let .setPaused(sessionId, paused):
                guard
                    session.id == sessionId,
                    let command = command(
                        forState: session.state,
                        desiredPaused: paused
                    )
                else { return }
                let updated = try await KairoAPI.shared.focusAction(
                    id: session.id,
                    revision: session.revision,
                    command: command
                )
                await updateActivities(for: sessionId, snapshot: updated)
            case let .complete(sessionId):
                guard session.id == sessionId else { return }
                let remaining = snapshot.remainingSec ?? 0
                let focused = max(
                    1,
                    (session.targetDurationMin * 60 - remaining) / 60
                )
                _ = try await KairoAPI.shared.focusAction(
                    id: session.id,
                    revision: session.revision,
                    command: .transition(.completed)
                )
                await endActivities(for: sessionId)
                let endedAt = Date()
                _ = await HealthKitManager.shared.recordCompletedFocus(
                    sessionId: sessionId,
                    minutes: focused,
                    endedAt: endedAt
                )
            }
            await MainActor.run {
                NotificationCenter.default.post(
                    name: .kairoFocusMutatedExternally,
                    object: nil
                )
            }
        } catch {
            // Server said no or was unreachable — the Live Activity keeps
            // showing the last confirmed state.
        }
    }

    private static func updateActivities(
        for sessionId: String,
        snapshot: FocusSnapshot
    ) async {
#if canImport(ActivityKit)
        guard let session: FocusSession = snapshot.session else { return }
        let remaining = snapshot.remainingSec ?? 0
        let state = FocusAttributes.ContentState(
            endDate: Date().addingTimeInterval(TimeInterval(remaining)),
            paused: session.state == "paused",
            pausedRemainingSec: remaining,
            overtime: session.state == "running" && remaining <= 0
        )
        for activity in ActivityKit.Activity<FocusAttributes>.activities
        where activity.attributes.sessionId == sessionId {
            await activity.update(
                ActivityContent(state: state, staleDate: nil)
            )
        }
#endif
    }

    private static func endActivities(for sessionId: String) async {
#if canImport(ActivityKit)
        for activity in ActivityKit.Activity<FocusAttributes>.activities
        where activity.attributes.sessionId == sessionId {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
#endif
    }
}

extension Notification.Name {
    /// Posted after a Live Activity button mutates focus state so an
    /// on-screen Focus view re-hydrates instead of showing stale state.
    static let kairoFocusMutatedExternally = Notification.Name(
        "kairoFocusMutatedExternally"
    )
}
