import AppIntents
import WidgetKit

/// The Next Up widget's done button (H03). Runs in the widget extension:
/// network-first through WidgetCompletionService, then a timeline reload so
/// the row re-renders from the confirmed cache. A thrown error leaves the
/// timeline untouched — WidgetKit rolls the button back, which is the honest
/// state when the server never heard the tap.
struct CompleteBlockIntent: AppIntent {
    static let title: LocalizedStringResource = "Mark activity done"
    static let isDiscoverable = false

    @Parameter(title: "Activity") var activityID: String
    @Parameter(title: "Occurrence") var occurrenceKey: String
    @Parameter(title: "Revision") var revision: Int
    @Parameter(title: "Done") var done: Bool

    init() {}

    init(
        activityID: String,
        occurrenceKey: String,
        revision: Int,
        done: Bool
    ) {
        self.activityID = activityID
        self.occurrenceKey = occurrenceKey
        self.revision = revision
        self.done = done
    }

    func perform() async throws -> some IntentResult {
        try await WidgetCompletionService.live().setDone(
            done,
            activityID: activityID,
            occurrenceKey: occurrenceKey,
            revision: revision
        )
        WidgetCenter.shared.reloadTimelines(ofKind: "KairoNextUp")
        return .result()
    }
}
