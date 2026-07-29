import XCTest
@testable import Kairo

final class CachedDayAdapterTests: XCTestCase {
    func testSnapshotReconstructsReadableDayBlocks() {
        let snapshot = DayCacheStore.Snapshot(
            version: DayCacheStore.version,
            scope: "account-a",
            date: "2026-07-29",
            zone: "America/New_York",
            blocks: [
                CachedBlock(
                    title: "Deep work",
                    emoji: "🧠",
                    startMin: 600,
                    durationMin: 45,
                    done: true,
                    category: "lilac",
                    activityId: "activity-1",
                    revision: 7,
                    occurrenceKey: "occurrence-1"
                ),
            ],
            savedAt: Date()
        )

        let blocks = CachedDayAdapter.blocks(from: snapshot)

        XCTAssertEqual(blocks.count, 1)
        XCTAssertEqual(blocks[0].id, "activity-1")
        XCTAssertEqual(blocks[0].title, "Deep work")
        XCTAssertEqual(blocks[0].category, .lilac)
        XCTAssertTrue(blocks[0].done)
        XCTAssertFalse(blocks[0].recurring)
        XCTAssertTrue(blocks[0].checklist.isEmpty)
    }

    func testMissingIdentityGetsStableSnapshotIdentity() {
        let cached = CachedBlock(
            title: "Walk",
            emoji: "🚶",
            startMin: 720,
            durationMin: 20,
            done: false,
            category: "unknown"
        )
        let snapshot = DayCacheStore.Snapshot(
            version: DayCacheStore.version,
            scope: "account-a",
            date: "2026-07-29",
            zone: "UTC",
            blocks: [cached],
            savedAt: Date()
        )

        let first = CachedDayAdapter.blocks(from: snapshot)[0]
        let second = CachedDayAdapter.blocks(from: snapshot)[0]

        XCTAssertEqual(first.id, second.id)
        XCTAssertEqual(first.category, .sky)
    }
}
