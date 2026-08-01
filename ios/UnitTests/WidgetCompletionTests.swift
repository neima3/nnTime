import Foundation
import XCTest
@testable import Kairo

// MARK: - Shared keychain access group (H03 session bridge)

final class KeychainSessionEnvelopeStoreGroupTests: XCTestCase {
    private static let group = KeychainSessionEnvelopeStore.sharedAccessGroup

    private static func envelope(value: String = "tok") -> NativeSessionEnvelope {
        NativeSessionEnvelope(
            version: 1,
            cookies: [
                NativeSessionCookie(
                    name: "better-auth.session_token",
                    value: value,
                    domain: "time.neima.me",
                    path: "/",
                    secure: true,
                    expiresAt: nil
                ),
            ]
        )
    }

    private static func store(
        _ client: InMemoryKeychainClient
    ) -> KeychainSessionEnvelopeStore {
        KeychainSessionEnvelopeStore(client: client)
    }

    func testSaveWritesIntoSharedAccessGroup() async throws {
        let client = InMemoryKeychainClient()
        try await Self.store(client).save(Self.envelope())

        XCTAssertNotNil(client.item(inGroup: Self.group))
        XCTAssertNil(client.item(inGroup: nil))
    }

    func testLoadMigratesLegacyDefaultGroupItem() async throws {
        let client = InMemoryKeychainClient()
        client.seed(
            try JSONEncoder().encode(Self.envelope(value: "legacy")),
            group: nil
        )

        let loaded = try await Self.store(client).load()

        XCTAssertEqual(loaded?.cookies.first?.value, "legacy")
        XCTAssertNotNil(
            client.item(inGroup: Self.group),
            "legacy item should be re-homed into the shared group"
        )
        XCTAssertNil(client.item(inGroup: nil))
    }

    func testLoadPrefersSharedGroupItem() async throws {
        let client = InMemoryKeychainClient()
        client.seed(
            try JSONEncoder().encode(Self.envelope(value: "legacy")),
            group: nil
        )
        client.seed(
            try JSONEncoder().encode(Self.envelope(value: "shared")),
            group: Self.group
        )

        let loaded = try await Self.store(client).load()

        XCTAssertEqual(loaded?.cookies.first?.value, "shared")
    }

    func testClearRemovesEveryGroup() async throws {
        let client = InMemoryKeychainClient()
        client.seed(Data("junk".utf8), group: nil)
        client.seed(Data("junk".utf8), group: Self.group)

        try await Self.store(client).clear()

        XCTAssertNil(client.item(inGroup: nil))
        XCTAssertNil(client.item(inGroup: Self.group))
    }

    func testCorruptSharedItemClearsAndThrows() async throws {
        let client = InMemoryKeychainClient()
        client.seed(Data("not json".utf8), group: Self.group)

        let store = Self.store(client)
        do {
            _ = try await store.load()
            XCTFail("Expected invalidEnvelope")
        } catch NativeSessionError.invalidEnvelope {
            // Expected.
        }
        XCTAssertNil(client.item(inGroup: Self.group))
    }
}

// MARK: - Complete-from-widget service

final class WidgetCompletionServiceTests: XCTestCase {
    private static let baseURL = URL(string: "https://time.neima.me")!
    private static let occurrenceKey = "2026-08-01T09:00:00.000Z"

    private var directory: URL!
    private var cache: DayCacheStore!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appending(path: "WidgetCompletionTests-\(UUID())")
        cache = DayCacheStore(directory: directory)
        WidgetCompletionURLProtocol.reset()
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private static func envelope(
        expiresAt: Date? = nil
    ) -> NativeSessionEnvelope {
        NativeSessionEnvelope(
            version: 1,
            cookies: [
                NativeSessionCookie(
                    name: "better-auth.session_token",
                    value: "session-secret",
                    domain: "time.neima.me",
                    path: "/",
                    secure: true,
                    expiresAt: expiresAt
                ),
            ]
        )
    }

    private func seedCache(
        scope: String,
        done: Bool = false,
        revision: Int = 7
    ) throws {
        try cache.write(
            scope: scope,
            date: "2026-08-01",
            zone: "America/New_York",
            blocks: [
                CachedBlock(
                    title: "Morning reset",
                    emoji: "🌤",
                    startMin: 540,
                    durationMin: 30,
                    done: done,
                    category: "butter",
                    activityId: "act-1",
                    revision: revision,
                    occurrenceKey: Self.occurrenceKey
                ),
            ]
        )
    }

