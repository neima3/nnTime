import Foundation

/// Review Today only judges blocks that have actually had their chance.
/// Mirrors `src/lib/review-window.ts` so web and native cannot diverge.
enum ReviewWindow {
    static func partition<T>(
        _ items: [T],
        nowMin: Int?,
        startMin: (T) -> Int,
        durationMin: (T) -> Int
    ) -> (past: [T], upcoming: Int) {
        guard let nowMin else { return (items, 0) }
        let past = items.filter { startMin($0) + durationMin($0) <= nowMin }
        return (past, items.count - past.count)
    }

    static func partition(_ items: [DayBlock], nowMin: Int?) -> (past: [DayBlock], upcoming: Int) {
        partition(
            items,
            nowMin: nowMin,
            startMin: { $0.startMin },
            durationMin: { $0.durationMin }
        )
    }
}
