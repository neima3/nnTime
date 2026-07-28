import Foundation
import HTTPTypes
import KairoAPIClient
import OpenAPIRuntime
import XCTest
@testable import Kairo

final class KairoAPITransportTests: XCTestCase {
    func testEveryShippingPlannerOperationUsesGeneratedTransportAndAdaptsResponses() async throws {
        let recorder = PlannerRequestRecorder()
        let keys = DeterministicKeySource()
        let api = KairoAPI(
            baseURL: URL(string: "http://127.0.0.1:3456")!,
            plannerTransport: PlannerMockTransport(
                recorder: recorder,
                responder: { operation in
                    Self.successResponse(operation)
                }
            ),
            timezoneIdentifierProvider: { "America/Chicago" },
            idempotencyKeyProvider: { keys.next() }
        )

        let settings = try await api.settings()
        XCTAssertEqual(settings.notificationPrefs?["reminders"], .boolean(true))
        let updatedSettings = try await api.updateSettings(
            update: .init(
                weekStart: .monday,
                notificationPrefs: ["reminders": .boolean(false)]
            ),
            revision: 7
        )
        XCTAssertEqual(updatedSettings.revision, 8)

        let categories = try await api.categories()
        XCTAssertEqual(categories.map(\.key), ["sky"])

        let day = try await api.day("2026-07-28")
        XCTAssertEqual(day.activities.first?.title, "Plan the day")

        let createdActivity = try await api.createActivity(
            tz: "America/Chicago",
            dtstartLocal: "2026-07-28T09:00:00-05:00",
            title: "Plan the day",
            emoji: "🗓️",
            durationMin: 25,
            rrule: nil,
            categoryId: "category-1",
            checklist: [.init(label: "Pick three", done: false)]
        )
        XCTAssertEqual(createdActivity.revision, 2)
        _ = try await api.setStatus(
            activityId: "activity-1",
            revision: 2,
            occurrenceKey: "2026-07-28T14:00:00Z",
            status: .completed,
            completedAt: "2026-07-28T14:25:00Z"
        )
        _ = try await api.updateActivity(
            activityId: "activity-1",
            revision: 2,
            update: .init(
                title: "Updated plan",
                emoji: .null,
                categoryId: .value("category-1"),
                durationMin: 30
            )
        )
        _ = try await api.moveActivity(
            activityId: "activity-1",
            revision: 2,
            occurrenceKey: "2026-07-28T14:00:00Z",
            startAt: "2026-07-28T15:00:00Z"
        )
        _ = try await api.setChecklist(
            activityId: "activity-1",
            revision: 2,
            occurrenceKey: "2026-07-28T14:00:00Z",
            checklist: [.init(label: "Pick three", done: true)]
        )
        try await api.deleteActivity(activityId: "activity-1", revision: 2)

        let tasks = try await api.tasks(bucket: "inbox")
        XCTAssertEqual(tasks.first?.title, "Capture this")
        let task = try await api.createTask(title: "Capture this", bucket: "inbox")
        XCTAssertEqual(task.revision, 3)
        try await api.deleteTask(id: "task-1", revision: 3)

        let search = try await api.search("plan", limit: 12)
        XCTAssertEqual(search.items.first?.matchedOn, "title")
        let stats = try await api.stats()
        XCTAssertEqual(stats.totalFocusMin, 25)
        try await api.postMood("good")

        let routines = try await api.routines()
        XCTAssertEqual(routines.first?.orderedSteps.first?.title, "Water")

        let active = try await api.activeFocus()
        XCTAssertEqual(active.remainingSec, 1_200)
        let started = try await api.startFocus(
            minutes: 25,
            title: "Plan",
            emoji: "🎯"
        )
        XCTAssertEqual(started.session?.state, "running")
        let transitioned = try await api.focusAction(
            id: "focus-1",
            revision: 1,
            command: .transition(.paused)
        )
        XCTAssertEqual(transitioned.session?.state, "paused")

        let captures = await recorder.captures
        XCTAssertEqual(captures.count, 20)
        XCTAssertEqual(
            Set(captures.map(\.operationID)),
            [
                "getUserSettings",
                "updateUserSettings",
                "listCategories",
                "getDay",
                "createActivitySeries",
                "updateActivitySeries",
                "deleteActivitySeries",
                "listTasks",
                "createTask",
                "deleteTask",
                "search",
                "getStats",
                "createMoodCheckin",
                "listRoutines",
                "getActiveFocusSession",
                "startFocusSession",
                "updateFocusSession",
            ]
        )
        XCTAssertEqual(
            Set(captures.map { "\($0.method) \($0.path)" }),
            [
                "GET /settings",
                "PATCH /settings",
                "GET /categories",
                "GET /day/2026-07-28",
                "POST /activities",
                "PATCH /activities/activity-1?editScope=this",
                "PATCH /activities/activity-1?editScope=all",
                "DELETE /activities/activity-1?editScope=all",
                "GET /tasks?bucket=inbox",
                "POST /tasks",
                "DELETE /tasks/task-1",
                "GET /search?q=plan&limit=12",
                "GET /stats",
                "POST /mood",
                "GET /routines",
                "GET /focus-sessions",
                "POST /focus-sessions",
                "PATCH /focus-sessions/focus-1",
            ]
        )
        XCTAssertTrue(captures.allSatisfy {
            $0.headers["x-timezone"] == "America/Chicago"
        })

        let dayCapture = try XCTUnwrap(
            captures.first { $0.operationID == "getDay" }
        )
        XCTAssertEqual(dayCapture.method, "GET")
        XCTAssertEqual(dayCapture.path, "/day/2026-07-28")

        let taskList = try XCTUnwrap(
            captures.first { $0.operationID == "listTasks" }
        )
        XCTAssertEqual(taskList.path, "/tasks?bucket=inbox")
        let searchCapture = try XCTUnwrap(
            captures.first { $0.operationID == "search" }
        )
        XCTAssertEqual(searchCapture.path, "/search?q=plan&limit=12")

        let settingsPatch = try XCTUnwrap(
            captures.first { $0.operationID == "updateUserSettings" }
        )
        XCTAssertEqual(settingsPatch.headers["if-match"], "7")
        XCTAssertEqual(
            try settingsPatch.jsonBody()["notificationPrefs"] as? [String: Bool],
            ["reminders": false]
        )

        let activityCreates = captures.filter {
            $0.operationID == "createActivitySeries"
        }
        XCTAssertEqual(activityCreates.count, 1)
        XCTAssertEqual(
            try activityCreates[0].jsonBody()["durationMin"] as? Int,
            25
        )
        XCTAssertEqual(
            (
                try activityCreates[0].jsonBody()["checklistTemplate"]
                    as? [[String: Any]]
            )?.first?["label"] as? String,
            "Pick three"
        )
        let activityUpdates = captures.filter {
            $0.operationID == "updateActivitySeries"
        }
        XCTAssertEqual(activityUpdates.count, 4)
        XCTAssertTrue(activityUpdates.allSatisfy {
            $0.headers["if-match"] == "2"
        })
        XCTAssertTrue(activityUpdates.contains {
            let body = try? $0.jsonBody()
            return body?["status"] as? String == "completed"
                && body?["editScope"] as? String == "this"
        })
        XCTAssertTrue(activityUpdates.contains {
            let body = try? $0.jsonBody()
            return body?["title"] as? String == "Updated plan"
                && body?.keys.contains("emoji") == true
                && body?["emoji"] is NSNull
                && body?["editScope"] as? String == "all"
        })
        XCTAssertTrue(activityUpdates.contains {
            let body = try? $0.jsonBody()
            return body?["startAt"] as? String == "2026-07-28T15:00:00Z"
        })
        XCTAssertTrue(activityUpdates.contains {
            let body = try? $0.jsonBody()
            let checklist = body?["checklistOverride"] as? [[String: Any]]
            return checklist?.first?["done"] as? Bool == true
        })

        let mutationCaptures = captures.filter {
            $0.method != "GET"
        }
        let mutationKeys = try mutationCaptures.map {
            try XCTUnwrap($0.headers["idempotency-key"])
        }
        XCTAssertEqual(Set(mutationKeys).count, mutationKeys.count)
        XCTAssertTrue(mutationKeys.allSatisfy(Self.isUUIDv7Compatible))
        XCTAssertEqual(
            captures.first { $0.operationID == "deleteActivitySeries" }?
                .headers["if-match"],
            "2"
        )
        XCTAssertEqual(
            captures.first { $0.operationID == "deleteTask" }?
                .headers["if-match"],
            "3"
        )
        let taskCreate = try XCTUnwrap(
            captures.first { $0.operationID == "createTask" }
        )
        XCTAssertEqual(try taskCreate.jsonBody()["title"] as? String, "Capture this")
        XCTAssertEqual(try taskCreate.jsonBody()["bucket"] as? String, "inbox")
        let moodCreate = try XCTUnwrap(
            captures.first { $0.operationID == "createMoodCheckin" }
        )
        XCTAssertEqual(try moodCreate.jsonBody()["mood"] as? String, "good")
        let focusStart = try XCTUnwrap(
            captures.first { $0.operationID == "startFocusSession" }
        )
        XCTAssertEqual(
            try focusStart.jsonBody()["targetDurationMin"] as? Int,
            25
        )
        XCTAssertEqual(try focusStart.jsonBody()["title"] as? String, "Plan")
        let focusUpdate = try XCTUnwrap(
            captures.first { $0.operationID == "updateFocusSession" }
        )
        XCTAssertEqual(focusUpdate.headers["if-match"], "1")
        XCTAssertEqual(
            try focusUpdate.jsonBody()["action"] as? String,
            "transition"
        )
        XCTAssertEqual(
            try focusUpdate.jsonBody()["state"] as? String,
            "paused"
        )
    }

