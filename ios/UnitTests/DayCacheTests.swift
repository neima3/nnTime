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

    private static func block(
        title: String = "Plan"
    ) -> CachedBlock {
        CachedBlock(
            title: title,
            emoji: "✨",
            startMin: 540,
            durationMin: 30,
            done: false,
            category: "iris",
            activityId: "activity-1",
            revision: 2,
            occurrenceKey: "2026-07-29T09:00:00"
        )
    }
}
