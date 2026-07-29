import Foundation

struct CachedBlock: Codable, Equatable {
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
    enum StoreError: Error, Equatable {
        case invalidSnapshot
        case scopeMismatch
        case dateMismatch
        case invalidOccurrenceIdentity
        case occurrenceNotFound
        case ambiguousOccurrence
    }

    struct Snapshot: Codable, Equatable {
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
        try write(snapshot)
    }

    func write(_ snapshot: Snapshot) throws {
        guard
            snapshot.version == Self.version,
            !snapshot.scope.isEmpty
        else {
            throw StoreError.invalidSnapshot
        }
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

    @discardableResult
    func updateStatus(
        scope: String,
        date: String,
        activityID: String,
        occurrenceKey: String,
        done: Bool
    ) throws -> Snapshot {
        guard
            !activityID.trimmingCharacters(
                in: .whitespacesAndNewlines
            ).isEmpty,
            !occurrenceKey.trimmingCharacters(
                in: .whitespacesAndNewlines
            ).isEmpty
        else {
            throw StoreError.invalidOccurrenceIdentity
        }
        guard
            let data = try? Data(contentsOf: fileURL),
            let snapshot = try? JSONDecoder().decode(
                Snapshot.self,
                from: data
            ),
            snapshot.version == Self.version,
            !snapshot.scope.isEmpty
        else {
            throw StoreError.invalidSnapshot
        }
        guard snapshot.scope == scope else {
            throw StoreError.scopeMismatch
        }
        guard snapshot.date == date else {
            throw StoreError.dateMismatch
        }

        let matches = snapshot.blocks.indices.filter { index in
            snapshot.blocks[index].activityId == activityID
                && snapshot.blocks[index].occurrenceKey == occurrenceKey
        }
        guard !matches.isEmpty else {
            throw StoreError.occurrenceNotFound
        }
        guard matches.count == 1, let index = matches.first else {
            throw StoreError.ambiguousOccurrence
        }

        var blocks = snapshot.blocks
        let block = blocks[index]
        blocks[index] = CachedBlock(
            title: block.title,
            emoji: block.emoji,
            startMin: block.startMin,
            durationMin: block.durationMin,
            done: done,
            category: block.category,
            activityId: block.activityId,
            revision: block.revision,
            occurrenceKey: block.occurrenceKey
        )
        let updated = Snapshot(
            version: snapshot.version,
            scope: snapshot.scope,
            date: snapshot.date,
            zone: snapshot.zone,
            blocks: blocks,
            savedAt: snapshot.savedAt
        )
        try write(updated)
        return updated
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

    @discardableResult
    static func updateStatus(
        scope: String,
        date: String,
        activityID: String,
        occurrenceKey: String,
        done: Bool
    ) throws -> Snapshot {
        try store.updateStatus(
            scope: scope,
            date: date,
            activityID: activityID,
            occurrenceKey: occurrenceKey,
            done: done
        )
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
