import Foundation

struct CachedBlock: Codable {
    let title: String
    let emoji: String
    let startMin: Int
    let durationMin: Int
    let done: Bool
    let category: String
    var activityId: String? = nil
    var revision: Int? = nil
    var occurrenceKey: String? = nil

    var endMin: Int { startMin + durationMin }
}

struct DayCacheStore {
    struct Snapshot: Codable {
        let version: Int
        let scope: String
        let date: String
        let zone: String
        let blocks: [CachedBlock]
        let savedAt: Date
    }

    static let version = 2

    let fileURL: URL
    let protection: FileProtectionType =
        .completeUntilFirstUserAuthentication
    private let fileManager: FileManager

    init(
        directory: URL,
        fileManager: FileManager = .default
    ) {
        fileURL = directory.appending(
            path: "kairo-day-cache-v2.json"
        )
        self.fileManager = fileManager
    }

    func write(
        scope: String,
        date: String,
        zone: String,
        blocks: [CachedBlock]
    ) throws {
        guard !scope.isEmpty else {
            return
        }
        let snapshot = Snapshot(
            version: Self.version,
            scope: scope,
            date: date,
            zone: zone,
            blocks: blocks,
            savedAt: Date()
        )
        try fileManager.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true,
            attributes: [
                .protectionKey: protection,
            ]
        )
        let data = try JSONEncoder().encode(snapshot)
        try data.write(to: fileURL, options: [.atomic])
        try fileManager.setAttributes(
            [.protectionKey: protection],
            ofItemAtPath: fileURL.path
        )
    }

    func read(scope: String, date: String) -> Snapshot? {
        guard
            let snapshot = readLatest(),
            snapshot.scope == scope,
            snapshot.date == date
        else {
            return nil
        }
        return snapshot
    }

    func readLatest() -> Snapshot? {
        guard
            let data = try? Data(contentsOf: fileURL),
            let snapshot = try? JSONDecoder().decode(
                Snapshot.self,
                from: data
            ),
            snapshot.version == Self.version,
            !snapshot.scope.isEmpty
        else {
            return nil
        }
        return snapshot
    }

    func clear() throws {
        guard fileManager.fileExists(atPath: fileURL.path) else {
            return
        }
        try fileManager.removeItem(at: fileURL)
    }
}

enum DayCache {
    static let suiteName = "group.me.neima.kairo"
    private static let legacyKey = "kairo-day-cache-v1"
    private static let store = DayCacheStore(
        directory: cacheDirectory
    )

    typealias Snapshot = DayCacheStore.Snapshot

    static func write(
        scope: String,
        date: String,
        zone: String,
        blocks: [CachedBlock]
    ) {
        removeLegacyCache()
        try? store.write(
            scope: scope,
            date: date,
            zone: zone,
            blocks: blocks
        )
    }

    static func read(scope: String, date: String) -> Snapshot? {
        store.read(scope: scope, date: date)
    }

    static func readLatest() -> Snapshot? {
        store.readLatest()
    }

    static func clear() {
        try? store.clear()
        removeLegacyCache()
    }

    private static var cacheDirectory: URL {
        if let group = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: suiteName
        ) {
            return group.appending(path: "Library/Caches/Kairo")
        }
        return FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0].appending(path: "KairoShared")
    }

    private static func removeLegacyCache() {
        UserDefaults(suiteName: suiteName)?
            .removeObject(forKey: legacyKey)
    }
}
