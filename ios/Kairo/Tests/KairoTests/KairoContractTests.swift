import Testing
import Foundation
@testable import KairoAPIClient

@Suite struct KairoContractTests {
    @Test func clientInstantiates() {
        let _ = KairoClient(baseURL: URL(string: "https://time.neima.me/api/v1")!)
    }
    @Test func clientInstantiatesStaging() {
        let _ = KairoClient(baseURL: URL(string: "https://time-staging.neima.me/api/v1")!)
    }
    @Test func generatedClientTypeExists() {
        let _ = Client.self
    }
    @Test func generatedFocusSnapshotIncludesSession() {
        let snapshot = Components.Schemas.FocusSnapshot(remainingSec: nil)
        let _ = snapshot.session
    }

    @Test func generatedDayContractMatchesRuntimeShape() throws {
        let activity = try decodeFixture(
            Components.Schemas.DayActivity.self,
            """
            {
              "id":"0198f834-c9ab-7e12-b1cf-1faebad8f4fd",
              "userId":"0198f834-c9ab-7e12-b1cf-1faebad8f4fe",
              "tz":"America/New_York",
              "dtstartLocal":"2026-07-28T13:00:00Z",
              "rrule":null,
              "exdate":null,
              "rdate":null,
              "title":"Morning plan",
              "emoji":null,
              "categoryId":null,
              "durationMin":30,
              "checklistTemplate":[],
              "energy":null,
              "priority":"none",
              "tags":null,
              "notes":null,
              "source":"manual",
              "sourceRef":null,
              "revision":1,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z",
              "deletedAt":null,
              "occurrenceKey":"2026-07-28T13:00:00Z",
              "status":"pending"
            }
            """
        )
        assertEnergyLevel(activity.energy)
        #expect(activity.energy == nil)
        #expect(activity.status == .pending)

        let day = try decodeFixture(
            Components.Schemas.DayResponse.self,
            """
            {
              "date":"2026-07-28",
              "zone":"America/New_York",
              "start":"2026-07-28T04:00:00Z",
              "end":"2026-07-29T04:00:00Z",
              "activities":[],
              "anytimeTasks":[],
              "occurrenceStatusBySeries":{}
            }
            """
        )
        #expect(day.zone == "America/New_York")
        #expect(day.activities.isEmpty)
        #expect(day.occurrenceStatusBySeries.additionalProperties.isEmpty)
    }

