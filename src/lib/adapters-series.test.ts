/**
 * Pure unit tests for seriesToActivity / taskToInboxItem — not covered by
 * adapters.test.ts (which only tests dateToMinutesFromMidnight,
 * localMinutesToInstant, and buildCategoryMap).
 */
import { describe, expect, it } from "vitest";
import { seriesToActivity, taskToInboxItem } from "./adapters";
import type { CategoryId } from "./mock";

function baseSeries(overrides: Record<string, unknown> = {}) {
  return {
    id: "series-1",
    userId: "user-1",
    tz: "UTC",
    dtstartLocal: new Date("2026-07-18T09:00:00Z"),
    rrule: null,
    exdate: null,
    rdate: null,
    title: "Morning routine",
    emoji: null,
    categoryId: null,
    durationMin: 30,
    checklistTemplate: [],
    energy: null,
    priority: "none",
    tags: null,
    notes: null,
    source: "manual",
    sourceRef: null,
    revision: 1,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    deletedAt: null,
    ...overrides,
  } as never; // test-friendly cast, mirrors day.test.ts's ExpandableSeries fixture style
}

function baseTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    userId: "user-1",
    bucket: "anytime",
    title: "Buy groceries",
    emoji: null,
    categoryId: null,
    date: null,
    priority: "none",
    energy: null,
    notes: null,
    convertedTo: null,
    revision: 1,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    deletedAt: null,
    ...overrides,
  } as never;
}

describe("seriesToActivity", () => {
  it("converts a basic series with no category, defaulting to 'sky'", () => {
    const activity = seriesToActivity(baseSeries(), new Map(), "UTC");
    expect(activity.id).toBe("series-1");
    expect(activity.title).toBe("Morning routine");
    expect(activity.category).toBe("sky");
    expect(activity.emoji).toBe("📋"); // default emoji fallback
    expect(activity.duration).toBe(30);
    expect(activity.done).toBe(false);
    expect(activity.recurring).toBe(false);
  });

  it("uses the mapped category when categoryId resolves in categoryMap", () => {
    const categoryMap = new Map<string, CategoryId>([["cat-1", "mint"]]);
    const activity = seriesToActivity(
      baseSeries({ categoryId: "cat-1" }),
      categoryMap,
      "UTC",
    );
    expect(activity.category).toBe("mint");
    expect(activity.categoryId).toBe("cat-1");
  });

  it("falls back to 'sky' when categoryId is set but not found in the map", () => {
    const activity = seriesToActivity(
      baseSeries({ categoryId: "unknown-cat" }),
      new Map(),
      "UTC",
    );
    expect(activity.category).toBe("sky");
  });

  it("marks recurring=true when rrule is present", () => {
    const activity = seriesToActivity(
      baseSeries({ rrule: "FREQ=DAILY" }),
      new Map(),
      "UTC",
    );
    expect(activity.recurring).toBe(true);
  });

  it("defaults occurrenceKey to dtstartLocal's ISO string when not provided", () => {
    const dtstart = new Date("2026-07-18T09:00:00Z");
    const activity = seriesToActivity(baseSeries({ dtstartLocal: dtstart }), new Map(), "UTC");
    expect(activity.occurrenceKey).toBe(dtstart.toISOString());
  });

  it("uses the explicit occurrenceKey override when provided", () => {
    const activity = seriesToActivity(baseSeries(), new Map(), "UTC", {
      occurrenceKey: "2026-07-18T09:00:00.000Z-custom",
      done: true,
    });
    expect(activity.occurrenceKey).toBe("2026-07-18T09:00:00.000Z-custom");
    expect(activity.done).toBe(true);
  });

  it("normalizes an object-shaped checklist template ({label, done})", () => {
    const activity = seriesToActivity(
      baseSeries({
        checklistTemplate: [
          { label: "Step 1", done: true },
          { label: "Step 2" }, // done omitted → should coerce to false
        ],
      }),
      new Map(),
      "UTC",
    );
    expect(activity.checklist).toEqual([
      { label: "Step 1", done: true },
      { label: "Step 2", done: false },
    ]);
  });

  it("normalizes a plain-string checklist template into {label, done:false}", () => {
    const activity = seriesToActivity(
      baseSeries({ checklistTemplate: ["Water plants", "Feed cat"] }),
      new Map(),
      "UTC",
    );
    expect(activity.checklist).toEqual([
      { label: "Water plants", done: false },
      { label: "Feed cat", done: false },
    ]);
  });

  it("leaves checklist undefined for an empty checklistTemplate array", () => {
    const activity = seriesToActivity(baseSeries({ checklistTemplate: [] }), new Map(), "UTC");
    expect(activity.checklist).toBeUndefined();
  });

  it("converts dtstartLocal to minutes-from-midnight in the given zone", () => {
    // 09:00 UTC on 2026-07-18 is 05:00 in America/New_York (EDT, UTC-4).
    const activity = seriesToActivity(
      baseSeries({ dtstartLocal: new Date("2026-07-18T09:00:00Z") }),
      new Map(),
      "America/New_York",
    );
    expect(activity.start).toBe(5 * 60);
  });

  it("passes through notes and energy when present", () => {
    const activity = seriesToActivity(
      baseSeries({ notes: "Bring water bottle", energy: "high" }),
      new Map(),
      "UTC",
    );
    expect(activity.notes).toBe("Bring water bottle");
    expect(activity.energy).toBe("high");
  });
});

describe("taskToInboxItem", () => {
  it("converts a basic task with no category, defaulting to 'sky'", () => {
    const item = taskToInboxItem(baseTask(), new Map());
    expect(item.id).toBe("task-1");
    expect(item.title).toBe("Buy groceries");
    expect(item.category).toBe("sky");
    expect(item.emoji).toBe("📋");
    expect(item.revision).toBe(1);
  });

  it("uses the mapped category when categoryId resolves", () => {
    const categoryMap = new Map<string, CategoryId>([["cat-2", "rose"]]);
    const item = taskToInboxItem(baseTask({ categoryId: "cat-2" }), categoryMap);
    expect(item.category).toBe("rose");
  });

  it("falls back to 'sky' when categoryId is set but unmapped", () => {
    const item = taskToInboxItem(baseTask({ categoryId: "missing" }), new Map());
    expect(item.category).toBe("sky");
  });

  it("preserves a custom emoji when present", () => {
    const item = taskToInboxItem(baseTask({ emoji: "🛒" }), new Map());
    expect(item.emoji).toBe("🛒");
  });
});
