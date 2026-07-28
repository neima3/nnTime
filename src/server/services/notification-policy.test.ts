import { describe, expect, it } from "vitest";
import {
  activityDedupKey,
  activityFireTimes,
  buildPushPayload,
  hideActivityTitlesOnLockScreen,
  notificationSoundEnabled,
  notificationTypeEnabled,
  retryDelayMs,
} from "./notification-policy";

const START = new Date("2026-07-28T14:00:00.000Z");

describe("activityFireTimes", () => {
  it("computes start, halfway, and wrap-up with bounded expiry", () => {
    expect(activityFireTimes(START, 30)).toEqual([
      {
        type: "start",
        fireAt: START,
        expiresAt: new Date("2026-07-28T14:30:00.000Z"),
      },
      {
        type: "halfway",
        fireAt: new Date("2026-07-28T14:15:00.000Z"),
        expiresAt: new Date("2026-07-28T15:00:00.000Z"),
      },
      {
        type: "wrap-up",
        fireAt: new Date("2026-07-28T14:25:00.000Z"),
        expiresAt: new Date("2026-07-28T15:10:00.000Z"),
      },
    ]);
  });

  it("omits wrap-up for a short activity", () => {
    expect(activityFireTimes(START, 8).map((candidate) => candidate.type)).toEqual([
      "start",
      "halfway",
    ]);
  });

  it("normalizes invalid duration to a one-minute activity", () => {
    const candidates = activityFireTimes(START, Number.NaN);
    expect(candidates).toHaveLength(2);
    expect(candidates[1]?.fireAt.toISOString()).toBe("2026-07-28T14:00:30.000Z");
  });

  it("applies bounded per-user offsets to each activity reminder", () => {
    const candidates = activityFireTimes(START, 30, {
      startOffsetMin: -10,
      halfwayOffsetMin: 5,
      wrapUpOffsetMin: -2,
    });

    expect(
      candidates.map((candidate) => [
        candidate.type,
        candidate.fireAt.toISOString(),
      ]),
    ).toEqual([
      ["start", "2026-07-28T13:50:00.000Z"],
      ["halfway", "2026-07-28T14:20:00.000Z"],
      ["wrap-up", "2026-07-28T14:23:00.000Z"],
    ]);
    expect(
      activityFireTimes(START, 30, {
        startOffsetMin: -61,
        halfwayOffsetMin: 1.5,
        wrapUpOffsetMin: "5",
      }).map((candidate) => candidate.fireAt.toISOString()),
    ).toEqual([
      "2026-07-28T14:00:00.000Z",
      "2026-07-28T14:15:00.000Z",
      "2026-07-28T14:25:00.000Z",
    ]);
  });
});

describe("notificationTypeEnabled", () => {
  it.each([
    ["start", "startNudges"],
    ["halfway", "halfwayNudges"],
    ["wrap-up", "wrapUpNudges"],
    ["review-today", "reviewTodayNudges"],
    ["weekly-review", "weeklyReviewNudges"],
  ] as const)("maps %s to %s and only explicit false disables it", (type, key) => {
    expect(notificationTypeEnabled(undefined, type)).toBe(true);
    expect(notificationTypeEnabled({}, type)).toBe(true);
    expect(notificationTypeEnabled({ [key]: true }, type)).toBe(true);
    expect(notificationTypeEnabled({ [key]: false }, type)).toBe(false);
    expect(notificationTypeEnabled({ [key]: "false" }, type)).toBe(true);
  });
});

describe("retryDelayMs", () => {
  it("uses bounded exponential backoff", () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(300_000);
    expect(retryDelayMs(3)).toBe(900_000);
    expect(retryDelayMs(4)).toBe(1_800_000);
    expect(retryDelayMs(9)).toBe(1_800_000);
  });
});

describe("activityDedupKey", () => {
  it("is stable across retries and includes occurrence identity", () => {
    expect(
      activityDedupKey({
        userId: "user-1",
        seriesId: "018f0d00-0000-7000-8000-000000000001",
        occurrenceKey: START,
        type: "start",
        fireAt: START,
      }),
    ).toBe(
      "user-1:activity:018f0d00-0000-7000-8000-000000000001:2026-07-28T14:00:00.000Z:start:2026-07-28T14:00:00.000Z",
    );
  });
});

describe("buildPushPayload", () => {
  it.each([
    [
      "start",
      {
        title: "🌿 Deep work",
        body: "Starting now — no rush, just a nudge.",
        tag: "start-series-1",
        url: "/app/today",
      },
    ],
    [
      "halfway",
      {
        title: "Halfway through Deep work",
        body: "A gentle check-in — keep going or adjust the plan.",
        tag: "halfway-series-1",
        url: "/app/today",
      },
    ],
    [
      "wrap-up",
      {
        title: "Deep work is wrapping up",
        body: "About five minutes left — finish softly or extend.",
        tag: "wrap-up-series-1",
        url: "/app/focus",
      },
    ],
    [
      "review-today",
      {
        title: "Review today",
        body: "A quiet moment to close the loop on your day.",
        tag: "review-today",
        url: "/app/review",
      },
    ],
    [
      "weekly-review",
      {
        title: "Weekly review",
        body: "Notice what worked and shape a gentler week ahead.",
        tag: "weekly-review",
        url: "/app/week",
      },
    ],
  ] as const)("builds privacy-minimal %s copy", (type, expected) => {
    const payload = buildPushPayload(type, {
      title: "Deep work",
      emoji: "🌿",
      entityId: "series-1",
    });
    expect(payload).toEqual(expected);
    expect(JSON.stringify(payload)).not.toContain("private note");
  });

  it("maps the per-user sound preference to the Web Notification silent flag", () => {
    expect(notificationSoundEnabled(undefined)).toBe(true);
    expect(notificationSoundEnabled({ soundEnabled: true })).toBe(true);
    expect(notificationSoundEnabled({ soundEnabled: false })).toBe(false);
    expect(notificationSoundEnabled({ soundEnabled: "false" })).toBe(true);

    expect(
      buildPushPayload("review-today", { soundEnabled: false }),
    ).toMatchObject({ silent: true });
    expect(
      buildPushPayload("review-today", { soundEnabled: true }),
    ).toMatchObject({ silent: false });
  });

  it("can hide activity names and emoji from lock-screen copy", () => {
    for (const type of ["start", "halfway", "wrap-up"] as const) {
      const payload = buildPushPayload(type, {
        title: "Private therapy appointment",
        emoji: "🩺",
        entityId: "series-1",
        hideActivityTitle: true,
      });
      expect(JSON.stringify(payload)).not.toContain("therapy");
      expect(JSON.stringify(payload)).not.toContain("🩺");
      expect(payload.tag).toBe(`${type}-series-1`);
    }
  });
});

describe("hideActivityTitlesOnLockScreen", () => {
  it("requires an explicit privacy opt-in", () => {
    expect(hideActivityTitlesOnLockScreen(undefined)).toBe(false);
    expect(hideActivityTitlesOnLockScreen({})).toBe(false);
    expect(
      hideActivityTitlesOnLockScreen({
        hideActivityTitlesOnLockScreen: true,
      }),
    ).toBe(true);
    expect(
      hideActivityTitlesOnLockScreen({
        hideActivityTitlesOnLockScreen: "true",
      }),
    ).toBe(false);
  });
});
