/**
 * Completion netting — the "undo doesn't decrement" regression.
 *
 * planner_events is append-only, so un-completing appends an `uncomplete` row
 * rather than removing the `complete`. Counting raw `complete` events inflated
 * every number: one activity toggled complete → undo → complete read as 2, and
 * each further correction added another. Insights, Totals, the soft streak and
 * the reward garden all sit on this count.
 */
import { describe, expect, it } from "vitest";
import { netCompletions, bucketEventsByZoneDate } from "./stats";

const ZONE = "America/New_York";
const SERIES = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const KEY_A = "2026-08-13T13:00:00.000Z";
const KEY_B = "2026-08-13T18:00:00.000Z";

let clock = 0;
/** Events are netted in chronological order; each helper advances the clock. */
function ev(eventType: string, entityId: string, occurrenceKey?: string) {
  clock += 1000;
  return {
    eventType,
    entityId,
    occurredAt: new Date(Date.UTC(2026, 7, 13, 14, 0, clock / 1000)),
    payload: occurrenceKey ? { occurrenceKey } : {},
  };
}

describe("netCompletions", () => {
  it("counts a single completion once", () => {
    expect(netCompletions([ev("complete", SERIES, KEY_A)])).toHaveLength(1);
  });

  it("drops a completion that was undone", () => {
    const events = [ev("complete", SERIES, KEY_A), ev("uncomplete", SERIES, KEY_A)];
    expect(netCompletions(events)).toHaveLength(0);
  });

  it("re-completing after an undo still counts once — the reported bug", () => {
    const events = [
      ev("complete", SERIES, KEY_A),
      ev("uncomplete", SERIES, KEY_A),
      ev("complete", SERIES, KEY_A),
      ev("uncomplete", SERIES, KEY_A),
      ev("complete", SERIES, KEY_A),
    ];
    // Raw event counting gave 3 here (and 4 in the live repro).
    expect(netCompletions(events)).toHaveLength(1);
  });

  it("keeps sibling occurrences of the same series independent", () => {
    const events = [
      ev("complete", SERIES, KEY_A),
      ev("complete", SERIES, KEY_B),
      ev("uncomplete", SERIES, KEY_A),
    ];
    const live = netCompletions(events);
    expect(live).toHaveLength(1);
    expect((live[0]!.payload as { occurrenceKey: string }).occurrenceKey).toBe(KEY_B);
  });

  it("does not let one series' undo clear another series", () => {
    const events = [
      ev("complete", SERIES, KEY_A),
      ev("complete", OTHER, KEY_A),
      ev("uncomplete", SERIES, KEY_A),
    ];
    const live = netCompletions(events);
    expect(live).toHaveLength(1);
    expect(live[0]!.entityId).toBe(OTHER);
  });

  it("nets legacy uncomplete rows that carry no occurrenceKey", () => {
    // Rows written before the payload carried an occurrenceKey.
    const events = [ev("complete", SERIES, KEY_A), ev("uncomplete", SERIES)];
    expect(netCompletions(events)).toHaveLength(0);
  });

  it("ignores unrelated event types", () => {
    const events = [
      ev("complete", SERIES, KEY_A),
      ev("focus_stop", SERIES),
      ev("mood_checkin", SERIES),
      ev("skip", OTHER),
    ];
    expect(netCompletions(events)).toHaveLength(1);
  });

  it("uses chronology, not the order rows arrive in", () => {
    const earlierUndo = ev("uncomplete", SERIES, KEY_A);
    const laterComplete = ev("complete", SERIES, KEY_A);
    // The complete happened AFTER the undo, so it stands — whichever order the
    // rows are passed in (the DB does not guarantee ordering without ORDER BY).
    expect(netCompletions([earlierUndo, laterComplete])).toHaveLength(1);
    expect(netCompletions([laterComplete, earlierUndo])).toHaveLength(1);
  });
});

describe("bucketEventsByZoneDate counts net completions", () => {
  it("attributes the completion to the date of the most recent complete", () => {
    const day1 = {
      eventType: "complete",
      entityId: SERIES,
      occurredAt: new Date("2026-08-12T16:00:00Z"), // Aug 12 in NY
      payload: { occurrenceKey: KEY_A },
    };
    const undo = {
      eventType: "uncomplete",
      entityId: SERIES,
      occurredAt: new Date("2026-08-12T17:00:00Z"),
      payload: { occurrenceKey: KEY_A },
    };
    const day2 = {
      eventType: "complete",
      entityId: SERIES,
      occurredAt: new Date("2026-08-13T16:00:00Z"), // Aug 13 in NY
      payload: { occurrenceKey: KEY_A },
    };
    const byDate = bucketEventsByZoneDate([day1, undo, day2], ZONE);
    expect(byDate["2026-08-12"]?.completed ?? 0).toBe(0);
    expect(byDate["2026-08-13"]?.completed).toBe(1);
  });

  it("still tallies focus minutes and mood from the full event log", () => {
    const events = [
      {
        eventType: "focus_stop",
        entityId: SERIES,
        occurredAt: new Date("2026-08-13T16:00:00Z"),
        payload: { durationMin: 25 },
      },
      {
        eventType: "mood_checkin",
        entityId: SERIES,
        occurredAt: new Date("2026-08-13T17:00:00Z"),
        payload: { mood: "good" },
      },
    ];
    const byDate = bucketEventsByZoneDate(events, ZONE);
    expect(byDate["2026-08-13"]?.focusMin).toBe(25);
    expect(byDate["2026-08-13"]?.mood).toBe("good");
  });
});
