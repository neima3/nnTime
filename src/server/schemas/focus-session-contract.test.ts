import { describe, expect, it } from "vitest";
import {
  focusSessionCreateRequest,
  focusSessionPatchRequest,
  focusSnapshotResponse,
} from "./focus-session";

const session = {
  id: "01980000-7000-8000-8000-000000000001",
  userId: "opaque-better-auth-user-id",
  activityOccurrenceId: null,
  state: "running",
  startedAt: "2026-07-28T12:00:00.000Z",
  targetDurationMin: 25,
  accumulatedPauseSec: 0,
  currentIntervalStartedAt: "2026-07-28T12:00:00.000Z",
  completionReason: null,
  revision: 1,
  createdAt: "2026-07-28T12:00:00.000Z",
  updatedAt: "2026-07-28T12:00:00.000Z",
};

describe("focus wire contract", () => {
  it("accepts the shipping start request", () => {
    expect(
      focusSessionCreateRequest.parse({
        targetDurationMin: 25,
        title: "Deep work",
        emoji: "🎯",
      }),
    ).toEqual({
      targetDurationMin: 25,
      title: "Deep work",
      emoji: "🎯",
    });
  });

  it("accepts a paired virtual-occurrence selector", () => {
    expect(
      focusSessionCreateRequest.parse({
        targetDurationMin: 25,
        activitySeriesId: "01980000-7000-8000-8000-000000000010",
        occurrenceKey: "2026-03-10T13:00:00.000Z",
      }),
    ).toMatchObject({
      targetDurationMin: 25,
      activitySeriesId: "01980000-7000-8000-8000-000000000010",
      occurrenceKey: "2026-03-10T13:00:00.000Z",
    });
  });

  it("rejects an incomplete selector pair and mixed selectors", () => {
    expect(
      focusSessionCreateRequest.safeParse({
        targetDurationMin: 25,
        activitySeriesId: "01980000-7000-8000-8000-000000000010",
      }).success,
    ).toBe(false);
    expect(
      focusSessionCreateRequest.safeParse({
        targetDurationMin: 25,
        occurrenceKey: "2026-03-10T13:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      focusSessionCreateRequest.safeParse({
        targetDurationMin: 25,
        activityOccurrenceId: "01980000-7000-8000-8000-000000000011",
        activitySeriesId: "01980000-7000-8000-8000-000000000010",
        occurrenceKey: "2026-03-10T13:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid focus durations", () => {
    expect(
      focusSessionCreateRequest.safeParse({ targetDurationMin: 0 }).success,
    ).toBe(false);
    expect(
      focusSessionCreateRequest.safeParse({ targetDurationMin: 1441 }).success,
    ).toBe(false);
  });

  it("accepts transition and bounded extend requests", () => {
    expect(
      focusSessionPatchRequest.safeParse({
        action: "transition",
        state: "paused",
      }).success,
    ).toBe(true);
    expect(
      focusSessionPatchRequest.safeParse({
        action: "extend",
        addMinutes: 5,
      }).success,
    ).toBe(true);
    expect(
      focusSessionPatchRequest.safeParse({
        action: "extend",
        addMinutes: 30,
      }).success,
    ).toBe(false);
  });

  it("accepts active and empty focus snapshots", () => {
    expect(
      focusSnapshotResponse.safeParse({ session, remainingSec: 1499 }).success,
    ).toBe(true);
    expect(focusSnapshotResponse.parse({ session: null })).toEqual({
      session: null,
    });
  });
});
