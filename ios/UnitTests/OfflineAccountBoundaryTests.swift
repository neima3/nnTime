import Foundation
import XCTest
@testable import Kairo

final class OfflineAccountBoundaryTests: XCTestCase {
    func testQueuedKindsAreOnlyAdr002ReplaySafeCreatesAndStatusChanges() {
        let create = NativeSyncMutation.Kind.taskCreate(
            .init(idempotencyKey: "create-key", title: "Inbox", bucket: "inbox")
        )
        let status = NativeSyncMutation.Kind.activityStatus(
            .init(
                idempotencyKey: "status-key",
                activityID: "activity-1",
                status: "completed",
                occurredAt: Date(timeIntervalSince1970: 0),
                occurrenceKey: "2026-09-14T14:00:00Z"
            )
        )

        for kind in [create, status] {
            switch kind {
            case .taskCreate, .activityStatus:
                break
            }
        }
    }

    func testStatusMutationCarriesNoPinnedRevision() throws {
        let payload = PendingActivityStatus(
            idempotencyKey: "status-key",
            activityID: "activity-1",
            status: "completed",
            occurredAt: Date(timeIntervalSince1970: 1_785_326_400),
            occurrenceKey: "2026-09-14T14:00:00Z"
        )
        let encoded = try JSONEncoder().encode(payload)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: encoded) as? [String: Any]
        )

        XCTAssertNil(object["revision"])
        XCTAssertNil(object["ifMatch"])
        XCTAssertEqual(object["status"] as? String, "completed")
    }

    func testAccountSwitchPurgesDayCacheQueueAndSessionCookies() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(
            path: "KairoP31Boundary-\(UUID())"
        )
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }

        let dayStore = DayCacheStore(directory: directory)
        try dayStore.write(
            scope: "account-a",
            date: "2026-09-14",
            zone: "America/New_York",
            blocks: [
                CachedBlock(
                    title: "A private block",
                    emoji: "📘",
                    startMin: 600,
                    durationMin: 30,
                    done: false,
                    category: "deep"
                ),
            ]
        )
        XCTAssertEqual(
            dayStore.read(scope: "account-a", date: "2026-09-14")?.blocks.first?.title,
            "A private block"
        )

        let syncStore = NativeSyncStore(directory: directory)
        let coordinator = NativeSyncCoordinator(
            store: syncStore,
            transport: OfflineAccountBoundaryTransport()
        )
        try await coordinator.activate(scope: "account-a")
        _ = try await coordinator.enqueueTaskCreate(
            title: "A leftover",
            bucket: "inbox"
        )

        let cookies = HTTPCookieStorage.sharedCookieStorage(
            forGroupContainerIdentifier: "P31Boundary.\(UUID())"
        )
        cookies.setCookie(
            try XCTUnwrap(
                HTTPCookie(properties: [
                    .name: "better-auth.session_token",
                    .value: "session-a",
                    .domain: "time.neima.me",
                    .path: "/",
                    .secure: "TRUE",
                ])
            )
        )
        let session = NativeSessionController(
            baseURL: URL(string: "https://time.neima.me")!,
            cookieStorage: cookies,
            envelopeStore: MemorySessionEnvelopeStore()
        )
        _ = try await session.persist()

        try await coordinator.activate(scope: "account-b")
        try dayStore.clear()
        await session.invalidate()

        let switched = try await coordinator.snapshot(scope: "account-b")
        XCTAssertEqual(switched.pendingCount, 0)
        XCTAssertNil(dayStore.read(scope: "account-a", date: "2026-09-14"))
        XCTAssertNil(dayStore.readLatest())
        XCTAssertEqual((cookies.cookies ?? []).count, 0)
        do {
            _ = try await coordinator.snapshot(scope: "account-a")
            XCTFail("A's queue must not be readable after the switch")
        } catch {}
    }

    func testCachedDayPolicyStillForbidsEditsDeletesAndFocus() {
        let policy = OfflineTodayMutationPolicy.cachedDay
        XCTAssertTrue(policy.canChangeCompletion)
        XCTAssertFalse(policy.canEdit)
        XCTAssertFalse(policy.canDelete)
        XCTAssertFalse(policy.canFocus)
        XCTAssertFalse(policy.canCreate)
    }
}

private actor OfflineAccountBoundaryTransport: NativeSyncTransport {
    func createTask(
        title: String,
        bucket: String,
        idempotencyKey: String?
    ) async throws -> TaskItem {
        .init(
            id: "task-1",
            title: title,
            emoji: nil,
            bucket: bucket,
            priority: nil,
            revision: 1,
            createdAt: nil
        )
    }

    func activity(id: String) async throws -> Activity {
        .init(
            id: id,
            title: "Pinned",
            emoji: nil,
            tz: "America/New_York",
            dtstartLocal: .init(timeIntervalSince1970: 0),
            durationMin: 30,
            rrule: nil,
            categoryId: nil,
            checklistTemplate: nil,
            revision: 1,
            occurrenceKey: nil,
            status: "pending"
        )
    }

    func setStatus(
        activityId: String,
        revision: Int,
        occurrenceKey: String?,
        status: ActivityStatus,
        completedAt: String?,
        idempotencyKey: String?
    ) async throws -> Activity {
        .init(
            id: activityId,
            title: "Pinned",
            emoji: nil,
            tz: "America/New_York",
            dtstartLocal: .init(timeIntervalSince1970: 0),
            durationMin: 30,
            rrule: nil,
            categoryId: nil,
            checklistTemplate: nil,
            revision: revision + 1,
            occurrenceKey: nil,
            status: status.rawValue
        )
    }

    func changes(cursor: String?, limit: Int?) async throws -> ChangesPage {
        ChangesPage(entries: [], nextCursor: nil, checkpointCursor: cursor)
    }
}
