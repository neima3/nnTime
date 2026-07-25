import { describe, it, expect } from "vitest";
import {
  DEFAULT_QUIET_HOURS,
  describeQuietHours,
  formatQuietHour,
  inQuietHours,
  isQuietAt,
  parseQuietHours,
  quietWindowHours,
  writeQuietHours,
} from "./quiet-hours";

describe("parseQuietHours", () => {
  it("returns the default window for missing/garbage prefs", () => {
    for (const bad of [undefined, null, 42, "nope", [], {}, { quietHours: null }, { quietHours: [] }]) {
      expect(parseQuietHours(bad)).toEqual(DEFAULT_QUIET_HOURS);
    }
  });

  it("reads an explicit window", () => {
    expect(parseQuietHours({ quietHours: { enabled: true, start: 21, end: 6 } })).toEqual({
      enabled: true,
      start: 21,
      end: 6,
    });
  });

  it("only treats a literal true as enabled", () => {
    expect(parseQuietHours({ quietHours: { enabled: "yes" } }).enabled).toBe(false);
    expect(parseQuietHours({ quietHours: { enabled: 1 } }).enabled).toBe(false);
  });

  it("falls back per-field on out-of-range or non-numeric hours", () => {
    expect(parseQuietHours({ quietHours: { enabled: true, start: 24, end: 6 } })).toEqual({
      enabled: true,
      start: 22,
      end: 6,
    });
    expect(parseQuietHours({ quietHours: { enabled: true, start: 21, end: -1 } })).toEqual({
      enabled: true,
      start: 21,
      end: 7,
    });
    expect(parseQuietHours({ quietHours: { enabled: true, start: "22" } }).start).toBe(22);
    expect(parseQuietHours({ quietHours: { enabled: true, start: NaN } }).start).toBe(22);
  });

  it("floors fractional hours", () => {
    expect(parseQuietHours({ quietHours: { enabled: true, start: 22.9 } }).start).toBe(22);
  });

  it("does not share the default object between calls", () => {
    const a = parseQuietHours(undefined);
    a.start = 3;
    expect(parseQuietHours(undefined).start).toBe(22);
    expect(DEFAULT_QUIET_HOURS.start).toBe(22);
  });
});

describe("inQuietHours", () => {
  const overnight = { enabled: true, start: 22, end: 7 };

  it("is always false when disabled", () => {
    for (let h = 0; h < 24; h++) {
      expect(inQuietHours(h, { ...overnight, enabled: false })).toBe(false);
    }
  });

  it("covers an overnight wrap on both sides of midnight", () => {
    const quiet = [22, 23, 0, 1, 2, 3, 4, 5, 6];
    for (let h = 0; h < 24; h++) {
      expect(inQuietHours(h, overnight)).toBe(quiet.includes(h));
    }
  });

  it("treats start as inclusive and end as exclusive", () => {
    expect(inQuietHours(22, overnight)).toBe(true);
    expect(inQuietHours(7, overnight)).toBe(false);
    expect(inQuietHours(21, overnight)).toBe(false);
    expect(inQuietHours(6, overnight)).toBe(true);
  });

  it("handles a same-day window", () => {
    const daytime = { enabled: true, start: 9, end: 17 };
    expect(inQuietHours(8, daytime)).toBe(false);
    expect(inQuietHours(9, daytime)).toBe(true);
    expect(inQuietHours(16, daytime)).toBe(true);
    expect(inQuietHours(17, daytime)).toBe(false);
    expect(inQuietHours(23, daytime)).toBe(false);
  });

  it("treats a zero-length window as no quiet hours, never as all day", () => {
    for (let h = 0; h < 24; h++) {
      expect(inQuietHours(h, { enabled: true, start: 8, end: 8 })).toBe(false);
    }
  });

  it("ignores an out-of-range hour rather than guessing", () => {
    expect(inQuietHours(-1, overnight)).toBe(false);
    expect(inQuietHours(24, overnight)).toBe(false);
    expect(inQuietHours(NaN, overnight)).toBe(false);
  });
});