    @Test func generatedNullableContractPropertiesArePreserved() throws {
        let task = try decodeFixture(
            Components.Schemas.Task.self,
            """
            {
              "id":"0198f834-c9ab-7e12-b1cf-1faebad8f4fd",
              "userId":"0198f834-c9ab-7e12-b1cf-1faebad8f4fe",
              "bucket":"inbox",
              "title":"Capture",
              "priority":"none",
              "energy":"low",
              "revision":1,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )
        assertEnergyLevel(task.energy)
        #expect(task.energy == .low)

        let series = try decodeFixture(
            Components.Schemas.ActivitySeries.self,
            """
            {
              "id":"0198f834-c9ab-7e12-b1cf-1faebad8f4fd",
              "userId":"0198f834-c9ab-7e12-b1cf-1faebad8f4fe",
              "tz":"America/New_York",
              "dtstartLocal":"2026-07-28T13:00:00Z",
              "title":"Morning plan",
              "durationMin":30,
              "checklistTemplate":[],
              "energy":"medium",
              "priority":"none",
              "source":"manual",
              "revision":1,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )
        assertChecklistTemplate(series.checklistTemplate)
        assertEnergyLevel(series.energy)
        #expect(series.energy == .medium)

        let occurrence = try decodeFixture(
            Components.Schemas.ActivityOccurrence.self,
            """
            {
              "id":"0198f834-c9ab-7e12-b1cf-1faebad8f4fd",
              "userId":"0198f834-c9ab-7e12-b1cf-1faebad8f4fe",
              "seriesId":"0198f834-c9ab-7e12-b1cf-1faebad8f4fc",
              "occurrenceKey":"2026-07-28T13:00:00Z",
              "status":"pending",
              "energy":"high",
              "revision":1,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )
        assertEnergyLevel(occurrence.energy)
        #expect(occurrence.energy == .high)
        #expect(
            Components.Schemas.EnergyLevel.allCases.map(\.rawValue)
                == ["low", "medium", "high"]
        )

        let search = try decodeFixture(
            Components.Schemas.SearchResponse.self,
            """
            {
              "query":"plan",
              "today":"2026-07-28",
              "zone":"America/New_York",
              "items":[],
              "nextCursor":null
            }
            """
        )
        #expect(search.nextCursor == nil)
    }

    @Test func generatedStatsAndMoodContractsCompile() throws {
        let stats = try decodeFixture(
            Components.Schemas.StatsResponse.self,
            """
            {
              "byDate":{},
              "streak":{"current":0,"best":0},
              "energyBalance":{"low":0,"medium":0,"high":0},
              "totalCompleted":0,
              "totalFocusMin":0,
              "estimate":null,
              "focusHours":null,
              "energyPattern":{"byHour":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"sampled":0,"window":null},
              "from":"2026-07-28T00:00:00Z",
              "to":"2026-07-29T00:00:00Z",
              "days":1
            }
            """
        )
        #expect(stats.estimate == nil)
        #expect(stats.energyPattern.window == nil)

        let mood = try decodeFixture(
            Components.Schemas.MoodCheckinRequest.self,
            #"{"mood":"good"}"#
        )
        #expect(mood.mood == .good)
        let response = try decodeFixture(
            Components.Schemas.MoodCheckinResponse.self,
            #"{"ok":true}"#
        )
        #expect(response.ok)
    }

    @Test func generatedMutationInputsExcludeServerOwnedFields() {
        let createActivity = Components.Schemas.ActivitySeriesCreateRequest(
            tz: "America/New_York",
            dtstartLocal: Date(timeIntervalSince1970: 0),
            title: "Morning plan",
            durationMin: 30
        )
        #expect(createActivity.title == "Morning plan")

        let updateActivity = Components.Schemas.ActivitySeriesUpdateRequest(
            title: "Updated plan"
        )
        #expect(updateActivity.title == "Updated plan")

        let createTask = Components.Schemas.TaskCreateRequest(
            bucket: .inbox,
            title: "Capture"
        )
        #expect(createTask.title == "Capture")

        let updateTask = Components.Schemas.TaskUpdateRequest(title: "Clarify")
        #expect(updateTask.title == "Clarify")

        let updateSettings = Components.Schemas.UserSettingsUpdateRequest(
            timezone: "America/New_York"
        )
        #expect(updateSettings.timezone == "America/New_York")

        let createRoutine = Components.Schemas.RoutineCreateRequest(
            title: "Morning reset",
            steps: [
                .init(title: "Stretch", durationMin: 5),
                .init(title: "Plan", durationMin: 10),
            ],
            schedule: .init(
                tz: "America/New_York",
                rrule: "FREQ=DAILY",
                paused: false
            )
        )
        #expect(createRoutine.title == "Morning reset")
        #expect(createRoutine.steps?.count == 2)
        #expect(createRoutine.schedule?.tz == "America/New_York")

        let createFocus = Components.Schemas.FocusSessionCreateRequest(
            targetDurationMin: 25,
            title: "Deep work",
            emoji: "🎯"
        )
        #expect(createFocus.targetDurationMin == 25)

        let transitionFocus = Components.Schemas.FocusSessionPatchRequest.case1(
            .init(action: .transition, state: .paused)
        )
        let extendFocus = Components.Schemas.FocusSessionPatchRequest.case2(
            .init(action: .extend, addMinutes: ._5)
        )
        if case let .case1(payload) = transitionFocus {
            #expect(payload.state == .paused)
        } else {
            Issue.record("Expected transition focus payload")
        }
        if case let .case2(payload) = extendFocus {
            #expect(payload.addMinutes == ._5)
        } else {
            Issue.record("Expected extend focus payload")
        }
    }

    @Test func generatedBatchBodiesPreserveArbitraryJSON() throws {
        let scalarOperation = Components.Schemas.BatchOperation(
            method: .POST,
            path: "/api/v1/tasks",
            body: try .init(unvalidatedValue: "capture")
        )
        #expect(scalarOperation.body?.value as? String == "capture")

        let arrayOperation = try decodeFixture(
            Components.Schemas.BatchOperation.self,
            #"{"method":"PATCH","path":"/api/v1/tasks/id","body":[1,"two",true]}"#
        )
        let array = arrayOperation.body?.value as? [(any Sendable)?]
        #expect(array?.count == 3)
        #expect(array?[0] as? Int == 1)
        #expect(array?[1] as? String == "two")
        #expect(array?[2] as? Bool == true)

        let object: [String: (any Sendable)?] = ["ok": true, "count": 2]
        let objectResult = Components.Schemas.BatchResult(
            status: 200,
            body: try .init(unvalidatedValue: object)
        )
        let decodedObject = objectResult.body.value as? [String: (any Sendable)?]
        #expect(decodedObject?["ok"] as? Bool == true)
        #expect(decodedObject?["count"] as? Int == 2)

        let nullResult = try decodeFixture(
            Components.Schemas.BatchResult.self,
            #"{"status":204,"body":null}"#
        )
        #expect(nullResult.body.value == nil)
    }

    @Test func generatedPatchRequestsPreserveOmittedNullAndValue() throws {
        let activityOmitted = Components.Schemas.ActivitySeriesUpdateRequest()
        let activityNull = Components.Schemas.ActivitySeriesUpdateRequest(
            rrule: .null
        )
        let activityValue = Components.Schemas.ActivitySeriesUpdateRequest(
            rrule: .value("FREQ=DAILY")
        )
        try assertTriStateEncoding(
            omitted: activityOmitted,
            null: activityNull,
            value: activityValue,
            field: "rrule",
            expectedValue: "FREQ=DAILY",
            omittedNeighbor: "title"
        )
        let _: Operations.updateActivitySeries.Input.Body = .json(activityNull)

        let occurrenceOmitted =
            Components.Schemas.ActivityOccurrencePatchRequest()
        let occurrenceNull = Components.Schemas.ActivityOccurrencePatchRequest(
            title: .null
        )
        let occurrenceValue =
            Components.Schemas.ActivityOccurrencePatchRequest(
                title: .value("Override")
            )
        try assertTriStateEncoding(
            omitted: occurrenceOmitted,
            null: occurrenceNull,
            value: occurrenceValue,
            field: "title",
            expectedValue: "Override",
            omittedNeighbor: "status"
        )
        let _: Operations.overrideActivityOccurrence.Input.Body =
            .json(occurrenceNull)

        let taskOmitted = Components.Schemas.TaskUpdateRequest()
        let taskNull = Components.Schemas.TaskUpdateRequest(notes: .null)
        let taskValue = Components.Schemas.TaskUpdateRequest(
            notes: .value("Remember this")
        )
        try assertTriStateEncoding(
            omitted: taskOmitted,
            null: taskNull,
            value: taskValue,
            field: "notes",
            expectedValue: "Remember this",
            omittedNeighbor: "title"
        )
        let _: Operations.updateTask.Input.Body = .json(taskNull)

        let tagOmitted = Components.Schemas.TagUpdateRequest()
        let tagNull = Components.Schemas.TagUpdateRequest(color: .null)
        let tagValue = Components.Schemas.TagUpdateRequest(
            color: .value("iris")
        )
        try assertTriStateEncoding(
            omitted: tagOmitted,
            null: tagNull,
            value: tagValue,
            field: "color",
            expectedValue: "iris",
            omittedNeighbor: "name"
        )
        let _: Operations.updateTag.Input.Body = .json(tagNull)

        let routineOmitted = Components.Schemas.RoutineUpdateRequest()
        let routineNull = Components.Schemas.RoutineUpdateRequest(notes: .null)
        let routineValue = Components.Schemas.RoutineUpdateRequest(
            notes: .value("Keep this")
        )
        try assertTriStateEncoding(
            omitted: routineOmitted,
            null: routineNull,
            value: routineValue,
            field: "notes",
            expectedValue: "Keep this",
            omittedNeighbor: "title"
        )
        let _: Operations.updateRoutine.Input.Body = .json(routineNull)
    }

    @Test func generatedRoutineListItemPreservesNestedReadModel() throws {
        let item = try decodeFixture(
            Components.Schemas.RoutineListItem.self,
            """
            {
              "id":"0198f834-c9ab-7e12-b1cf-1faebad8f4fd",
              "userId":"0198f834-c9ab-7e12-b1cf-1faebad8f4fe",
              "title":"Morning reset",
              "emoji":null,
              "categoryId":null,
              "notes":null,
              "revision":1,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z",
              "steps":[],
              "schedules":[],
              "stepCount":0,
              "totalMin":-5
            }
            """
        )
        #expect(item.steps.isEmpty)
        #expect(item.schedules.isEmpty)
        #expect(item.stepCount == 0)
        #expect(item.totalMin == -5)
    }

    private func decodeFixture<T: Decodable>(
        _ type: T.Type,
        _ json: String
    ) throws -> T {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(type, from: Data(json.utf8))
    }

    private func assertTriStateEncoding<T: Codable>(
        omitted: T,
        null: T,
        value: T,
        field: String,
        expectedValue: String,
        omittedNeighbor: String
    ) throws {
        let omittedObject = try encodeObject(omitted)
        let nullObject = try encodeObject(null)
        let valueObject = try encodeObject(value)

        #expect(omittedObject[field] == nil)
        #expect(omittedObject[omittedNeighbor] == nil)
        #expect(nullObject[field] is NSNull)
        #expect(nullObject[omittedNeighbor] == nil)
        #expect(valueObject[field] as? String == expectedValue)
        #expect(valueObject[omittedNeighbor] == nil)

        let decoder = JSONDecoder()
        let roundTrippedOmitted = try decoder.decode(
            T.self,
            from: JSONEncoder().encode(omitted)
        )
        let roundTrippedNull = try decoder.decode(
            T.self,
            from: JSONEncoder().encode(null)
        )
        #expect(try encodeObject(roundTrippedOmitted)[field] == nil)
        #expect(try encodeObject(roundTrippedNull)[field] is NSNull)
    }

    private func encodeObject<T: Encodable>(
        _ value: T
    ) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        return try #require(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
    }

    private func assertEnergyLevel(
        _ energy: Components.Schemas.EnergyLevel?
    ) {}

    private func assertChecklistTemplate(
        _ checklist: Components.Schemas.ActivitySeries.checklistTemplatePayload
    ) {}
}
