import XCTest
@testable import Kairo

/// Golden-fixture tests for the wire-model JSON decoding + the custom
/// date-decoding strategy used by `KairoAPI` (App/API/KairoAPI.swift).
///
/// No network involved — every fixture below is an inline JSON string.
/// `makeDecoder()` mirrors the private `decoder` property inside `KairoAPI`
/// field-for-field: fractional ISO8601 → plain ISO8601 → date-only
/// (YYYY-MM-DD, UTC) → throw. If that closure ever changes, update it here
/// too so these tests stay honest about what's actually shipped.
final class ModelDecodingTests: XCTestCase {

    // MARK: - Decoder under test

    private func makeDecoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let s = try decoder.singleValueContainer().decode(String.self)
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = iso.date(from: s) { return date }
            iso.formatOptions = [.withInternetDateTime]
            if let date = iso.date(from: s) { return date }
            // date-only (YYYY-MM-DD)
            let df = DateFormatter()
            df.dateFormat = "yyyy-MM-dd"
            df.timeZone = TimeZone(identifier: "UTC")
            if let date = df.date(from: s) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Bad date: \(s)"))
        }
        return d
    }

    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try makeDecoder().decode(T.self, from: Data(json.utf8))
    }

    private func utcDate(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 0, _ mi: Int = 0, _ s: Int = 0) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        var comps = DateComponents()
        comps.year = y; comps.month = m; comps.day = d
        comps.hour = h; comps.minute = mi; comps.second = s
        return cal.date(from: comps)!
    }

    // MARK: - Date strategy

    func testDateStrategy_fractionalISO8601() throws {
        struct Wrapper: Decodable { let d: Date }
        let json = #"{"d":"2026-07-19T13:30:00.000Z"}"#
        let w = try decode(Wrapper.self, json)
        XCTAssertEqual(w.d, utcDate(2026, 7, 19, 13, 30, 0))
    }

    func testDateStrategy_plainISO8601() throws {
        struct Wrapper: Decodable { let d: Date }
        let json = #"{"d":"2026-07-19T13:30:00Z"}"#
        let w = try decode(Wrapper.self, json)
        XCTAssertEqual(w.d, utcDate(2026, 7, 19, 13, 30, 0))
    }

    func testDateStrategy_dateOnlyUTC() throws {
        struct Wrapper: Decodable { let d: Date }
        let json = #"{"d":"2026-07-19"}"#
        let w = try decode(Wrapper.self, json)
        XCTAssertEqual(w.d, utcDate(2026, 7, 19, 0, 0, 0))
    }

    func testDateStrategy_garbageStringThrows() {
        struct Wrapper: Decodable { let d: Date }
        let json = #"{"d":"not-a-date"}"#
        XCTAssertThrowsError(try decode(Wrapper.self, json))
    }

    // MARK: - Activity

    func testActivity_fullFields_dayExpandedOccurrence() throws {
        let json = """
        {
          "id": "act_1",
          "title": "Morning walk",
          "emoji": "🚶",
          "tz": "America/New_York",
          "dtstartLocal": "2026-07-19T13:30:00.000Z",
          "durationMin": 30,
          "rrule": "FREQ=DAILY",
          "categoryId": "cat_health",
          "checklistTemplate": [
            {"label": "Shoes on", "done": true},
            {"label": "Stretch", "done": false}
          ],
          "revision": 4,
          "occurrenceKey": "2026-07-19T13:30:00.000Z",
          "status": "completed"
        }
        """
        let a = try decode(Activity.self, json)
        XCTAssertEqual(a.id, "act_1")
        XCTAssertEqual(a.title, "Morning walk")
        XCTAssertEqual(a.emoji, "🚶")
        XCTAssertEqual(a.tz, "America/New_York")
        XCTAssertEqual(a.dtstartLocal, utcDate(2026, 7, 19, 13, 30, 0))
        XCTAssertEqual(a.durationMin, 30)
        XCTAssertEqual(a.rrule, "FREQ=DAILY")
        XCTAssertEqual(a.categoryId, "cat_health")
        XCTAssertEqual(a.checklistTemplate?.count, 2)
        XCTAssertEqual(a.checklistTemplate?[0].label, "Shoes on")
        XCTAssertEqual(a.checklistTemplate?[0].done, true)
        XCTAssertEqual(a.checklistTemplate?[1].done, false)
        XCTAssertEqual(a.revision, 4)
        XCTAssertEqual(a.occurrenceKey, utcDate(2026, 7, 19, 13, 30, 0))
        XCTAssertEqual(a.status, "completed")
    }

    func testActivity_minimalFields_optionalsNil() throws {
        let json = """
        {
          "id": "act_2",
          "title": "One-off task",
          "emoji": null,
          "tz": "UTC",
          "dtstartLocal": "2026-07-19T09:00:00Z",
          "durationMin": 15,
          "rrule": null,
          "categoryId": null,
          "checklistTemplate": null,
          "revision": 1,
          "occurrenceKey": null,
          "status": null
        }
        """
        let a = try decode(Activity.self, json)
        XCTAssertNil(a.emoji)
        XCTAssertNil(a.rrule)
        XCTAssertNil(a.categoryId)
        XCTAssertNil(a.checklistTemplate)
        XCTAssertNil(a.occurrenceKey)
        XCTAssertNil(a.status)
        XCTAssertEqual(a.dtstartLocal, utcDate(2026, 7, 19, 9, 0, 0))
    }

    func testActivity_checklistItem_doneOmitted() throws {
        let json = #"{"label": "No status yet"}"#
        let item = try decode(Activity.ChecklistItem.self, json)
        XCTAssertEqual(item.label, "No status yet")
        XCTAssertNil(item.done)
    }

    // MARK: - DayResponse

    func testDayResponse_decodesActivitiesZoneDate() throws {
        let json = """
        {
          "date": "2026-07-19",
          "zone": "America/New_York",
          "activities": [
            {
              "id": "act_1", "title": "Standup", "emoji": "🗓️",
              "tz": "America/New_York", "dtstartLocal": "2026-07-19T13:00:00Z",
              "durationMin": 15, "rrule": null, "categoryId": null,
              "checklistTemplate": null, "revision": 1,
              "occurrenceKey": "2026-07-19T13:00:00Z", "status": "pending"
            }
          ],
          "occurrenceStatusBySeries": {"act_1": "pending"}
        }
        """
        let day = try decode(DayResponse.self, json)
        XCTAssertEqual(day.date, "2026-07-19")
        XCTAssertEqual(day.zone, "America/New_York")
        XCTAssertEqual(day.activities.count, 1)
        XCTAssertEqual(day.activities[0].id, "act_1")
        XCTAssertEqual(day.occurrenceStatusBySeries?["act_1"], "pending")
    }

    // MARK: - TaskItem

    func testTaskItem_decodesWithCreatedAt() throws {
        let json = """
        {
          "id": "task_1", "title": "Buy milk", "emoji": null,
          "bucket": "inbox", "priority": "high", "revision": 2,
          "createdAt": "2026-07-19T08:00:00.000Z"
        }
        """
        let t = try decode(TaskItem.self, json)
        XCTAssertEqual(t.id, "task_1")
        XCTAssertNil(t.emoji)
        XCTAssertEqual(t.bucket, "inbox")
        XCTAssertEqual(t.priority, "high")
        XCTAssertEqual(t.createdAt, utcDate(2026, 7, 19, 8, 0, 0))
    }

    func testTaskItem_decodesWithNilCreatedAt() throws {
        let json = """
        {
          "id": "task_2", "title": "Call dentist", "emoji": "📞",
          "bucket": "anytime", "priority": null, "revision": 1,
          "createdAt": null
        }
        """
        let t = try decode(TaskItem.self, json)
        XCTAssertNil(t.createdAt)
        XCTAssertNil(t.priority)
    }

    // MARK: - FocusSnapshot

    func testFocusSnapshot_withActiveSession() throws {
        let json = """
        {
          "session": {
            "id": "focus_1", "state": "running",
            "targetDurationMin": 25, "startedAt": "2026-07-19T13:30:00.000Z"
          },
          "remainingSec": 900
        }
        """
        let snap = try decode(FocusSnapshot.self, json)
        XCTAssertEqual(snap.session?.id, "focus_1")
        XCTAssertEqual(snap.session?.state, "running")
        XCTAssertEqual(snap.session?.targetDurationMin, 25)
        XCTAssertEqual(snap.session?.startedAt, utcDate(2026, 7, 19, 13, 30, 0))
        XCTAssertEqual(snap.remainingSec, 900)
    }

    func testFocusSnapshot_noActiveSession() throws {
        let json = #"{"session": null, "remainingSec": null}"#
        let snap = try decode(FocusSnapshot.self, json)
        XCTAssertNil(snap.session)
        XCTAssertNil(snap.remainingSec)
    }

    // MARK: - UserSettings

    func testUserSettings_decodesWithOptionalFieldsPresent() throws {
        let json = """
        {
          "timezone": "America/New_York", "theme": "dark",
          "reducedStimulation": true, "hourCycle": "h12",
          "weekStart": 1, "revision": 3
        }
        """
        let s = try decode(UserSettings.self, json)
        XCTAssertEqual(s.timezone, "America/New_York")
        XCTAssertEqual(s.theme, "dark")
        XCTAssertEqual(s.reducedStimulation, true)
        XCTAssertEqual(s.hourCycle, "h12")
        XCTAssertEqual(s.weekStart, 1)
        XCTAssertEqual(s.revision, 3)
    }

    func testUserSettings_decodesWithOptionalFieldsMissing() throws {
        let json = #"{"timezone": "UTC", "revision": 0}"#
        let s = try decode(UserSettings.self, json)
        XCTAssertEqual(s.timezone, "UTC")
        XCTAssertEqual(s.revision, 0)
        XCTAssertNil(s.theme)
        XCTAssertNil(s.reducedStimulation)
        XCTAssertNil(s.hourCycle)
        XCTAssertNil(s.weekStart)
    }

    // MARK: - Page<T>

    func testPage_decodesItemsArray() throws {
        let json = """
        {
          "items": [
            {"id": "task_1", "title": "A", "emoji": null, "bucket": "inbox", "priority": null, "revision": 1, "createdAt": null},
            {"id": "task_2", "title": "B", "emoji": "✅", "bucket": "anytime", "priority": "low", "revision": 2, "createdAt": "2026-07-19T00:00:00Z"}
          ]
        }
        """
        let page = try decode(Page<TaskItem>.self, json)
        XCTAssertEqual(page.items.count, 2)
        XCTAssertEqual(page.items[0].id, "task_1")
        XCTAssertEqual(page.items[1].emoji, "✅")
        XCTAssertEqual(page.items[1].createdAt, utcDate(2026, 7, 19, 0, 0, 0))
    }
}