    private func service(
        envelope: NativeSessionEnvelope?
    ) -> WidgetCompletionService {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [WidgetCompletionURLProtocol.self]
        return WidgetCompletionService(
            baseURL: Self.baseURL,
            session: URLSession(configuration: config),
            envelopeStore: MemorySessionEnvelopeStore(envelope: envelope),
            cacheStore: cache
        )
    }

    func testCompleteSendsContractPatchAndUpdatesCacheAfter2xx() async throws {
        let envelope = Self.envelope()
        let scope = SessionCookieRules.scope(for: envelope.cookies)
        try seedCache(scope: scope)
        WidgetCompletionURLProtocol.respond(
            status: 200,
            body: #"{"id":"act-1","revision":8}"#
        )

        let revision = try await service(envelope: envelope).setDone(
            true,
            activityID: "act-1",
            occurrenceKey: Self.occurrenceKey,
            revision: 7
        )

        XCTAssertEqual(revision, 8)
        let request = try XCTUnwrap(
            WidgetCompletionURLProtocol.captured().first
        )
        XCTAssertEqual(request.httpMethod, "PATCH")
        XCTAssertEqual(
            request.url?.path,
            "/api/v1/activities/act-1"
        )
        XCTAssertEqual(request.value(forHTTPHeaderField: "If-Match"), "7")
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Cookie"),
            "better-auth.session_token=session-secret"
        )
        XCTAssertNotNil(
            request.value(forHTTPHeaderField: "Idempotency-Key")
        )
        let body = try XCTUnwrap(
            WidgetCompletionURLProtocol.capturedBodies().first
        )
        let json = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: body)
                as? [String: Any]
        )
        XCTAssertEqual(json["editScope"] as? String, "this")
        XCTAssertEqual(
            json["occurrenceKey"] as? String,
            Self.occurrenceKey
        )
        XCTAssertEqual(json["status"] as? String, "completed")
        XCTAssertNotNil(json["completedAt"] as? String)

        let snapshot = try XCTUnwrap(cache.readLatest())
        XCTAssertEqual(snapshot.blocks.first?.done, true)
        XCTAssertEqual(snapshot.blocks.first?.revision, 8)
    }

    func testUncompleteSendsPendingWithNullCompletedAt() async throws {
        let envelope = Self.envelope()
        let scope = SessionCookieRules.scope(for: envelope.cookies)
        try seedCache(scope: scope, done: true)
        WidgetCompletionURLProtocol.respond(
            status: 200,
            body: #"{"revision":9}"#
        )

        try await service(envelope: envelope).setDone(
            false,
            activityID: "act-1",
            occurrenceKey: Self.occurrenceKey,
            revision: 7
        )

        let body = try XCTUnwrap(
            WidgetCompletionURLProtocol.capturedBodies().first
        )
        let json = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: body)
                as? [String: Any]
        )
        XCTAssertEqual(json["status"] as? String, "pending")
        XCTAssertTrue(json["completedAt"] is NSNull)
        let snapshot = try XCTUnwrap(cache.readLatest())
        XCTAssertEqual(snapshot.blocks.first?.done, false)
        XCTAssertEqual(snapshot.blocks.first?.revision, 9)
    }

    func testServerRejectionLeavesCacheUntouched() async throws {
        let envelope = Self.envelope()
        let scope = SessionCookieRules.scope(for: envelope.cookies)
        try seedCache(scope: scope)
        WidgetCompletionURLProtocol.respond(
            status: 409,
            body: #"{"error":{"code":"conflict"}}"#
        )

        do {
            try await service(envelope: envelope).setDone(
                true,
                activityID: "act-1",
                occurrenceKey: Self.occurrenceKey,
                revision: 7
            )
            XCTFail("Expected httpStatus failure")
        } catch WidgetCompletionService.Failure.httpStatus(let code) {
            XCTAssertEqual(code, 409)
        }

        let snapshot = try XCTUnwrap(cache.readLatest())
        XCTAssertEqual(snapshot.blocks.first?.done, false)
        XCTAssertEqual(snapshot.blocks.first?.revision, 7)
    }

    func testScopeMismatchFailsBeforeAnyRequest() async throws {
        try seedCache(scope: "someone-else-entirely")

        do {
            try await service(envelope: Self.envelope()).setDone(
                true,
                activityID: "act-1",
                occurrenceKey: Self.occurrenceKey,
                revision: 7
            )
            XCTFail("Expected scopeMismatch")
        } catch WidgetCompletionService.Failure.scopeMismatch {
            // Expected.
        }

        XCTAssertTrue(WidgetCompletionURLProtocol.captured().isEmpty)
        let snapshot = try XCTUnwrap(cache.readLatest())
        XCTAssertEqual(snapshot.blocks.first?.done, false)
    }

    func testExpiredSessionFailsBeforeAnyRequest() async throws {
        let envelope = Self.envelope(
            expiresAt: Date(timeIntervalSinceNow: -3600)
        )
        try seedCache(
            scope: SessionCookieRules.scope(for: envelope.cookies)
        )

        do {
            try await service(envelope: envelope).setDone(
                true,
                activityID: "act-1",
                occurrenceKey: Self.occurrenceKey,
                revision: 7
            )
            XCTFail("Expected notSignedIn")
        } catch WidgetCompletionService.Failure.notSignedIn {
            // Expected.
        }

        XCTAssertTrue(WidgetCompletionURLProtocol.captured().isEmpty)
    }
}

