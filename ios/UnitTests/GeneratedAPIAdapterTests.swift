import Foundation
import OpenAPIRuntime
import XCTest
import KairoAPIClient
@testable import Kairo

final class GeneratedAPIAdapterTests: XCTestCase {
    func testGeneratedDaySettingsActivityAndTaskAdaptToPresentationModels() throws {
        let generatedDay = try decode(
            Components.Schemas.DayResponse.self,
            """
            {
              "date":"2026-07-28",
              "zone":"America/New_York",
              "start":"2026-07-28T04:00:00Z",
              "end":"2026-07-29T04:00:00Z",
              "activities":[{
                "id":"activity-1",
                "userId":"user-1",
                "tz":"America/New_York",
                "dtstartLocal":"2026-07-28T13:00:00Z",
                "rrule":"FREQ=DAILY",
                "title":"Morning plan",
                "emoji":"☀️",
                "durationMin":30,
                "checklistTemplate":[{"label":"Water","done":true}],
                "priority":"none",
                "source":"manual",
                "revision":2,
                "createdAt":"2026-07-28T12:00:00Z",
                "updatedAt":"2026-07-28T12:00:00Z",
                "occurrenceKey":"2026-07-28T13:00:00Z",
                "status":"completed"
              }],
              "anytimeTasks":[{
                "id":"task-1",
                "userId":"user-1",
                "bucket":"anytime",
                "title":"Email Alex",
                "priority":"high",
                "revision":3,
                "createdAt":"2026-07-28T12:00:00Z",
                "updatedAt":"2026-07-28T12:00:00Z"
              }],
              "occurrenceStatusBySeries":{"activity-1":"completed"}
            }
            """
        )
        let day = try GeneratedAPIAdapters.day(
            .ok(.init(body: .json(generatedDay)))
        )

        XCTAssertEqual(day.date, "2026-07-28")
        XCTAssertEqual(day.activities.first?.title, "Morning plan")
        XCTAssertEqual(day.activities.first?.status, "completed")
        XCTAssertEqual(day.activities.first?.checklistTemplate?.first?.label, "Water")
        XCTAssertEqual(day.anytimeTasks?.first?.title, "Email Alex")
        XCTAssertEqual(day.occurrenceStatusBySeries?["activity-1"], "completed")

        let generatedSettings = try decode(
            Components.Schemas.UserSettings.self,
            """
            {
              "userId":"user-1",
              "timezone":"America/New_York",
              "locale":"en-US",
              "weekStart":1,
              "hourCycle":"h12",
              "theme":"dark",
              "reducedStimulation":true,
              "notificationPrefs":{"quietHours":{"enabled":true},"leadMinutes":10},
              "schemaVersion":1,
              "revision":4,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )
        let settings = try GeneratedAPIAdapters.settings(
            .ok(.init(body: .json(generatedSettings)))
        )
        XCTAssertEqual(settings.timezone, "America/New_York")
        XCTAssertEqual(settings.theme, "dark")
        XCTAssertEqual(
            settings.notificationPrefs?["leadMinutes"],
            .integer(10)
        )
    }

    func testGeneratedSearchStatsRoutineAndFocusAdaptersPreserveUIData() throws {
        let generatedSearch = try decode(
            Components.Schemas.SearchResponse.self,
            """
            {
              "query":"plan",
              "today":"2026-07-28",
              "zone":"America/New_York",
              "items":[{
                "id":"activity-1",
                "kind":"activity",
                "title":"Morning plan",
                "date":"2026-07-28",
                "startMin":540,
                "matchedOn":"title",
                "repeats":true
              }]
            }
            """
        )
        let search = try GeneratedAPIAdapters.search(
            .ok(.init(body: .json(generatedSearch)))
        )
        XCTAssertEqual(search.items.first?.startMin, 540)
        XCTAssertEqual(search.items.first?.matchedOn, "title")

        let generatedStats = try decode(
            Components.Schemas.StatsResponse.self,
            """
            {
              "byDate":{"2026-07-28":{"completed":3,"focusMin":45,"mood":"good"}},
              "streak":{"current":2,"best":5},
              "energyBalance":{"low":1,"medium":1,"high":1},
              "totalCompleted":3,
              "totalFocusMin":45,
              "estimate":{"sessions":3,"avgTargetMin":25,"avgActualMin":20,"ratio":0.8},
              "focusHours":{"hours":[9,10],"peakHour":9},
              "energyPattern":{"byHour":[0,0,0,0,0,0,0,0,0,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0],"sampled":3,"window":{"start":9,"end":11}},
              "from":"2026-07-28T00:00:00Z",
              "to":"2026-07-29T00:00:00Z",
              "days":1
            }
            """
        )
        let stats = try GeneratedAPIAdapters.stats(
            .ok(.init(body: .json(generatedStats)))
        )
        XCTAssertEqual(stats.byDate["2026-07-28"]?.completed, 3)
        XCTAssertEqual(stats.estimate?.ratio, 0.8)
        XCTAssertEqual(stats.focusHours?.peakHour, 9)

        let generatedRoutines = [
            try decode(
                Components.Schemas.RoutineListItem.self,
                """
                {
                  "id":"routine-1",
                  "userId":"user-1",
                  "title":"Morning reset",
                  "revision":1,
                  "createdAt":"2026-07-28T12:00:00Z",
                  "updatedAt":"2026-07-28T12:00:00Z",
                  "steps":[{
                    "id":"step-1",
                    "userId":"user-1",
                    "routineId":"routine-1",
                    "title":"Stretch",
                    "durationMin":5,
                    "sortOrder":0,
                    "revision":1,
                    "createdAt":"2026-07-28T12:00:00Z",
                    "updatedAt":"2026-07-28T12:00:00Z"
                  }],
                  "schedules":[{
                    "id":"schedule-1",
                    "userId":"user-1",
                    "routineId":"routine-1",
                    "tz":"America/New_York",
                    "rrule":"FREQ=DAILY",
                    "nextRunAt":null,
                    "paused":false,
                    "revision":1,
                    "createdAt":"2026-07-28T12:00:00Z",
                    "updatedAt":"2026-07-28T12:00:00Z"
                  }],
                  "stepCount":1,
                  "totalMin":5
                }
                """
            ),
        ]
        let routines = try GeneratedAPIAdapters.routines(
            .ok(.init(body: .json(.init(items: generatedRoutines))))
        )
        XCTAssertEqual(routines.first?.orderedSteps.first?.title, "Stretch")
        XCTAssertEqual(routines.first?.schedules.first?.rrule, "FREQ=DAILY")

        let generatedFocus = try decode(
            Components.Schemas.FocusSnapshot.self,
            """
            {
              "session":{
                "id":"focus-1",
                "userId":"user-1",
                "state":"running",
                "startedAt":"2026-07-28T13:00:00Z",
                "targetDurationMin":25,
                "accumulatedPauseSec":0,
                "currentIntervalStartedAt":"2026-07-28T13:00:00Z",
                "revision":1,
                "createdAt":"2026-07-28T13:00:00Z",
                "updatedAt":"2026-07-28T13:00:00Z"
              },
              "remainingSec":1200
            }
            """
        )
        let focus = try GeneratedAPIAdapters.focus(
            .ok(.init(body: .json(generatedFocus)))
        )
        XCTAssertEqual(focus.session?.state, "running")
        XCTAssertEqual(focus.remainingSec, 1200)
    }

    func testTypedMutationModelsAreSendableAndPreservePatchTriState() throws {
        let settings = SettingsUpdate(
            timezone: "America/New_York",
            weekStart: .monday,
            hourCycle: .h12,
            theme: .dark,
            notificationPrefs: [
                "quiet": .boolean(true),
                "sound": .null,
            ]
        )
        let activity = ActivityUpdate(
            title: "Updated",
            emoji: .null,
            categoryId: .unchanged
        )
        let transition = FocusCommand.transition(.paused)
        let extend = FocusCommand.extend(.five)

        assertSendable(settings)
        assertSendable(activity)
        assertSendable(transition)
        assertSendable(extend)

        let settingsBody = try GeneratedAPIAdapters.settingsUpdate(settings)
        XCTAssertEqual(settingsBody.weekStart, 1)
        XCTAssertEqual(settingsBody.hourCycle, .h12)
        XCTAssertEqual(settingsBody.theme, .dark)

        let body = try GeneratedAPIAdapters.activityUpdate(activity)
        XCTAssertEqual(body.title, "Updated")
        XCTAssertEqual(body.emoji, .null)
        XCTAssertNil(body.categoryId)
        XCTAssertNil(body.editScope)

        let scopedBody = try GeneratedAPIAdapters.activityUpdate(
            .init(editScope: .thisAndFuture)
        )
        XCTAssertEqual(scopedBody.editScope, .this_and_future)

        let instant = Date(timeIntervalSince1970: 1_753_705_800)
        let fullBody = try GeneratedAPIAdapters.activityUpdate(.init(
            editScope: .this,
            occurrenceKey: instant,
            tz: "America/New_York",
            dtstartLocal: instant,
            rrule: .null,
            exdate: .value(["2026-07-29"]),
            rdate: .value([instant]),
            title: "Full update",
            emoji: .value("☀️"),
            categoryId: .null,
            durationMin: 45,
            checklistTemplate: [.init(label: "Water", done: false)],
            energy: .value(.medium),
            priority: .high,
            tags: .value(["tag-1"]),
            notes: .value("Notes"),
            source: .manual,
            sourceRef: .null,
            status: .completed,
            startAt: instant,
            completedAt: .value(instant),
            checklistOverride: .value([
                .init(label: "Water", done: true),
            ])
        ))
        XCTAssertEqual(fullBody.startAt, instant)
        XCTAssertEqual(fullBody.checklistTemplate?.count, 1)
        XCTAssertEqual(
            fullBody.checklistTemplate?.first?.value["done"] as? Bool,
            false
        )
        XCTAssertEqual(
            fullBody.checklistOverride,
            .value([.init(label: "Water", done: true)])
        )
        XCTAssertEqual(fullBody.source, .manual)

        let omittedDone = try GeneratedAPIAdapters.activityUpdate(.init(
            checklistTemplate: [.init(label: "Optional", done: nil)]
        ))
        XCTAssertFalse(
            omittedDone.checklistTemplate?.first?.value.keys.contains("done")
                ?? true
        )

        guard case let .case1(payload) = try GeneratedAPIAdapters.focusCommand(transition) else {
            return XCTFail("Expected transition payload")
        }
        XCTAssertEqual(payload.state, .paused)

        guard case let .case2(extendPayload) = try GeneratedAPIAdapters.focusCommand(extend) else {
            return XCTFail("Expected extend payload")
        }
        XCTAssertEqual(extendPayload.addMinutes, ._5)
        XCTAssertNil(FocusExtensionMinutes(rawValue: 7))

        XCTAssertThrowsError(
            try GeneratedAPIAdapters.activityUpdate(
                .init(durationMin: Int.max)
            )
        )
    }

    func testGeneratedActivityAndTaskOperationOutputsAdaptDirectly() throws {
        let generatedActivity = try decode(
            Components.Schemas.ActivitySeries.self,
            """
            {
              "id":"activity-1",
              "userId":"user-1",
              "tz":"America/New_York",
              "dtstartLocal":"2026-07-28T13:00:00Z",
              "title":"Direct activity",
              "durationMin":25,
              "checklistTemplate":[],
              "priority":"none",
              "source":"manual",
              "revision":2,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )
        let activity = try GeneratedAPIAdapters.activity(
            .created(.init(body: .json(generatedActivity)))
        )
        XCTAssertEqual(activity.title, "Direct activity")
        XCTAssertEqual(activity.durationMin, 25)

        let generatedTask = try decode(
            Components.Schemas.Task.self,
            """
            {
              "id":"task-1",
              "userId":"user-1",
              "bucket":"inbox",
              "title":"Direct task",
              "priority":"low",
              "revision":3,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )
        let task = try GeneratedAPIAdapters.task(
            .created(.init(body: .json(generatedTask)))
        )
        XCTAssertEqual(task.title, "Direct task")
        XCTAssertEqual(task.priority, "low")
    }

    func testGeneratedActivitySeriesAndChangesOutputsAdaptForNativeSync() throws {
        let generatedActivity = try decode(
            Components.Schemas.ActivitySeries.self,
            """
            {
              "id":"activity-1","userId":"user-1","tz":"America/New_York",
              "dtstartLocal":"2026-07-28T13:00:00Z","title":"Read series",
              "durationMin":25,"checklistTemplate":[],"priority":"none",
              "source":"manual","revision":7,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )
        let activityOutput: Operations.getActivitySeries.Output = .ok(
            .init(body: .json(generatedActivity))
        )
        let activity = try GeneratedAPIAdapters.activitySeries(activityOutput)

        XCTAssertEqual(activity.id, "activity-1")
        XCTAssertEqual(activity.revision, 7)

        let generatedChanges = try decode(
            Components.Schemas.ChangesResponse.self,
            """
            {
              "items":[{
                "id":"42","entityType":"activity_series",
                "entityId":"activity-1","op":"upsert","revision":7,
                "occurredAt":"2026-07-28T13:00:00Z"
              }],
              "nextCursor":"cursor-42",
              "checkpointCursor":"42"
            }
            """
        )
        let changesOutput: Operations.getChanges.Output = .ok(
            .init(body: .json(generatedChanges))
        )
        let page = try GeneratedAPIAdapters.changes(changesOutput)

        XCTAssertEqual(page.entries.map(\.id), ["42"])
        XCTAssertEqual(page.entries.first?.operation, "upsert")
        XCTAssertEqual(page.nextCursor, "cursor-42")
        XCTAssertEqual(page.checkpointCursor, "42")
    }

    func testChangesCheckpointAdvancesOrRewindsFromServerAuthority() throws {
        let exhaustedChanges = try decode(
            Components.Schemas.ChangesResponse.self,
            """
            {
              "items":[{
                "id":"43","entityType":"activity_series",
                "entityId":"activity-1","op":"upsert","revision":8,
                "occurredAt":"2026-07-28T14:00:00Z"
              }],
              "nextCursor":null,
              "checkpointCursor":"43"
            }
            """
        )
        let exhaustedOutput: Operations.getChanges.Output = .ok(
            .init(body: .json(exhaustedChanges))
        )
        let exhausted = try GeneratedAPIAdapters.changes(exhaustedOutput)

        XCTAssertNil(exhausted.nextCursor)
        XCTAssertEqual(exhausted.checkpointCursor, "43")

        let emptyChanges = try decode(
            Components.Schemas.ChangesResponse.self,
            #"{"items":[],"nextCursor":null,"checkpointCursor":"12"}"#
        )
        let emptyOutput: Operations.getChanges.Output = .ok(
            .init(body: .json(emptyChanges))
        )
        let empty = try GeneratedAPIAdapters.changes(emptyOutput)

        XCTAssertNil(empty.nextCursor)
        XCTAssertEqual(empty.checkpointCursor, "12")
    }

    func testMalformedGeneratedEnumAndUnexpectedOutputFailHonestly() throws {
        let malformed = """
        {
          "userId":"user-1",
          "timezone":"UTC",
          "locale":"en-US",
          "weekStart":1,
          "hourCycle":"h12",
          "theme":"sepia",
          "reducedStimulation":false,
          "notificationPrefs":{},
          "schemaVersion":1,
          "revision":1,
          "createdAt":"2026-07-28T12:00:00Z",
          "updatedAt":"2026-07-28T12:00:00Z"
        }
        """
        XCTAssertThrowsError(
            try decode(Components.Schemas.UserSettings.self, malformed)
        )

        XCTAssertThrowsError(
            try GeneratedAPIAdapters.day(
                .undocumented(statusCode: 502, .init())
            )
        ) { error in
            XCTAssertEqual(
                error as? GeneratedAPIAdapterError,
                .undocumented(operation: "getDay", statusCode: 502)
            )
        }

        let malformedChecklist = try decode(
            Components.Schemas.DayResponse.self,
            """
            {
              "date":"2026-07-28",
              "zone":"UTC",
              "start":"2026-07-28T00:00:00Z",
              "end":"2026-07-29T00:00:00Z",
              "activities":[{
                "id":"activity-1",
                "userId":"user-1",
                "tz":"UTC",
                "dtstartLocal":"2026-07-28T13:00:00Z",
                "title":"Malformed checklist",
                "durationMin":30,
                "checklistTemplate":[{"done":true}],
                "priority":"none",
                "source":"manual",
                "revision":1,
                "createdAt":"2026-07-28T12:00:00Z",
                "updatedAt":"2026-07-28T12:00:00Z",
                "occurrenceKey":"2026-07-28T13:00:00Z",
                "status":"pending"
              }],
              "anytimeTasks":[],
              "occurrenceStatusBySeries":{}
            }
            """
        )
        XCTAssertThrowsError(
            try GeneratedAPIAdapters.day(
                .ok(.init(body: .json(malformedChecklist)))
            )
        ) { error in
            XCTAssertEqual(
                error as? GeneratedAPIAdapterError,
                .malformedValue(
                    path: "DayActivity.checklistTemplate[0].label"
                )
            )
        }
    }

    func testDocumentedErrorsPreserveEnvelopeStatusAndConflictState() throws {
        let badRequest = try errorEnvelope(
            code: "bad_request",
            message: "Date must use YYYY-MM-DD.",
            retryable: false
        )
        XCTAssertThrowsError(
            try GeneratedAPIAdapters.day(
                .badRequest(.init(body: .json(badRequest)))
            )
        ) { error in
            XCTAssertEqual(
                error as? GeneratedAPIAdapterError,
                .http(
                    operation: "getDay",
                    statusCode: 400,
                    error: .init(
                        code: "bad_request",
                        message: "Date must use YYYY-MM-DD.",
                        retryable: false,
                        details: nil
                    )
                )
            )
        }

        let unauthorized = try errorEnvelope(
            code: "unauthenticated",
            message: "Sign in again.",
            retryable: false
        )
        XCTAssertThrowsError(
            try GeneratedAPIAdapters.settings(
                .unauthorized(.init(body: .json(unauthorized)))
            )
        ) { error in
            XCTAssertEqual(
                error as? GeneratedAPIAdapterError,
                .unauthorized(
                    operation: "getUserSettings",
                    statusCode: 401,
                    error: .init(
                        code: "unauthenticated",
                        message: "Sign in again.",
                        retryable: false,
                        details: nil
                    )
                )
            )
        }

        let conflict = try errorEnvelope(
            code: "conflict",
            message: "The task changed on another device.",
            retryable: false,
            details: [
                "current": [
                    "revision": 8,
                    "tags": ["home", NSNull()] as [Any],
                ] as [String: Any],
            ]
        )
        XCTAssertThrowsError(
            try GeneratedAPIAdapters.task(
                .conflict(.init(body: .json(conflict)))
            )
        ) { error in
            XCTAssertEqual(
                error as? GeneratedAPIAdapterError,
                .conflict(
                    operation: "createTask",
                    statusCode: 409,
                    error: .init(
                        code: "conflict",
                        message: "The task changed on another device.",
                        retryable: false,
                        details: .object([
                            "current": .object([
                                "revision": .integer(8),
                                "tags": .array([.string("home"), .null]),
                            ]),
                        ])
                    )
                )
            )
        }

        let notFound = try errorEnvelope(
            code: "not_found",
            message: "Task not found.",
            retryable: false
        )
        XCTAssertEqual(
            try GeneratedAPIAdapters.documentedError(
                operation: "getTask",
                statusCode: 404,
                envelope: notFound
            ),
            .notFound(
                operation: "getTask",
                statusCode: 404,
                error: .init(
                    code: "not_found",
                    message: "Task not found.",
                    retryable: false,
                    details: nil
                )
            )
        )
    }

    func testEveryOutputAdapterWiresEveryDocumentedErrorExactly() throws {
        let envelope = try errorEnvelope(
            code: "test_error",
            message: "Preserve this exact envelope.",
            retryable: true,
            details: [
                "current": [
                    "revision": 12,
                    "values": ["one", NSNull()] as [Any],
                ] as [String: Any],
            ]
        )
        let error = ServerErrorData(
            code: "test_error",
            message: "Preserve this exact envelope.",
            retryable: true,
            details: .object([
                "current": .object([
                    "revision": .integer(12),
                    "values": .array([.string("one"), .null]),
                ]),
            ])
        )

        assertAdapterError(
            .http(
                operation: "getDay",
                statusCode: 400,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.day(
                .badRequest(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .unauthorized(
                operation: "getDay",
                statusCode: 401,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.day(
                .unauthorized(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .unauthorized(
                operation: "getUserSettings",
                statusCode: 401,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.settings(
                .unauthorized(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .http(
                operation: "createActivitySeries",
                statusCode: 400,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.activity(
                .badRequest(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .unauthorized(
                operation: "createActivitySeries",
                statusCode: 401,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.activity(
                .unauthorized(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .conflict(
                operation: "createActivitySeries",
                statusCode: 409,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.activity(
                .conflict(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .http(
                operation: "createTask",
                statusCode: 400,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.task(
                .badRequest(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .unauthorized(
                operation: "createTask",
                statusCode: 401,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.task(
                .unauthorized(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .conflict(
                operation: "createTask",
                statusCode: 409,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.task(
                .conflict(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .http(
                operation: "search",
                statusCode: 400,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.search(
                .badRequest(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .unauthorized(
                operation: "search",
                statusCode: 401,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.search(
                .unauthorized(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .http(
                operation: "getStats",
                statusCode: 400,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.stats(
                .badRequest(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .unauthorized(
                operation: "getStats",
                statusCode: 401,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.stats(
                .unauthorized(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .unauthorized(
                operation: "listRoutines",
                statusCode: 401,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.routines(
                .unauthorized(.init(body: .json(envelope)))
            )
        }
        assertAdapterError(
            .unauthorized(
                operation: "getActiveFocusSession",
                statusCode: 401,
                error: error
            )
        ) {
            try GeneratedAPIAdapters.focus(
                .unauthorized(.init(body: .json(envelope)))
            )
        }
    }

    func testMalformedDocumentedErrorDetailsFailAtTheirExactPath() throws {
        var envelope = try errorEnvelope(
            code: "conflict",
            message: "Conflict.",
            retryable: false,
            details: ["current": ["revision": 8]]
        )
        envelope.error.details?.additionalProperties.value["current"] =
            Date(timeIntervalSince1970: 0)

        XCTAssertThrowsError(
            try GeneratedAPIAdapters.documentedError(
                operation: "createTask",
                statusCode: 409,
                envelope: envelope
            )
        ) { error in
            XCTAssertEqual(
                error as? GeneratedAPIAdapterError,
                .malformedValue(path: "ErrorEnvelope.error.details.current")
            )
        }
    }

    func testFreeformJSONPreservesNestedArraysScalarsAndExplicitNull() throws {
        let generated = try decode(
            Components.Schemas.UserSettings.self,
            """
            {
              "userId":"user-1",
              "timezone":"UTC",
              "locale":"en-US",
              "weekStart":1,
              "hourCycle":"h24",
              "theme":"system",
              "reducedStimulation":false,
              "notificationPrefs":{
                "nested":{
                  "items":[1,2.5,true,"quiet",null,{"deep":false}]
                }
              },
              "schemaVersion":1,
              "revision":1,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )

        let settings = try GeneratedAPIAdapters.settings(generated)
        XCTAssertEqual(
            settings.notificationPrefs?["nested"],
            .object([
                "items": .array([
                    .integer(1),
                    .number(2.5),
                    .boolean(true),
                    .string("quiet"),
                    .null,
                    .object(["deep": .boolean(false)]),
                ]),
            ])
        )
    }

    func testUnsupportedFreeformValuesFailInsteadOfBecomingNull() throws {
        var generated = try decode(
            Components.Schemas.UserSettings.self,
            """
            {
              "userId":"user-1",
              "timezone":"UTC",
              "locale":"en-US",
              "weekStart":1,
              "hourCycle":"h24",
              "theme":"system",
              "reducedStimulation":false,
              "notificationPrefs":{"enabled":true},
              "schemaVersion":1,
              "revision":1,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )
        generated.notificationPrefs.additionalProperties.value["unsupported"] =
            Date(timeIntervalSince1970: 0)

        XCTAssertThrowsError(
            try GeneratedAPIAdapters.settings(generated)
        ) { error in
            XCTAssertEqual(
                error as? GeneratedAPIAdapterError,
                .malformedValue(
                    path: "UserSettings.notificationPrefs.unsupported"
                )
            )
        }
    }

    func testChecklistDoneIsOptionalButExplicitNullAndWrongTypesFail() throws {
        let absent = try dayWithChecklist(#"{"label":"Water"}"#)
        XCTAssertNil(
            try GeneratedAPIAdapters.day(absent)
                .activities[0].checklistTemplate?[0].done
        )

        let present = try dayWithChecklist(
            #"{"label":"Water","done":false}"#
        )
        XCTAssertEqual(
            try GeneratedAPIAdapters.day(present)
                .activities[0].checklistTemplate?[0].done,
            false
        )

        for malformed in [
            #"{"label":"Water","done":null}"#,
            #"{"label":"Water","done":"yes"}"#,
        ] {
            XCTAssertThrowsError(
                try GeneratedAPIAdapters.day(
                    try dayWithChecklist(malformed)
                )
            ) { error in
                XCTAssertEqual(
                    error as? GeneratedAPIAdapterError,
                    .malformedValue(
                        path: "DayActivity.checklistTemplate[0].done"
                    )
                )
            }
        }
    }

    func testAllMutationEnumCasesMapWithoutRawValueFallbacks() throws {
        let settingsCases: [
            (
                HourCyclePreference,
                ThemePreference,
                Components.Schemas.HourCycle,
                Components.Schemas.ThemeMode
            )
        ] = [
            (.h12, .system, .h12, .system),
            (.h24, .light, .h24, .light),
            (.h12, .dark, .h12, .dark),
        ]
        for (hourCycle, theme, expectedHourCycle, expectedTheme)
            in settingsCases
        {
            let body = try GeneratedAPIAdapters.settingsUpdate(
                .init(hourCycle: hourCycle, theme: theme)
            )
            XCTAssertEqual(body.hourCycle, expectedHourCycle)
            XCTAssertEqual(body.theme, expectedTheme)
        }

        let scopeCases: [
            (ActivityEditScope, Components.Schemas.EditScope)
        ] = [
            (.this, .this),
            (.thisAndFuture, .this_and_future),
            (.all, .all),
        ]
        for (input, expected) in scopeCases {
            XCTAssertEqual(
                try GeneratedAPIAdapters.activityUpdate(
                    .init(editScope: input)
                ).editScope,
                expected
            )
        }

        let energyCases: [
            (ActivityEnergy, Components.Schemas.EnergyLevel)
        ] = [
            (.low, .low),
            (.medium, .medium),
            (.high, .high),
        ]
        for (input, expected) in energyCases {
            XCTAssertEqual(
                try GeneratedAPIAdapters.activityUpdate(
                    .init(energy: .value(input))
                ).energy,
                .value(expected)
            )
        }

        let priorityCases: [
            (ActivityPriority, Components.Schemas.Priority)
        ] = [
            (.none, .none),
            (.low, .low),
            (.high, .high),
        ]
        for (input, expected) in priorityCases {
            XCTAssertEqual(
                try GeneratedAPIAdapters.activityUpdate(
                    .init(priority: input)
                ).priority,
                expected
            )
        }

        let sourceCases: [
            (ActivitySource, Components.Schemas.ActivitySource)
        ] = [
            (.manual, .manual),
            (.routine, .routine),
            (.calendar, .calendar),
        ]
        for (input, expected) in sourceCases {
            XCTAssertEqual(
                try GeneratedAPIAdapters.activityUpdate(
                    .init(source: input)
                ).source,
                expected
            )
        }

        let statusCases: [
            (ActivityStatus, Components.Schemas.OccurrenceStatus)
        ] = [
            (.pending, .pending),
            (.completed, .completed),
            (.skipped, .skipped),
            (.cancelled, .cancelled),
        ]
        for (input, expected) in statusCases {
            XCTAssertEqual(
                try GeneratedAPIAdapters.activityUpdate(
                    .init(status: input)
                ).status,
                expected
            )
        }
    }

    func testEveryWeekStartAndFocusEnumCaseMapsExactly() throws {
        let weekStarts: [(WeekStart, Int32)] = [
            (.sunday, 0),
            (.monday, 1),
            (.tuesday, 2),
            (.wednesday, 3),
            (.thursday, 4),
            (.friday, 5),
            (.saturday, 6),
        ]
        XCTAssertEqual(weekStarts.count, WeekStart.allCases.count)
        for (input, expected) in weekStarts {
            XCTAssertEqual(
                try GeneratedAPIAdapters.settingsUpdate(
                    .init(weekStart: input)
                ).weekStart,
                expected
            )
        }

        let transitions: [
            (FocusTransitionState, Components.Schemas.FocusState)
        ] = [
            (.running, .running),
            (.paused, .paused),
            (.completed, .completed),
            (.skipped, .skipped),
            (.cancelled, .cancelled),
        ]
        XCTAssertEqual(
            transitions.count,
            FocusTransitionState.allCases.count
        )
        for (input, expected) in transitions {
            guard case let .case1(payload) =
                try GeneratedAPIAdapters.focusCommand(.transition(input))
            else {
                return XCTFail("Expected transition payload for \(input)")
            }
            XCTAssertEqual(payload.state, expected)
        }

        let extensions: [
            (
                FocusExtensionMinutes,
                Components.Schemas.FocusSessionPatchRequest
                    .Case2Payload.addMinutesPayload
            )
        ] = [
            (.one, ._1),
            (.five, ._5),
            (.ten, ._10),
        ]
        XCTAssertEqual(
            extensions.count,
            FocusExtensionMinutes.allCases.count
        )
        for (input, expected) in extensions {
            guard case let .case2(payload) =
                try GeneratedAPIAdapters.focusCommand(.extend(input))
            else {
                return XCTFail("Expected extension payload for \(input)")
            }
            XCTAssertEqual(payload.addMinutes, expected)
        }
    }

    private func decode<T: Decodable>(
        _ type: T.Type,
        _ json: String
    ) throws -> T {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(type, from: Data(json.utf8))
    }

    private func dayWithChecklist(
        _ checklistItem: String
    ) throws -> Components.Schemas.DayResponse {
        try decode(
            Components.Schemas.DayResponse.self,
            """
            {
              "date":"2026-07-28",
              "zone":"UTC",
              "start":"2026-07-28T00:00:00Z",
              "end":"2026-07-29T00:00:00Z",
              "activities":[{
                "id":"activity-1",
                "userId":"user-1",
                "tz":"UTC",
                "dtstartLocal":"2026-07-28T13:00:00Z",
                "title":"Checklist",
                "durationMin":30,
                "checklistTemplate":[\(checklistItem)],
                "priority":"none",
                "source":"manual",
                "revision":1,
                "createdAt":"2026-07-28T12:00:00Z",
                "updatedAt":"2026-07-28T12:00:00Z",
                "occurrenceKey":"2026-07-28T13:00:00Z",
                "status":"pending"
              }],
              "anytimeTasks":[],
              "occurrenceStatusBySeries":{}
            }
            """
        )
    }

    private func errorEnvelope(
        code: String,
        message: String,
        retryable: Bool,
        details: [String: Any]? = nil
    ) throws -> Components.Schemas.ErrorEnvelope {
        let details = try details.map {
            Components.Schemas._Error.detailsPayload(
                additionalProperties: try OpenAPIObjectContainer(
                    unvalidatedValue: $0
                )
            )
        }
        return .init(
            error: .init(
                code: code,
                message: message,
                details: details,
                retryable: retryable
            )
        )
    }

    private func assertAdapterError<T>(
        _ expected: GeneratedAPIAdapterError,
        file: StaticString = #filePath,
        line: UInt = #line,
        operation: () throws -> T
    ) {
        XCTAssertThrowsError(
            try operation(),
            file: file,
            line: line
        ) { error in
            XCTAssertEqual(
                error as? GeneratedAPIAdapterError,
                expected,
                file: file,
                line: line
            )
        }
    }

    private func assertSendable<T: Sendable>(_ value: T) {
        _ = value
    }
}