    func testSettingsDecodesRFC3339TimestampsWithAndWithoutFractions() async throws {
        for timestamp in [
            "2026-07-28T16:02:47Z",
            "2026-07-28T16:02:47.872Z",
        ] {
            let api = KairoAPI(
                baseURL: URL(string: "http://127.0.0.1:3456")!,
                plannerTransport: PlannerMockTransport(
                    recorder: PlannerRequestRecorder()
                ) { operation in
                    XCTAssertEqual(operation, "getUserSettings")
                    return .init(
                        status: .ok,
                        body: Self.settingsJSON(
                            revision: 7,
                            timestamp: timestamp
                        )
                    )
                },
                timezoneIdentifierProvider: { "UTC" },
                idempotencyKeyProvider: {
                    "019fa64f-32f2-7001-8296-34373d7c90a0"
                }
            )

            let settings = try await api.settings()
            XCTAssertEqual(settings.revision, 7)
        }
    }

    func testDocumentedErrorsPreserveMessageConflictDetailsAndStatus() async throws {
        let recorder = PlannerRequestRecorder()
        let api = KairoAPI(
            baseURL: URL(string: "http://127.0.0.1:3456")!,
            plannerTransport: PlannerMockTransport(
                recorder: recorder
            ) { operation in
                switch operation {
                case "getDay":
                    return .init(
                        status: .badRequest,
                        body: Self.errorEnvelope(
                            code: "BAD_DATE",
                            message: "Use YYYY-MM-DD",
                            retryable: true
                        )
                    )
                case "getUserSettings":
                    return .init(
                        status: .unauthorized,
                        body: Self.errorEnvelope(
                            code: "UNAUTHORIZED",
                            message: "Session expired"
                        )
                    )
                default:
                    return .init(
                        status: .conflict,
                        body: Self.errorEnvelope(
                            code: "REVISION_CONFLICT",
                            message: "Settings changed elsewhere",
                            details: #"{"currentRevision":9}"#
                        )
                    )
                }
            },
            timezoneIdentifierProvider: { "UTC" },
            idempotencyKeyProvider: {
                "019fa64f-32f2-7001-8296-34373d7c90a0"
            }
        )

        do {
            _ = try await api.day("not-a-date")
            XCTFail("Expected bad request")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 400)
            XCTAssertEqual(error.serverError?.code, "BAD_DATE")
            XCTAssertEqual(error.serverError?.message, "Use YYYY-MM-DD")
            XCTAssertEqual(error.serverError?.retryable, true)
            XCTAssertNil(error.serverError?.details)
        }

