import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("iOS focus linkage (source pins; Swift compile is native-contract)", () => {
  const api = read("ios/App/API/KairoAPI.swift");
  const focus = read("ios/App/Features/Focus/FocusView.swift");
  const adapters = read("ios/App/API/GeneratedAPIAdapters.swift");
  const models = read("ios/App/API/Models.swift");
  const today = read("ios/App/Features/Today/TodayView.swift");

  it("startFocus accepts the paired selector and a caller-owned key", () => {
    const start = api.slice(api.indexOf("func startFocus("));
    expect(start).toContain("activitySeriesId: String? = nil");
    expect(start).toContain("occurrenceKey: String? = nil");
    expect(start).toContain("idempotencyKey: String? = nil");
    expect(start).toContain("activitySeriesId: pairedSeries");
    expect(start).toContain("occurrenceKey: pairedKey");
  });

  it("FocusView sends the Today identity and adopts server state", () => {
    expect(today).toContain('"occurrenceKey"');
    expect(focus).toContain("activitySeriesId: linkedActivityId");
    expect(focus).toContain("occurrenceKey: linkedOccurrenceKey");
    expect(focus).toContain("idempotencyKey: startAttemptKey");
    expect(focus).toContain("adoptSessionIdentity");
    expect(focus).toContain("func markLinkedDone");
    expect(focus).toContain("Mark done");
    expect(focus).toContain("nothing else was marked done");
  });

  it("snapshot adapters and models carry additive identity", () => {
    expect(adapters).toContain("activitySeriesId: $0.activitySeriesId");
    expect(adapters).toContain("occurrenceKey: $0.occurrenceKey");
    expect(models).toContain("let activitySeriesId: String?");
    expect(models).toContain("let occurrenceKey: Date?");
  });
});
