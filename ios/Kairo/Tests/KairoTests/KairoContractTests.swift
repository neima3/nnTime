import Testing
import Foundation
@testable import Kairo

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
              "energy":null,
              "revision":1,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )
        #expect(task.energy == nil)

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
              "energy":null,
              "priority":"none",
              "source":"manual",
              "revision":1,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )
        #expect(series.energy == nil)

        let occurrence = try decodeFixture(
            Components.Schemas.ActivityOccurrence.self,
            """
            {
              "id":"0198f834-c9ab-7e12-b1cf-1faebad8f4fd",
              "userId":"0198f834-c9ab-7e12-b1cf-1faebad8f4fe",
              "seriesId":"0198f834-c9ab-7e12-b1cf-1faebad8f4fc",
              "occurrenceKey":"2026-07-28T13:00:00Z",
              "status":"pending",
              "energy":null,
              "revision":1,
              "createdAt":"2026-07-28T12:00:00Z",
              "updatedAt":"2026-07-28T12:00:00Z"
            }
            """
        )
        #expect(occurrence.energy == nil)

        let batchResult = try decodeFixture(
            Components.Schemas.BatchResult.self,
            #"{"status":204,"body":null}"#
        )
        #expect(batchResult.body == nil)

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
            #"{"mood":"good","note":null}"#
        )
        #expect(mood.mood == .good)
        let response = try decodeFixture(
            Components.Schemas.MoodCheckinResponse.self,
            #"{"ok":true}"#
        )
        #expect(response.ok)
    }

    private func decodeFixture<T: Decodable>(
        _ type: T.Type,
        _ json: String
    ) throws -> T {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(type, from: Data(json.utf8))
    }
}
