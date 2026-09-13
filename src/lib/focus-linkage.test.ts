import { describe, expect, it, vi } from "vitest";
import {
  adoptFocusLinkage,
  canMarkOccurrenceDone,
  completeLinkedOccurrence,
  focusHrefFromActivity,
  focusStartBody,
  focusStartFingerprint,
  markDoneErrorMessage,
  pairedFocusSelector,
} from "./focus-linkage";

const SERIES = "01980000-7000-8000-8000-000000000010";
const KEY = "2026-09-13T13:00:00.000Z";

describe("pairedFocusSelector", () => {
  it("requires both halves and a UUID series id", () => {
    expect(pairedFocusSelector(SERIES, KEY)).toEqual({
      activitySeriesId: SERIES,
      occurrenceKey: KEY,
    });
    expect(pairedFocusSelector(SERIES, undefined)).toBeNull();
    expect(pairedFocusSelector(undefined, KEY)).toBeNull();
    expect(pairedFocusSelector("not-a-uuid", KEY)).toBeNull();
    expect(pairedFocusSelector(` ${SERIES} `, ` ${KEY} `)).toEqual({
      activitySeriesId: SERIES,
      occurrenceKey: KEY,
    });
  });
});

describe("focusStartBody + fingerprint", () => {
  it("omits an incomplete pair so the server is not sent a 400 selector", () => {
    expect(
      focusStartBody({
        targetDurationMin: 25,
        title: "Deep work",
        emoji: "🎯",
        activitySeriesId: SERIES,
      }),
    ).toEqual({
      targetDurationMin: 25,
      title: "Deep work",
      emoji: "🎯",
    });
  });

  it("includes the paired selector and fingerprints it", () => {
    const body = focusStartBody({
      targetDurationMin: 25,
      title: "Deep work",
      emoji: "🎯",
      activitySeriesId: SERIES,
      occurrenceKey: KEY,
    });
    expect(body).toEqual({
      targetDurationMin: 25,
      title: "Deep work",
      emoji: "🎯",
      activitySeriesId: SERIES,
      occurrenceKey: KEY,
    });
    const same = focusStartFingerprint(body);
    const other = focusStartFingerprint({
      ...body,
      occurrenceKey: "2026-09-14T13:00:00.000Z",
    });
    expect(same).toContain(SERIES);
    expect(same).toContain(KEY);
    expect(same).not.toBe(other);
  });

  it("leaves ad-hoc starts without a fabricated activity association", () => {
    const body = focusStartBody({
      targetDurationMin: 15,
      title: "Quick win",
      emoji: "⚡",
    });
    expect(body.activitySeriesId).toBeUndefined();
    expect(body.occurrenceKey).toBeUndefined();
  });
});

describe("adoptFocusLinkage", () => {
  it("recovers the linked occurrence from server state", () => {
    expect(
      adoptFocusLinkage({
        activityOccurrenceId: "01980000-7000-8000-8000-000000000011",
        activitySeriesId: SERIES,
        occurrenceKey: KEY,
      }),
    ).toEqual({
      activityOccurrenceId: "01980000-7000-8000-8000-000000000011",
      activitySeriesId: SERIES,
      occurrenceKey: KEY,
    });
  });

  it("does not invent a link for an ad-hoc session", () => {
    expect(
      adoptFocusLinkage({
        activityOccurrenceId: null,
        activitySeriesId: null,
        occurrenceKey: null,
      }),
    ).toBeNull();
    expect(canMarkOccurrenceDone(null)).toBe(false);
  });
});

describe("focusHrefFromActivity", () => {
  it("carries series id and occurrence key from Today-style entry points", () => {
    expect(
      focusHrefFromActivity({
        title: "Lunch",
        emoji: "🍜",
        durationMin: 45,
        activityId: SERIES,
        occurrenceKey: KEY,
      }),
    ).toBe(
      `/app/focus?title=Lunch&emoji=%F0%9F%8D%9C&duration=45&activityId=${SERIES}&occurrenceKey=${encodeURIComponent(KEY)}`,
    );
  });
});

describe("completeLinkedOccurrence", () => {
  it("refuses to complete without a paired identity", async () => {
    const fetchFn = vi.fn();
    const result = await completeLinkedOccurrence({
      activitySeriesId: SERIES,
      fetchFn,
    });
    expect(result).toEqual({
      ok: false,
      reason: "missing-identity",
      retryable: false,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("retries a stale revision and celebrates only the confirmed write", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (!init?.method || init.method === "GET") {
        const revision = fetchFn.mock.calls.filter(
          (call) => !call[1]?.method || call[1].method === "GET",
        ).length;
        return new Response(JSON.stringify({ revision }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const match = init.headers && (init.headers as Record<string, string>)["If-Match"];
      if (match === "1") {
        return new Response(JSON.stringify({ error: { code: "conflict" } }), {
          status: 409,
        });
      }
      const body = JSON.parse(String(init.body)) as {
        occurrenceKey: string;
        status: string;
        editScope: string;
      };
      expect(body).toMatchObject({
        editScope: "this",
        occurrenceKey: KEY,
        status: "completed",
      });
      expect(url).toBe(`/api/v1/activities/${SERIES}`);
      return new Response(JSON.stringify({ revision: 3 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const keys = ["key-a", "key-b"];
    const result = await completeLinkedOccurrence({
      activitySeriesId: SERIES,
      occurrenceKey: KEY,
      fetchFn,
      uuid: () => keys.shift() ?? "overflow",
    });
    expect(result).toEqual({ ok: true, revision: 3 });
    const patches = fetchFn.mock.calls.filter((call) => call[1]?.method === "PATCH");
    expect(patches).toHaveLength(2);
    expect((patches[0]![1]!.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-a");
    expect((patches[1]![1]!.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-b");
  });

  it("does not complete a different occurrence when the source is gone", async () => {
    const fetchFn = vi.fn(async () => new Response("missing", { status: 404 }));
    const result = await completeLinkedOccurrence({
      activitySeriesId: SERIES,
      occurrenceKey: KEY,
      fetchFn,
    });
    expect(result).toEqual({
      ok: false,
      reason: "not-found",
      retryable: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(markDoneErrorMessage(result)).toContain("nothing else was marked done");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("keeps identity and stays retryable after a network failure", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await completeLinkedOccurrence({
      activitySeriesId: SERIES,
      occurrenceKey: KEY,
      fetchFn,
    });
    expect(result).toEqual({ ok: false, reason: "network", retryable: true });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(markDoneErrorMessage(result)).toContain("try again");
  });
});
