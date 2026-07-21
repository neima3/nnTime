import AppIntents
import WidgetKit

// MARK: - Complete an occurrence straight from the widget (no app launch)

struct CompleteActivityIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete activity"
    static var isDiscoverable = false

    @Parameter(title: "Activity ID") var activityId: String
    @Parameter(title: "Revision") var revision: Int
    @Parameter(title: "Occurrence key") var occurrenceKey: String?

    init() {}
    init(activityId: String, revision: Int, occurrenceKey: String?) {
        self.activityId = activityId
        self.revision = revision
        self.occurrenceKey = occurrenceKey
    }

    func perform() async throws -> some IntentResult {
        // Optimistic: flip the cache so the widget updates instantly.
        if var snap = DayCache.read() {
            let blocks = snap.blocks.map { b -> CachedBlock in
                guard b.activityId == activityId else { return b }
                return CachedBlock(title: b.title, emoji: b.emoji, startMin: b.startMin,
                                   durationMin: b.durationMin, done: true, category: b.category,
                                   activityId: b.activityId, revision: b.revision, occurrenceKey: b.occurrenceKey)
            }
            DayCache.write(date: snap.date, zone: snap.zone, blocks: blocks)
        }
        _ = await KairoRemote.completeOccurrence(
            activityId: activityId, revision: revision, occurrenceKey: occurrenceKey
        )
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
