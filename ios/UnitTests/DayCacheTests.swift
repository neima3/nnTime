import XCTest
@testable import Kairo

final class DayCacheTests: XCTestCase {
    private var directory: URL!
    private var store: DayCacheStore!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appending(path: "KairoDayCacheTests-\(UUID())")
        store = DayCacheStore(directory: directory)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    func testRoundTripRequiresMatchingScopeAndDate() throws {
        try store.write(
            scope: "account-a",
            date: "2026-07-29",
            zone: "America/New_York",
            blocks: [Self.block(title: "Morning reset")]
        )

        let snapshot = store.read(
            scope: "account-a",
            date: "2026-07-29"
        )

        XCTAssertEqual(snapshot?.scope, "account-a")
        XCTAssertEqual(snapshot?.blocks.map(\.title), ["Morning reset"])
    }

    func testWrongScopeIsRejected() throws {
        try store.write(
            scope: "account-a",
            date: "2026-07-29",
            zone: "UTC",
            blocks: [Self.block()]
        )

        XCTAssertNil(
            store.read(scope: "account-b", date: "2026-07-29")
        )
    }

    func testWrongDateIsRejected() throws {
        try store.write(
            scope: "account-a",
            date: "2026-07-29",
            zone: "UTC",
            blocks: [Self.block()]
        )

        XCTAssertNil(
            store.read(scope: "account-a", date: "2026-07-30")
        )
    }

    func testLegacyUnscopedPayloadIsRejected() throws {
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        let legacy = """
        {"date":"2026-07-29","zone":"UTC","blocks":[],"savedAt":0}
        """
        try XCTUnwrap(legacy.data(using: .utf8)).write(
            to: store.fileURL
        )

        XCTAssertNil(
            store.read(scope: "account-a", date: "2026-07-29")
        )
        XCTAssertNil(store.readLatest())
    }

    func testClearRemovesSnapshot() throws {
        try store.write(
            scope: "account-a",
            date: "2026-07-29",
            zone: "UTC",
            blocks: [Self.block()]
        )

        try store.clear()

        XCTAssertFalse(FileManager.default.fileExists(
            atPath: store.fileURL.path
        ))
        XCTAssertNil(store.readLatest())
    }

    func testReplacementIsCompleteAndProtected() throws {
        try store.write(
            scope: "account-a",
            date: "2026-07-29",
            zone: "UTC",
            blocks: [Self.block(title: "Old")]
        )
        try store.write(
            scope: "account-a",
            date: "2026-07-29",
            zone: "UTC",
            blocks: [Self.block(title: "New")]
        )

        XCTAssertEqual(
            store.readLatest()?.blocks.map(\.title),
            ["New"]
        )
        let attributes = try FileManager.default.attributesOfItem(
            atPath: store.fileURL.path
        )
        XCTAssertEqual(
            store.protection,
            .completeUntilFirstUserAuthentication
        )
        if let applied = attributes[.protectionKey]
            as? FileProtectionType
        {
            XCTAssertEqual(applied, store.protection)
        }
    }

    func testStatusUpdateChangesOnlyExactCachedOccurrence() throws {
        let savedAt = Date(timeIntervalSince1970: 1_722_225_600)
        try store.write(
            DayCacheStore.Snapshot(
                version: DayCacheStore.version,
                scope: "account-a",
                date: "2026-07-29",
                zone: "America/New_York",
                blocks: [
                    Self.block(
                        title: "First occurrence",
                        activityID: "activity-1",
                        occurrenceKey: "2026-07-29T09:00:00"
                    ),
                    Self.block(
                        title: "Second occurrence",
                        activityID: "activity-1",
                        occurrenceKey: "2026-07-29T13:00:00"
                    ),
                    Self.block(
                        title: "Unrelated",
                        activityID: "activity-2",
                        occurrenceKey: "2026-07-29T10:00:00"
                    ),
                ],
                savedAt: savedAt
            )
        )

        let updated = try store.updateStatus(
            scope: "account-a",
            date: "2026-07-29",
            activityID: "activity-1",
            occurrenceKey: "2026-07-29T13:00:00",
            done: true
        )

        XCTAssertFalse(updated.blocks[0].done)
        XCTAssertTrue(updated.blocks[1].done)
        XCTAssertFalse(updated.blocks[2].done)
        XCTAssertEqual(updated.blocks[0].title, "First occurrence")
        XCTAssertEqual(updated.blocks[2].revision, 2)
        XCTAssertEqual(updated.zone, "America/New_York")
        XCTAssertEqual(updated.savedAt, savedAt)
        XCTAssertEqual(store.readLatest()?.blocks, updated.blocks)
    }

    func testStatusUpdateRefusesScopeOrDateMismatchWithoutChangingCache() throws {
        let original = DayCacheStore.Snapshot(
            version: DayCacheStore.version,
            scope: "account-a",
            date: "2026-07-29",
            zone: "UTC",
            blocks: [Self.block()],
            savedAt: Date(timeIntervalSince1970: 100)
        )
        try store.write(original)

        XCTAssertThrowsError(
            try store.updateStatus(
                scope: "account-b",
                date: original.date,
                activityID: "activity-1",
                occurrenceKey: "2026-07-29T09:00:00",
                done: true
            )
        )
        XCTAssertThrowsError(
            try store.updateStatus(
                scope: original.scope,
                date: "2026-07-30",
                activityID: "activity-1",
                occurrenceKey: "2026-07-29T09:00:00",
                done: true
            )
        )

        XCTAssertEqual(store.readLatest()?.blocks, original.blocks)
    }

    func testStatusUpdateRefusesMissingOrAmbiguousOccurrence() throws {
        let duplicate = Self.block()
        try store.write(
            DayCacheStore.Snapshot(
                version: DayCacheStore.version,
                scope: "account-a",
                date: "2026-07-29",
                zone: "UTC",
                blocks: [duplicate, duplicate],
                savedAt: Date()
            )
        )

        XCTAssertThrowsError(
            try store.updateStatus(
                scope: "account-a",
                date: "2026-07-29",
                activityID: "activity-1",
                occurrenceKey: "2026-07-29T09:00:00",
                done: true
            )
        )
        XCTAssertThrowsError(
            try store.updateStatus(
                scope: "account-a",
                date: "2026-07-29",
                activityID: "activity-1",
                occurrenceKey: "missing",
                done: true
            )
        )
    }

    func testStatusUpdateRefusesEmptyOccurrenceIdentity() throws {
        let original = Self.block()
        try store.write(
            scope: "account-a",
            date: "2026-07-29",
            zone: "UTC",
            blocks: [original]
        )

        XCTAssertThrowsError(
            try store.updateStatus(
                scope: "account-a",
                date: "2026-07-29",
                activityID: "",
                occurrenceKey: "2026-07-29T09:00:00",
                done: true
            )
        )
        XCTAssertThrowsError(
            try store.updateStatus(
                scope: "account-a",
                date: "2026-07-29",
                activityID: "activity-1",
                occurrenceKey: " ",
                done: true
            )
        )
        XCTAssertEqual(store.readLatest()?.blocks, [original])
    }

    private static func block(
        title: String = "Plan",
        activityID: String = "activity-1",
        occurrenceKey: String = "2026-07-29T09:00:00"
    ) -> CachedBlock {
        CachedBlock(
            title: title,
            emoji: "✨",
            startMin: 540,
            durationMin: 30,
            done: false,
            category: "iris",
            activityId: activityID,
            revision: 2,
            occurrenceKey: occurrenceKey
        )
    }
}