        do {
            _ = try await api.settings()
            XCTFail("Expected unauthorized")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 401)
            XCTAssertEqual(error.serverError?.code, "UNAUTHORIZED")
            XCTAssertEqual(error.serverError?.message, "Session expired")
            XCTAssertEqual(error.serverError?.retryable, false)
            XCTAssertNil(error.serverError?.details)
        }

        do {
            _ = try await api.updateSettings(
                update: .init(theme: .dark),
                revision: 8
            )
            XCTFail("Expected conflict")
        } catch let error as APIError {
            XCTAssertEqual(error.statusCode, 409)
            XCTAssertEqual(error.serverError?.code, "REVISION_CONFLICT")
            XCTAssertEqual(
                error.serverError?.message,
                "Settings changed elsewhere"
            )
            XCTAssertEqual(error.serverError?.retryable, false)
            XCTAssertEqual(
                error.serverError?.details,
                .object(["currentRevision": .integer(9)])
            )
        }
    }

    func testMalformedGeneratedResponseMapsWrappedDecodingErrorToDecoding() async {
        let api = KairoAPI(
            baseURL: URL(string: "http://127.0.0.1:3456")!,
            plannerTransport: PlannerMockTransport(
                recorder: PlannerRequestRecorder()
            ) { operation in
                XCTAssertEqual(operation, "getUserSettings")
                return .init(
                    status: .ok,
                    body: #"{"userId":7}"#
                )
            },
            timezoneIdentifierProvider: { "UTC" },
            idempotencyKeyProvider: {
                "019fa64f-32f2-7001-8296-34373d7c90a0"
            }
        )

        do {
            _ = try await api.settings()
            XCTFail("Expected malformed generated response to fail")
        } catch let APIError.decoding(error) {
            XCTAssertTrue(error is DecodingError)
        } catch {
            XCTFail("Expected APIError.decoding, got \(error)")
        }
    }

    func testUUIDv7GeneratorUsesTimestampVersionVariantAndNeverReusesKeys() {
        let first = UUIDv7Generator.generate(
            timestampMilliseconds: 1_753_707_600_000,
            randomBytes: Array(0...9)
        )
        let second = UUIDv7Generator.generate(
            timestampMilliseconds: 1_753_707_600_001,
            randomBytes: Array(10...19)
        )

        XCTAssertTrue(Self.isUUIDv7Compatible(first))
        XCTAssertTrue(Self.isUUIDv7Compatible(second))
        XCTAssertNotEqual(first, second)
        XCTAssertEqual(
            first.replacingOccurrences(of: "-", with: "").prefix(12),
            "0198511e5880"
        )
        let variantNibble = first.split(separator: "-")[3].first
        XCTAssertTrue(["8", "9", "a", "b"].contains(variantNibble))
    }

    func testPlannerCancellationRemainsCancellation() async {
        let api = KairoAPI(
            baseURL: URL(string: "http://127.0.0.1:3456")!,
            plannerTransport: CancellationPlannerTransport(),
            timezoneIdentifierProvider: { "UTC" },
            idempotencyKeyProvider: {
                "019fa64f-32f2-7001-8296-34373d7c90a0"
            }
        )

        do {
            _ = try await api.settings()
            XCTFail("Expected cancellation")
        } catch {
            XCTAssertTrue(error is CancellationError)
        }
    }

    func testSignOutClearsOnlyConfiguredKairoAuthCookies() async throws {
        let storage = HTTPCookieStorage.sharedCookieStorage(
            forGroupContainerIdentifier: "KairoAPITransportTests.\(UUID())"
        )
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = storage
        configuration.httpShouldSetCookies = true
        configuration.protocolClasses = [SuccessfulAuthURLProtocol.self]
        let session = URLSession(configuration: configuration)
        let cookies = try [
            Self.cookie(
                name: "better-auth.session_token",
                domain: "time.neima.me",
                path: "/"
            ),
            Self.cookie(
                name: "analytics",
                domain: "time.neima.me",
                path: "/"
            ),
            Self.cookie(
                name: "better-auth.session_token",
                domain: "other.neima.me",
                path: "/"
            ),
            Self.cookie(
                name: "better-auth.session_token",
                domain: "time.neima.me",
                path: "/other"
            ),
        ]
        for cookie in cookies {
            storage.setCookie(cookie)
        }
        let api = KairoAPI(
            baseURL: URL(string: "https://time.neima.me")!,
            session: session
        )

        await api.signOut()

        XCTAssertEqual(
            Set((storage.cookies ?? []).map {
                "\($0.name)|\($0.domain)|\($0.path)"
            }),
            [
                "analytics|time.neima.me|/",
                "better-auth.session_token|other.neima.me|/",
                "better-auth.session_token|time.neima.me|/other",
            ]
        )
    }

    func testShippingAppContainsNoPlannerPathLiteral() throws {
        let appDirectory = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "App")
        let enumerator = try XCTUnwrap(
            FileManager.default.enumerator(
                at: appDirectory,
                includingPropertiesForKeys: nil
            )
        )
        let offenders = try enumerator.compactMap { item -> String? in
            guard
                let url = item as? URL,
                url.pathExtension == "swift",
                try String(contentsOf: url).contains("/api/v1")
            else {
                return nil
            }
            return url.path
        }

        XCTAssertEqual(offenders, [])
    }

    private static func isUUIDv7Compatible(_ value: String) -> Bool {
        let pieces = value.lowercased().split(separator: "-")
        guard pieces.map(\.count) == [8, 4, 4, 4, 12] else { return false }
        return pieces[2].first == "7"
            && ["8", "9", "a", "b"].contains(pieces[3].first)
            && value.allSatisfy { $0 == "-" || $0.isHexDigit }
    }

    private static func successResponse(
        _ operation: String
    ) -> PlannerMockResponse {
        switch operation {
        case "getUserSettings":
            return .init(status: .ok, body: settingsJSON(revision: 7))
        case "updateUserSettings":
            return .init(status: .ok, body: settingsJSON(revision: 8))
        case "listCategories":
            return .init(
                status: .ok,
                body: """
                {"items":[{
                  "id":"category-1","userId":"user-1","key":"sky",
                  "label":"Work","sortOrder":0,"revision":1,
                  "createdAt":"2026-07-28T12:00:00Z",
                  "updatedAt":"2026-07-28T12:00:00Z"
                }],"nextCursor":null}
                """
            )
        case "getDay":
            return .init(status: .ok, body: dayJSON)
        case "createActivitySeries":
            return .init(status: .created, body: activityJSON)
        case "updateActivitySeries":
            return .init(status: .ok, body: activityJSON)
        case "deleteActivitySeries", "deleteTask":
            return .init(status: .noContent, body: "")
        case "listTasks":
            return .init(
                status: .ok,
                body: #"{"items":[\#(taskJSON)],"nextCursor":null}"#
            )
        case "createTask":
            return .init(status: .created, body: taskJSON)
        case "search":
            return .init(
                status: .ok,
                body: """
                {
                  "query":"plan","today":"2026-07-28",
                  "zone":"America/Chicago",
                  "items":[{
                    "id":"activity-1","kind":"activity",
                    "title":"Plan the day","date":"2026-07-28",
                    "startMin":540,"matchedOn":"title","repeats":false
                  }]
                }
                """
            )
        case "getStats":
            return .init(
                status: .ok,
                body: """
                {
                  "byDate":{"2026-07-28":{
                    "completed":1,"focusMin":25,"mood":"good"
                  }},
                  "streak":{"current":1,"best":1},
                  "energyBalance":{"low":0,"medium":1,"high":0},
                  "totalCompleted":1,"totalFocusMin":25,
                  "energyPattern":{
                    "byHour":[0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                    "sampled":1,"window":null
                  },
                  "from":"2026-07-28T00:00:00Z",
                  "to":"2026-07-29T00:00:00Z","days":1
                }
                """
            )
        case "createMoodCheckin":
            return .init(status: .created, body: #"{"ok":true}"#)
        case "listRoutines":
            return .init(status: .ok, body: routinesJSON)
        case "getActiveFocusSession":
            return .init(status: .ok, body: focusJSON(state: "running"))
        case "startFocusSession":
            return .init(
                status: .created,
                body: focusJSON(state: "running")
            )
        case "updateFocusSession":
            return .init(status: .ok, body: focusJSON(state: "paused"))
        default:
            XCTFail("Unexpected generated operation \(operation)")
            return .init(status: .internalServerError, body: "")
        }
    }

    private static func settingsJSON(
        revision: Int,
        timestamp: String = "2026-07-28T12:00:00Z"
    ) -> String {
        """
        {
          "userId":"user-1","timezone":"America/Chicago","locale":"en-US",
          "weekStart":1,"hourCycle":"h12","theme":"system",
          "reducedStimulation":false,
          "notificationPrefs":{"reminders":true},
          "schemaVersion":1,"revision":\(revision),
          "createdAt":"\(timestamp)",
          "updatedAt":"\(timestamp)"
        }
        """
    }

    private static let activityJSON = """
    {
      "id":"activity-1","userId":"user-1","tz":"America/Chicago",
      "dtstartLocal":"2026-07-28T14:00:00Z","title":"Plan the day",
      "emoji":"🗓️","categoryId":"category-1","durationMin":25,
      "checklistTemplate":[{"label":"Pick three","done":false}],
      "priority":"none","source":"manual","revision":2,
      "createdAt":"2026-07-28T12:00:00Z",
      "updatedAt":"2026-07-28T12:00:00Z"
    }
    """

    private static let taskJSON = """
    {
      "id":"task-1","userId":"user-1","bucket":"inbox",
      "title":"Capture this","priority":"none","revision":3,
      "createdAt":"2026-07-28T12:00:00Z",
      "updatedAt":"2026-07-28T12:00:00Z"
    }
    """

    private static let dayJSON = """
    {
      "date":"2026-07-28","zone":"America/Chicago",
      "start":"2026-07-28T05:00:00Z","end":"2026-07-29T05:00:00Z",
      "activities":[{
        "id":"activity-1","userId":"user-1","tz":"America/Chicago",
        "dtstartLocal":"2026-07-28T14:00:00Z","title":"Plan the day",
        "emoji":"🗓️","categoryId":"category-1","durationMin":25,
        "checklistTemplate":[{"label":"Pick three","done":false}],
        "priority":"none","source":"manual","revision":2,
        "createdAt":"2026-07-28T12:00:00Z",
        "updatedAt":"2026-07-28T12:00:00Z",
        "occurrenceKey":"2026-07-28T14:00:00Z","status":"pending"
      }],
      "anytimeTasks":[],
      "occurrenceStatusBySeries":{"activity-1":"pending"}
    }
    """

    private static let routinesJSON = """
    {"items":[{
      "id":"routine-1","userId":"user-1","title":"Morning",
      "revision":1,
      "createdAt":"2026-07-28T12:00:00Z",
      "updatedAt":"2026-07-28T12:00:00Z",
      "steps":[{
        "id":"step-1","userId":"user-1","routineId":"routine-1",
        "title":"Water","durationMin":5,"sortOrder":0,"revision":1,
        "createdAt":"2026-07-28T12:00:00Z",
        "updatedAt":"2026-07-28T12:00:00Z"
      }],
      "schedules":[],"stepCount":1,"totalMin":5
    }]}
    """

    private static func focusJSON(state: String) -> String {
        """
        {
          "session":{
            "id":"focus-1","userId":"user-1","state":"\(state)",
            "startedAt":"2026-07-28T13:00:00Z",
            "targetDurationMin":25,"accumulatedPauseSec":0,
            "currentIntervalStartedAt":"2026-07-28T13:00:00Z",
            "revision":1,"createdAt":"2026-07-28T13:00:00Z",
            "updatedAt":"2026-07-28T13:00:00Z"
          },
          "remainingSec":1200
        }
        """
    }

    private static func errorEnvelope(
        code: String,
        message: String,
        details: String? = nil,
        retryable: Bool = false
    ) -> String {
        """
        {"error":{
          "code":"\(code)","message":"\(message)",
          \(details.map { "\"details\":\($0)," } ?? "")
          "retryable":\(retryable)
        }}
        """
    }

    private static func cookie(
        name: String,
        domain: String,
        path: String
    ) throws -> HTTPCookie {
        try XCTUnwrap(HTTPCookie(properties: [
            .domain: domain,
            .path: path,
            .name: name,
            .value: "\(name)-\(domain)-\(path)",
            .secure: "TRUE",
        ]))
    }
}

