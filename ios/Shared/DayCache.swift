import Foundation

// MARK: - Shared day snapshot (app writes, widget reads)

struct CachedBlock: Codable {
    let title: String
    let emoji: String
    let startMin: Int
    let durationMin: Int
    let done: Bool
    let category: String
    // Identity for interactive completion from the widget (optional so older
    // caches still decode).
    var activityId: String? = nil
    var revision: Int? = nil
    var occurrenceKey: String? = nil

    var endMin: Int { startMin + durationMin }
}

enum DayCache {
    static let suiteName = "group.me.neima.kairo"
    private static let key = "kairo-day-cache-v1"

    struct Snapshot: Codable {
        let date: String       // YYYY-MM-DD in the planning zone
        let zone: String
        let blocks: [CachedBlock]
        let savedAt: Date
    }

    static func write(date: String, zone: String, blocks: [CachedBlock]) {
        guard let defaults = UserDefaults(suiteName: suiteName) else { return }
        let snap = Snapshot(date: date, zone: zone, blocks: blocks, savedAt: Date())
        if let data = try? JSONEncoder().encode(snap) {
            defaults.set(data, forKey: key)
        }
    }

    static func read() -> Snapshot? {
        guard let defaults = UserDefaults(suiteName: suiteName),
              let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(Snapshot.self, from: data)
    }
}
