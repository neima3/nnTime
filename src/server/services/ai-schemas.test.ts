/**
 * Pure unit tests for the AI co-planner's strict output zod schemas
 * (ADR-005 / SEC-05: unknown-field rejection + length/size caps). These
 * schemas are the last line of defense against a misbehaving model
 * response, so their edge cases are worth locking down directly — no
 * network call or DB needed.
 */
import { describe, expect, it } from "vitest";
import {
  breakdownSchema,
  nlAddSchema,
  planDayItemSchema,
  planDaySchema,
  priorityGroupingSchema,
} from "./ai";

describe("breakdownSchema", () => {
  it("accepts a valid steps array", () => {
    const parsed = breakdownSchema.parse({ steps: ["Step 1", "Step 2"] });
    expect(parsed.steps).toEqual(["Step 1", "Step 2"]);
  });

  it("rejects unknown top-level fields", () => {
    expect(() =>
      breakdownSchema.parse({ steps: ["a"], extra: "not allowed" }),
    ).toThrow();
  });

  it("rejects more than 10 steps", () => {
    const steps = Array.from({ length: 11 }, (_, i) => `step ${i}`);
    expect(() => breakdownSchema.parse({ steps })).toThrow();
  });

  it("accepts exactly 10 steps", () => {
    const steps = Array.from({ length: 10 }, (_, i) => `step ${i}`);
    expect(breakdownSchema.parse({ steps }).steps).toHaveLength(10);
  });

  it("rejects a step longer than 200 characters", () => {
    expect(() =>
      breakdownSchema.parse({ steps: ["x".repeat(201)] }),
    ).toThrow();
  });

  it("accepts an empty steps array", () => {
    expect(breakdownSchema.parse({ steps: [] }).steps).toEqual([]);
  });

  it("rejects a missing steps field", () => {
    expect(() => breakdownSchema.parse({})).toThrow();
  });
});

describe("nlAddSchema", () => {
  it("accepts a title-only draft (all optional fields omitted)", () => {
    const parsed = nlAddSchema.parse({ title: "Buy milk" });
    expect(parsed.title).toBe("Buy milk");
    expect(parsed.durationMin).toBeUndefined();
  });

  it("accepts a fully-populated draft", () => {
    const draft = {
      title: "Team sync",
      emoji: "📅",
      durationMin: 30,
      energy: "medium",
      bucket: "anytime",
      date: "2026-07-20",
      startMin: 900,
    };
    expect(nlAddSchema.parse(draft)).toEqual(draft);
  });

  it("rejects unknown top-level fields", () => {
    expect(() =>
      nlAddSchema.parse({ title: "x", hackerField: true }),
    ).toThrow();
  });

  it("rejects durationMin outside 5-480", () => {
    expect(() => nlAddSchema.parse({ title: "x", durationMin: 4 })).toThrow();
    expect(() => nlAddSchema.parse({ title: "x", durationMin: 481 })).toThrow();
  });

  it("rejects a non-integer durationMin", () => {
    expect(() => nlAddSchema.parse({ title: "x", durationMin: 30.5 })).toThrow();
  });

  it("rejects an invalid energy enum value", () => {
    expect(() =>
      nlAddSchema.parse({ title: "x", energy: "extreme" }),
    ).toThrow();
  });

  it("rejects a malformed date string", () => {
    expect(() => nlAddSchema.parse({ title: "x", date: "07-20-2026" })).toThrow();
    expect(() => nlAddSchema.parse({ title: "x", date: "2026/07/20" })).toThrow();
  });

  it("rejects startMin outside 0-1439", () => {
    expect(() => nlAddSchema.parse({ title: "x", startMin: -1 })).toThrow();
    expect(() => nlAddSchema.parse({ title: "x", startMin: 1440 })).toThrow();
  });

  it("accepts startMin at the boundary values 0 and 1439", () => {
    expect(nlAddSchema.parse({ title: "x", startMin: 0 }).startMin).toBe(0);
    expect(nlAddSchema.parse({ title: "x", startMin: 1439 }).startMin).toBe(1439);
  });

  it("rejects a title longer than 200 characters", () => {
    expect(() => nlAddSchema.parse({ title: "x".repeat(201) })).toThrow();
  });
});

describe("planDayItemSchema / planDaySchema", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts a minimal item (taskId only)", () => {
    const item = planDayItemSchema.parse({ taskId: VALID_UUID });
    expect(item.taskId).toBe(VALID_UUID);
  });

  it("rejects a non-uuid taskId", () => {
    expect(() => planDayItemSchema.parse({ taskId: "not-a-uuid" })).toThrow();
  });

  it("rejects a reason longer than 200 characters", () => {
    expect(() =>
      planDayItemSchema.parse({ taskId: VALID_UUID, reason: "x".repeat(201) }),
    ).toThrow();
  });

  it("planDaySchema rejects more than 20 items", () => {
    const items = Array.from({ length: 21 }, () => ({ taskId: VALID_UUID }));
    expect(() => planDaySchema.parse({ items })).toThrow();
  });

  it("planDaySchema accepts an empty items array (nothing scheduled)", () => {
    expect(planDaySchema.parse({ items: [] }).items).toEqual([]);
  });

  it("planDaySchema rejects unknown top-level fields", () => {
    expect(() =>
      planDaySchema.parse({ items: [], autoApply: true }),
    ).toThrow();
  });
});

describe("priorityGroupingSchema", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts a valid grouping", () => {
    const parsed = priorityGroupingSchema.parse({
      groups: [{ priority: "high", taskIds: [VALID_UUID] }],
    });
    expect(parsed.groups[0]!.priority).toBe("high");
  });

  it("rejects an invalid priority enum value", () => {
    expect(() =>
      priorityGroupingSchema.parse({
        groups: [{ priority: "urgent", taskIds: [] }],
      }),
    ).toThrow();
  });

  it("rejects more than 5 groups", () => {
    const groups = Array.from({ length: 6 }, () => ({
      priority: "none" as const,
      taskIds: [],
    }));
    expect(() => priorityGroupingSchema.parse({ groups })).toThrow();
  });

  it("rejects more than 50 taskIds in a single group", () => {
    const taskIds = Array.from({ length: 51 }, () => VALID_UUID);
    expect(() =>
      priorityGroupingSchema.parse({
        groups: [{ priority: "low", taskIds }],
      }),
    ).toThrow();
  });

  it("rejects durationEstimateMin outside 5-480", () => {
    expect(() =>
      priorityGroupingSchema.parse({
        groups: [{ priority: "low", taskIds: [], durationEstimateMin: 3 }],
      }),
    ).toThrow();
  });

  it("rejects a non-array taskIds entry with a non-uuid element", () => {
    expect(() =>
      priorityGroupingSchema.parse({
        groups: [{ priority: "low", taskIds: ["not-a-uuid"] }],
      }),
    ).toThrow();
  });
});