// MARK: - Test doubles

/// Models keychain items per access group, so the migration paths are
/// deterministic — the simulator keychain ignores access groups and would
/// make these tests meaningless against the real SecItem API.
final class InMemoryKeychainClient: KeychainClient, @unchecked Sendable {
    private var groups: [String: Data] = [:]
    private let lock = NSLock()

    private static let defaultGroup = "<default>"

    private static func key(_ group: Any?) -> String {
        (group as? String) ?? defaultGroup
    }

    func seed(_ data: Data, group: String?) {
        lock.withLock {
            groups[group ?? Self.defaultGroup] = data
        }
    }

    func item(inGroup group: String?) -> Data? {
        lock.withLock { groups[group ?? Self.defaultGroup] }
    }

    func copyMatching(
        _ query: [String: Any]
    ) -> (status: OSStatus, data: Data?) {
        lock.withLock {
            if let group = query[kSecAttrAccessGroup as String] as? String {
                guard let data = groups[group] else {
                    return (errSecItemNotFound, nil)
                }
                return (errSecSuccess, data)
            }
            // Group-less searches span every reachable group.
            guard let data = groups.values.first else {
                return (errSecItemNotFound, nil)
            }
            return (errSecSuccess, data)
        }
    }

    func add(_ attributes: [String: Any]) -> OSStatus {
        lock.withLock {
            let group = Self.key(
                attributes[kSecAttrAccessGroup as String]
            )
            guard groups[group] == nil else {
                return errSecDuplicateItem
            }
            guard
                let data = attributes[kSecValueData as String] as? Data
            else {
                return errSecParam
            }
            groups[group] = data
            return errSecSuccess
        }
    }

    func delete(_ query: [String: Any]) -> OSStatus {
        lock.withLock {
            if let group = query[kSecAttrAccessGroup as String] as? String {
                guard groups.removeValue(forKey: group) != nil else {
                    return errSecItemNotFound
                }
                return errSecSuccess
            }
            guard !groups.isEmpty else {
                return errSecItemNotFound
            }
            groups.removeAll()
            return errSecSuccess
        }
    }
}

private final class WidgetCompletionURLProtocol: URLProtocol {
    nonisolated(unsafe) private static var status = 200
    nonisolated(unsafe) private static var body = Data()
    nonisolated(unsafe) private static var requests: [URLRequest] = []
    nonisolated(unsafe) private static var bodies: [Data] = []
    private static let lock = NSLock()

    static func reset() {
        lock.withLock {
            status = 200
            body = Data()
            requests = []
            bodies = []
        }
    }

    static func respond(status: Int, body: String) {
        lock.withLock {
            self.status = status
            self.body = Data(body.utf8)
        }
    }

    static func captured() -> [URLRequest] {
        lock.withLock { requests }
    }

    static func capturedBodies() -> [Data] {
        lock.withLock { bodies }
    }

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(
        for request: URLRequest
    ) -> URLRequest {
        request
    }

    override func startLoading() {
        let requestBody: Data
        if let data = request.httpBody {
            requestBody = data
        } else if let stream = request.httpBodyStream {
            stream.open()
            var collected = Data()
            let bufferSize = 4096
            let buffer = UnsafeMutablePointer<UInt8>.allocate(
                capacity: bufferSize
            )
            defer { buffer.deallocate() }
            while stream.hasBytesAvailable {
                let read = stream.read(buffer, maxLength: bufferSize)
                guard read > 0 else { break }
                collected.append(buffer, count: read)
            }
            stream.close()
            requestBody = collected
        } else {
            requestBody = Data()
        }
        let (status, body) = Self.lock.withLock {
            Self.requests.append(request)
            Self.bodies.append(requestBody)
            return (Self.status, Self.body)
        }
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(
            self,
            didReceive: response,
            cacheStoragePolicy: .notAllowed
        )
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