describe("isQuietAt", () => {
  it("goes from a raw prefs blob to a verdict", () => {
    const prefs = { quietHours: { enabled: true, start: 23, end: 5 }, other: "kept" };
    expect(isQuietAt(prefs, 23)).toBe(true);
    expect(isQuietAt(prefs, 4)).toBe(true);
    expect(isQuietAt(prefs, 12)).toBe(false);
  });

  it("never suppresses when prefs have no window (the pre-H7 default)", () => {
    expect(isQuietAt({}, 3)).toBe(false);
    expect(isQuietAt(null, 3)).toBe(false);
  });
});

describe("writeQuietHours", () => {
  it("merges without clobbering sibling prefs", () => {
    const prefs = { transitionWarnings: true, intentions: { week: "2026-07-20", items: [] } };
    const next = writeQuietHours(prefs, { enabled: true, start: 21, end: 6 });
    expect(next.transitionWarnings).toBe(true);
    expect(next.intentions).toEqual({ week: "2026-07-20", items: [] });
    expect(next.quietHours).toEqual({ enabled: true, start: 21, end: 6 });
  });

  it("does not mutate the input blob", () => {
    const prefs: Record<string, unknown> = {};
    writeQuietHours(prefs, { enabled: true, start: 1, end: 2 });
    expect(prefs).toEqual({});
  });

  it("normalizes hours on the way in", () => {
    const next = writeQuietHours(null, { enabled: true, start: 99, end: 6 });
    expect(next.quietHours).toEqual({ enabled: true, start: 22, end: 6 });
  });

  it("round-trips through parseQuietHours", () => {
    const qh = { enabled: true, start: 20, end: 9 };
    expect(parseQuietHours(writeQuietHours({}, qh))).toEqual(qh);
  });
});

describe("quietWindowHours", () => {
  it("measures same-day and overnight windows", () => {
    expect(quietWindowHours({ enabled: true, start: 9, end: 17 })).toBe(8);
    expect(quietWindowHours({ enabled: true, start: 22, end: 7 })).toBe(9);
    expect(quietWindowHours({ enabled: true, start: 23, end: 0 })).toBe(1);
  });

  it("is zero when disabled or zero-length", () => {
    expect(quietWindowHours({ enabled: false, start: 22, end: 7 })).toBe(0);
    expect(quietWindowHours({ enabled: true, start: 7, end: 7 })).toBe(0);
  });
});

describe("formatQuietHour", () => {
  it("formats 12-hour with noon and midnight as 12", () => {
    expect(formatQuietHour(0, "h12")).toBe("12 AM");
    expect(formatQuietHour(12, "h12")).toBe("12 PM");
    expect(formatQuietHour(7, "h12")).toBe("7 AM");
    expect(formatQuietHour(22, "h12")).toBe("10 PM");
  });

  it("formats 24-hour zero-padded", () => {
    expect(formatQuietHour(0, "h24")).toBe("00:00");
    expect(formatQuietHour(7, "h24")).toBe("07:00");
    expect(formatQuietHour(22, "h24")).toBe("22:00");
  });
});

describe("describeQuietHours", () => {
  it("describes an active window in the user's hour cycle", () => {
    expect(describeQuietHours({ enabled: true, start: 22, end: 7 }, "h12")).toBe(
      "No reminders 10 PM–7 AM — rest undisturbed",
    );
    expect(describeQuietHours({ enabled: true, start: 22, end: 7 }, "h24")).toBe(
      "No reminders 22:00–07:00 — rest undisturbed",
    );
  });

  it("says reminders are open when off or zero-length", () => {
    expect(describeQuietHours({ enabled: false, start: 22, end: 7 })).toBe(
      "Reminders can arrive any time",
    );
    expect(describeQuietHours({ enabled: true, start: 7, end: 7 })).toBe(
      "Reminders can arrive any time",
    );
  });

  it("never phrases anything as a failure or a warning", () => {
    const copy = [
      describeQuietHours({ enabled: true, start: 22, end: 7 }),
      describeQuietHours({ enabled: false, start: 22, end: 7 }),
    ].join(" ");
    expect(copy).not.toMatch(/error|failed|cannot|must|warning/i);
  });
});
