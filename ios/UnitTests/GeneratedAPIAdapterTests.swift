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
                .unexpectedOutput(operation: "getDay", statusCode: 502)
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
                    path: "DayActivity.checklistTemplate.label"
                )
            )
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

    private func assertSendable<T: Sendable>(_ value: T) {
        _ = value
    }
}