private struct PlannerRequestCapture: Sendable {
    let method: String
    let path: String
    let operationID: String
    let headers: [String: String]
    let body: Data

    func jsonBody() throws -> [String: Any] {
        try XCTUnwrap(
            JSONSerialization.jsonObject(with: body) as? [String: Any]
        )
    }
}

private actor PlannerRequestRecorder {
    private(set) var captures: [PlannerRequestCapture] = []

    func record(_ capture: PlannerRequestCapture) {
        captures.append(capture)
    }
}

private struct PlannerMockResponse: Sendable {
    let status: HTTPResponse.Status
    let body: String
}

private struct PlannerMockTransport: ClientTransport {
    let recorder: PlannerRequestRecorder
    let responder: @Sendable (String) -> PlannerMockResponse

    func send(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String
    ) async throws -> (HTTPResponse, HTTPBody?) {
        let bodyData: Data
        if let body {
            bodyData = Data(
                try await Array(collecting: body, upTo: 1_000_000)
            )
        } else {
            bodyData = Data()
        }
        await recorder.record(.init(
            method: request.method.rawValue,
            path: request.path ?? "",
            operationID: operationID,
            headers: Dictionary(
                uniqueKeysWithValues: request.headerFields.map {
                    ($0.name.canonicalName, $0.value)
                }
            ),
            body: bodyData
        ))
        let response = responder(operationID)
        return (
            HTTPResponse(
                status: response.status,
                headerFields: response.body.isEmpty
                    ? [:]
                    : [.contentType: "application/json"]
            ),
            response.body.isEmpty ? nil : HTTPBody(response.body)
        )
    }
}

private struct CancellationPlannerTransport: ClientTransport {
    func send(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String
    ) async throws -> (HTTPResponse, HTTPBody?) {
        throw CancellationError()
    }
}

private final class SuccessfulAuthURLProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(
        for request: URLRequest
    ) -> URLRequest {
        request
    }

    override func startLoading() {
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(
            self,
            didReceive: response,
            cacheStoragePolicy: .notAllowed
        )
        client?.urlProtocol(self, didLoad: Data("{}".utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private final class DeterministicKeySource: @unchecked Sendable {
    private let lock = NSLock()
    private var sequence = 0

    func next() -> String {
        lock.withLock {
            defer { sequence += 1 }
            return String(
                format: "019fa64f-32f2-7%03x-8296-%012x",
                sequence,
                sequence
            )
        }
    }
}
