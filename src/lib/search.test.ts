import { describe, it, expect } from "vitest";
import {
  normalizeQuery,
  scoreCandidate,
  searchCandidates,
  searchDateLabel,
  type SearchCandidate,
} from "./search";

const TODAY = "2026-07-24";

function activity(
  title: string,
  extra: Partial<SearchCandidate> = {},
): SearchCandidate {
  return { id: title, kind: "activity", title, date: TODAY, startMin: 600, ...extra };
}

describe("normalizeQuery", () => {
  it("casefolds, trims, and collapses whitespace", () => {
    expect(normalizeQuery("  Deep   WORK  ")).toBe("deep work");
  });

  it("strips accents so 'cafe' finds 'café'", () => {
    expect(normalizeQuery("Café")).toBe("cafe");
    expect(normalizeQuery("réunion")).toBe("reunion");
  });

  it("handles an empty string", () => {
    expect(normalizeQuery("")).toBe("");
    expect(normalizeQuery("   ")).toBe("");
  });
});

describe("scoreCandidate", () => {
  const c = activity("Deep work — Kairo", { notes: "ship the search endpoint" });

  it("ranks exact > prefix > word-prefix > substring > notes", () => {
    const exact = scoreCandidate(activity("focus"), "focus")!.score;
    const prefix = scoreCandidate(activity("focus block"), "focus")!.score;
    const wordPrefix = scoreCandidate(activity("deep focus"), "focus")!.score;
    const substring = scoreCandidate(activity("refocusing"), "focus")!.score;
    const notes = scoreCandidate(activity("nothing", { notes: "focus" }), "focus")!.score;
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(wordPrefix);
    expect(wordPrefix).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(notes);
  });

  it("reports which field matched", () => {
    expect(scoreCandidate(c, "deep")!.matchedOn).toBe("title");
    expect(scoreCandidate(c, "endpoint")!.matchedOn).toBe("notes");
  });

  it("returns null for no match and for an empty query", () => {
    expect(scoreCandidate(c, "zzz")).toBeNull();
    expect(scoreCandidate(c, "")).toBeNull();
  });

  it("tolerates missing title/notes", () => {
    expect(scoreCandidate({ id: "x", kind: "task", title: "" }, "a")).toBeNull();
    expect(
      scoreCandidate({ id: "x", kind: "task", title: "a", notes: null }, "a"),
    ).not.toBeNull();
  });
});

describe("searchCandidates", () => {
  it("returns nothing for a blank query", () => {
    expect(searchCandidates([activity("anything")], "", { today: TODAY })).toEqual([]);
    expect(searchCandidates([activity("anything")], "   ", { today: TODAY })).toEqual([]);
  });

  it("puts a title match ahead of a notes match", () => {
    const hits = searchCandidates(
      [
        activity("Grocery run", { notes: "buy oat milk" }),
        activity("Oat milk order", {}),
      ],
      "oat",
      { today: TODAY },
    );
    expect(hits.map((h) => h.title)).toEqual(["Oat milk order", "Grocery run"]);
  });

  it("breaks ties toward the nearer date", () => {
    const hits = searchCandidates(
      [
        activity("Standup", { id: "far", date: "2026-08-24" }),
        activity("Standup", { id: "near", date: "2026-07-25" }),
        activity("Standup", { id: "today", date: TODAY }),
      ],
      "standup",
      { today: TODAY },
    );
    expect(hits.map((h) => h.id)).toEqual(["today", "near", "far"]);
  });

  it("never lets date proximity outrank a better field match", () => {
    // A note match today must still lose to a title match a month out.
    const hits = searchCandidates(
      [
        activity("Errands", { id: "notes-today", date: TODAY, notes: "dentist" }),
        activity("Dentist", { id: "title-far", date: "2026-09-01" }),
      ],
      "dentist",
      { today: TODAY },
    );
    expect(hits[0].id).toBe("title-far");
  });

  it("includes undated items (inbox tasks) without crashing", () => {
    const hits = searchCandidates(
      [{ id: "t1", kind: "task", title: "Call the pharmacy", date: null }],
      "pharmacy",
      { today: TODAY },
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].date).toBeNull();
  });

  it("caps at the limit", () => {
    const many = Array.from({ length: 40 }, (_, i) => activity(`Task ${i}`));
    expect(searchCandidates(many, "task", { today: TODAY, limit: 5 })).toHaveLength(5);
    expect(searchCandidates(many, "task", { today: TODAY, limit: 0 })).toHaveLength(0);
  });

  it("defaults the limit to 25", () => {
    const many = Array.from({ length: 40 }, (_, i) => activity(`Task ${i}`));
    expect(searchCandidates(many, "task", { today: TODAY })).toHaveLength(25);
  });

  it("is deterministic — the same query twice gives the same order", () => {
    const items = [
      activity("Review", { id: "b", startMin: 900 }),
      activity("Review", { id: "a", startMin: 540 }),
      activity("Review notes", { id: "c" }),
    ];
    const first = searchCandidates(items, "review", { today: TODAY }).map((h) => h.id);
    const second = searchCandidates([...items].reverse(), "review", { today: TODAY }).map(
      (h) => h.id,
    );
    expect(first).toEqual(second);
  });

  it("matches accent-insensitively in both directions", () => {
    const hits = searchCandidates([activity("Café break")], "cafe", { today: TODAY });
    expect(hits).toHaveLength(1);
    const back = searchCandidates([activity("Cafe break")], "café", { today: TODAY });
    expect(back).toHaveLength(1);
  });

  it("tolerates a malformed date rather than throwing", () => {
    const hits = searchCandidates([activity("Thing", { date: "not-a-date" })], "thing", {
      today: TODAY,
    });
    expect(hits).toHaveLength(1);
  });
});

describe("searchDateLabel", () => {
  it("names the near days", () => {
    expect(searchDateLabel(TODAY, TODAY)).toBe("Today");
    expect(searchDateLabel("2026-07-25", TODAY)).toBe("Tomorrow");
    expect(searchDateLabel("2026-07-23", TODAY)).toBe("Yesterday");
  });

  it("says Anytime for an undated item", () => {
    expect(searchDateLabel(null, TODAY)).toBe("Anytime");
    expect(searchDateLabel(undefined, TODAY)).toBe("Anytime");
  });

  it("formats a further-out date without a year", () => {
    expect(searchDateLabel("2026-08-15", TODAY)).toBe("Sat, Aug 15");
  });

  it("returns the raw value for something unparseable", () => {
    expect(searchDateLabel("nope", TODAY)).toBe("nope");
  });
});
