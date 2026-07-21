/**
 * Pure unit tests for the ADR-001 edit-scope patch whitelists —
 * pickSeriesPatch / pickOccurrencePatch. These are the security-relevant
 * gate that stops arbitrary client fields (id, userId, revision, ...) from
 * being written via editScope=all / this_and_future / this. No DB needed.
 */
import { describe, expect, it } from "vitest";
import { pickSeriesPatch, pickOccurrencePatch } from "./recurrence";

describe("pickSeriesPatch", () => {
  it("keeps only whitelisted series columns", () => {
    const out = pickSeriesPatch({
      title: "New title",
      durationMin: 45,
      notAColumn: "nope",
    });
    expect(out).toEqual({ title: "New title", durationMin: 45 });
  });

  it("drops disallowed / dangerous keys (id, userId, revision, createdAt)", () => {
    const out = pickSeriesPatch({
      id: "attacker-id",
      userId: "someone-else",
      revision: 999,
      createdAt: new Date(),
      title: "ok",
    });
    expect(out).toEqual({ title: "ok" });
  });

  it("drops keys whose value is undefined, but keeps explicit null", () => {
    const out = pickSeriesPatch({
      title: undefined,
      notes: null,
      emoji: "🎯",
    });
    expect(out).toEqual({ notes: null, emoji: "🎯" });
  });

  it("returns an empty object for an all-disallowed patch", () => {
    expect(pickSeriesPatch({ id: "x", userId: "y" })).toEqual({});
  });

  it("returns an empty object for an empty patch", () => {
    expect(pickSeriesPatch({})).toEqual({});
  });

  it("passes through every documented series column", () => {
    const full = {
      tz: "UTC",
      dtstartLocal: new Date("2026-01-01T00:00:00Z"),
      rrule: "FREQ=DAILY",
      exdate: [],
      rdate: [],
      title: "t",
      emoji: "🌤️",
      categoryId: "cat-1",
      durationMin: 30,
      checklistTemplate: [],
      energy: "medium",
      priority: "high",
      tags: ["a"],
      notes: "n",
      source: "manual",
      sourceRef: null,
    };
    expect(pickSeriesPatch(full)).toEqual(full);
  });
});

describe("pickOccurrencePatch", () => {
  it("keeps only whitelisted occurrence-override columns", () => {
    const out = pickOccurrencePatch({
      title: "Moved",
      status: "completed",
      seriesId: "attacker-series",
      occurrenceKey: new Date(),
    });
    expect(out).toEqual({ title: "Moved", status: "completed" });
  });

  it("drops undefined values but keeps explicit null", () => {
    const out = pickOccurrencePatch({
      title: undefined,
      completedAt: null,
    });
    expect(out).toEqual({ completedAt: null });
  });

  it("returns an empty object when nothing matches the whitelist", () => {
    expect(pickOccurrencePatch({ id: "x", deletedAt: new Date() })).toEqual({});
  });

  it("passes through every documented occurrence column", () => {
    const full = {
      title: "t",
      startAt: new Date("2026-01-01T09:00:00Z"),
      durationMin: 20,
      status: "skipped",
      completedAt: null,
      checklistOverride: [{ label: "a", done: true }],
      energy: "low",
    };
    expect(pickOccurrencePatch(full)).toEqual(full);
  });
});
