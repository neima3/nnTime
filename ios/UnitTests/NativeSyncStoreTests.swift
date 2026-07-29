import Foundation
import XCTest
@testable import Kairo

final class NativeSyncStoreTests: XCTestCase {
    private var directory: URL!
    private var store: NativeSyncStore!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory.appending(
            path: "KairoNativeSyncStoreTests-\(UUID())"
        )
        store = NativeSyncStore(directory: directory)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    func testRoundTripPersistsCompleteScopedDocument() throws {
        let document = Self.document(
            cursor: "cursor-2",
            lastSuccessfulSyncAt: Date(timeIntervalSince1970: 1_700_000_000)
        )

        try store.write(document)

        XCTAssertEqual(try store.read(scope: "account-a"), document)
    }

    func testRoundTripPreservesPendingMutationCreationOrder() throws {
        let first = Self.taskCreate(title: "First", key: "key-1")
        let second = Self.activityStatus(activityID: "activity-2", key: "key-2")
        try store.write(Self.document(mutations: [first, second]))

        XCTAssertEqual(
            try store.read(scope: "account-a")?.pendingMutations,
            [first, second]
        )
    }

    func testRoundTripPreservesConflictAndNextAttemptAt() throws {
        let nextAttemptAt = Date(timeIntervalSince1970: 1_700_000_600)
        let mutation = Self.taskCreate(
            title: "Retry me",
            key: "key-retry",
            nextAttemptAt: nextAttemptAt
        )
        let status = Self.activityStatus(
            activityID: "activity-3",
            key: "key-status"
        )
        let conflict = NativeSyncConflict(
            id: UUID(uuidString: "00000000-0000-0000-0000-000000000003")!,
            mutationID: mutation.id,
            operation: "activityStatus",
            recordedAt: Date(timeIntervalSince1970: 1_700_000_700)
        )
        try store.write(
            Self.document(mutations: [mutation, status], conflicts: [conflict])
        )

        let restored = try XCTUnwrap(store.read(scope: "account-a"))
        XCTAssertEqual(restored.pendingMutations.first?.nextAttemptAt, nextAttemptAt)
        XCTAssertEqual(restored.conflicts, [conflict])
        XCTAssertEqual(
            restored.pendingMutations.last?.activityStatus?.occurrenceKey,
            "2026-07-29T09:00:00"
        )
    }

    func testReadRequiresExactScopeAndRemovesMismatchedDocument() throws {
        try store.write(Self.document(scope: "account-a"))

        XCTAssertNil(try store.read(scope: "account-b"))
        XCTAssertFalse(FileManager.default.fileExists(atPath: store.fileURL.path))
        XCTAssertNil(try store.read(scope: "account-a"))
    }

    func testUnsupportedVersionIsRejectedAndRemoved() throws {
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        var unsupported = Self.document()
        unsupported.version = NativeSyncDocument.currentVersion + 1
        try JSONEncoder().encode(unsupported).write(to: store.fileURL)

        XCTAssertNil(try store.read(scope: "account-a"))
        XCTAssertFalse(FileManager.default.fileExists(atPath: store.fileURL.path))
    }

    func testCorruptDocumentIsPreservedAndReadThrows() throws {
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        try Data("not json".utf8).write(to: store.fileURL)

        XCTAssertThrowsError(try store.read(scope: "account-a"))
        XCTAssertTrue(FileManager.default.fileExists(atPath: store.fileURL.path))
    }

    func testEmptyScopeThrowsWithoutRemovingDocument() throws {
        try store.write(Self.document())

        XCTAssertThrowsError(try store.read(scope: ""))
        XCTAssertTrue(FileManager.default.fileExists(atPath: store.fileURL.path))
    }

    func testReplacementLeavesOnlyMostRecentDocumentAndAppliesProtection() throws {
        try store.write(Self.document(cursor: "old"))
        try store.write(Self.document(cursor: "new"))

        XCTAssertEqual(try store.read(scope: "account-a")?.cursor, "new")
        let attributes = try FileManager.default.attributesOfItem(
            atPath: store.fileURL.path
        )
#if targetEnvironment(simulator)
        throw XCTSkip("The iOS Simulator does not expose file protection attributes.")
#else
        XCTAssertEqual(store.protection, .completeUntilFirstUserAuthentication)
        let applied = try XCTUnwrap(
            attributes[.protectionKey] as? FileProtectionType
        )
        XCTAssertEqual(applied, store.protection)
#endif
    }

    func testPurgeRemovesDocument() throws {
        try store.write(Self.document())

        try store.purge()

        XCTAssertFalse(FileManager.default.fileExists(atPath: store.fileURL.path))
        XCTAssertNil(try store.read(scope: "account-a"))
    }

    private static func document(
        scope: String = "account-a",
        cursor: String? = nil,
        mutations: [NativeSyncMutation] = [],
        conflicts: [NativeSyncConflict] = [],
        lastSuccessfulSyncAt: Date? = nil
    ) -> NativeSyncDocument {
        NativeSyncDocument(
            version: NativeSyncDocument.currentVersion,
            scope: scope,
            cursor: cursor,
            pendingMutations: mutations,
            conflicts: conflicts,
            lastSuccessfulSyncAt: lastSuccessfulSyncAt
        )
    }

    private static func taskCreate(
        title: String,
        key: String,
        nextAttemptAt: Date? = nil
    ) -> NativeSyncMutation {
        NativeSyncMutation(
            id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!,
            createdAt: Date(timeIntervalSince1970: 1_700_000_001),
            nextAttemptAt: nextAttemptAt,
            kind: .taskCreate(
                PendingTaskCreate(
                    idempotencyKey: key,
                    title: title,
                    bucket: "inbox"
                )
            )
        )
    }

    private static func activityStatus(
        activityID: String,
        key: String
    ) -> NativeSyncMutation {
        NativeSyncMutation(
            id: UUID(uuidString: "00000000-0000-0000-0000-000000000002")!,
            createdAt: Date(timeIntervalSince1970: 1_700_000_002),
            nextAttemptAt: nil,
            kind: .activityStatus(
                PendingActivityStatus(
                    idempotencyKey: key,
                    activityID: activityID,
                    status: "completed",
                    occurredAt: Date(timeIntervalSince1970: 1_700_000_003),
                    occurrenceKey: "2026-07-29T09:00:00"
                )
            )
        )
    }
}

private extension NativeSyncMutation {
    var activityStatus: PendingActivityStatus? {
        guard case let .activityStatus(status) = kind else {
            return nil
        }
        return status
    }
}
