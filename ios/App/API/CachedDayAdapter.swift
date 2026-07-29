import Foundation

enum CachedDayAdapter {
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
}
