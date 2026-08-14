/**
 * Pure unit tests for the ADR-001 edit-scope patch whitelists —
 * pickSeriesPatch / pickOccurrencePatch. These are the security-relevant
 * gate that stops arbitrary client fields (id, userId, revision, ...) from
 * being written via editScope=all / this_and_future / this. No DB needed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteSeriesOccurrence,
  editSeriesOccurrence,
  pickSeriesPatch,
  pickOccurrencePatch,
} from "./recurrence";
import {
  createEphemeralDb,
  insertUser,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "../db/test-db";
import {
  createActivitySeries,
  deleteActivitySeries,
  listActivitySeries,
  listUserOccurrences,
} from "../dal";
import { expandActivitiesForDay } from "./day";
import { resolveDayBounds } from "../temporal/zone";

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

/* ---------------------------------------------------------------------------
 * Edit-scope regression pins (Phase 1.2).
 *
 * The activity editor used to write `editScope: "all"` for every save and
 * delete, so renaming or deleting ONE day of a repeating activity silently
 * rewrote every other day. These pins assert the ADR-001 blast radius at the
 * day level — expand the series into each day and check which days moved.
 * Forcing the handler back to `all` makes every one of them fail.
 * ------------------------------------------------------------------------- */

let scopeEnv: EphemeralDb | null = null;
let scopeDbAvailable = false;
let scopeUserId: string;

const ZONE = "America/New_York";
/** 10:00 local on each of these days (no DST boundary inside the window). */
const DAYS = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17"] as const;
/** 2026-09-14T10:00 America/New_York === 14:00Z (EDT, UTC-4). */
const at10 = (day: string) => new Date(`${day}T14:00:00.000Z`);

beforeAll(async () => {
  try {
    scopeEnv = await createEphemeralDb();
    scopeDbAvailable = true;
    scopeUserId = crypto.randomUUID();
    await insertUser(scopeEnv.db, scopeUserId, "edit-scope@test.com");
  } catch (e) {
    rethrowIfMigrationFailure(e);
    scopeDbAvailable = false;
  }
}, 60000);

afterAll(async () => {
  if (scopeEnv) await scopeEnv.teardown();
}, 60000);

const itScope = (name: string, fn: () => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    if (!scopeDbAvailable || !scopeEnv) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn();
  });

/** All activity titles on a day, whatever series they came from. */
async function allTitlesOn(day: string): Promise<string[]> {
  const [seriesList, occurrences] = await Promise.all([
    listActivitySeries(scopeUserId, { db: scopeEnv!.db }),
    listUserOccurrences(scopeUserId, { db: scopeEnv!.db }),
  ]);
  const bounds = resolveDayBounds(day, ZONE);
  return expandActivitiesForDay(seriesList, occurrences, bounds).map((a) => a.title);
}

async function dailySeries(title: string) {
  return createActivitySeries(
    scopeUserId,
    {
      tz: ZONE,
      dtstartLocal: at10(DAYS[0]),
      rrule: "FREQ=DAILY;COUNT=8",
      title,
      durationMin: 30,
    },
    { db: scopeEnv!.db },
  );
}

describe("edit-scope blast radius (ADR-001) — editor regression pins", () => {
  itScope("editScope=this renames ONLY the edited day", async () => {
    const series = await dailySeries("Scope pin this");

    await editSeriesOccurrence(
      scopeUserId,
      series.id,
      at10(DAYS[1]),
      "this",
      { title: "Scope pin this (edited)" },
      series.revision,
      { db: scopeEnv!.db },
    );

    expect(await allTitlesOn(DAYS[1])).toContain("Scope pin this (edited)");
    // Every other day is untouched — the whole point of the fix.
    expect(await allTitlesOn(DAYS[0])).toContain("Scope pin this");
    expect(await allTitlesOn(DAYS[0])).not.toContain("Scope pin this (edited)");
    expect(await allTitlesOn(DAYS[2])).toContain("Scope pin this");
    expect(await allTitlesOn(DAYS[2])).not.toContain("Scope pin this (edited)");
  });

  itScope(
    "editScope=this_and_future renames the split day and everything after it",
    async () => {
      const series = await dailySeries("Scope pin future");

      await editSeriesOccurrence(
        scopeUserId,
        series.id,
        at10(DAYS[2]),
        "this_and_future",
        { title: "Scope pin future (edited)" },
        series.revision,
        { db: scopeEnv!.db },
      );

      // Before the split: the original series still generates the old title.
      expect(await allTitlesOn(DAYS[0])).toContain("Scope pin future");
      expect(await allTitlesOn(DAYS[0])).not.toContain("Scope pin future (edited)");
      expect(await allTitlesOn(DAYS[1])).toContain("Scope pin future");
      expect(await allTitlesOn(DAYS[1])).not.toContain("Scope pin future (edited)");
      // At and after the split: only the successor series.
      expect(await allTitlesOn(DAYS[2])).toContain("Scope pin future (edited)");
      expect(await allTitlesOn(DAYS[2])).not.toContain("Scope pin future");
      expect(await allTitlesOn(DAYS[3])).toContain("Scope pin future (edited)");
      expect(await allTitlesOn(DAYS[3])).not.toContain("Scope pin future");
    },
  );

  itScope("delete editScope=this removes ONLY that day; delete all removes every day", async () => {
    const series = await dailySeries("Scope pin delete");

    await deleteSeriesOccurrence(
      scopeUserId,
      series.id,
      at10(DAYS[1]),
      "this",
      series.revision,
      { db: scopeEnv!.db },
    );

    expect(await allTitlesOn(DAYS[1])).not.toContain("Scope pin delete");
    expect(await allTitlesOn(DAYS[0])).toContain("Scope pin delete");
    expect(await allTitlesOn(DAYS[2])).toContain("Scope pin delete");
    expect(await allTitlesOn(DAYS[3])).toContain("Scope pin delete");

    const [current] = (
      await listActivitySeries(scopeUserId, { db: scopeEnv!.db })
    ).filter((s) => s.id === series.id);
    await deleteActivitySeries(scopeUserId, series.id, current!.revision, {
      db: scopeEnv!.db,
    });

    for (const day of DAYS) {
      expect(await allTitlesOn(day)).not.toContain("Scope pin delete");
    }
  });
});
