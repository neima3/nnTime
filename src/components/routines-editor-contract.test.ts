import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createdRoutineToView,
  routineToEditorDefaults,
} from "@/lib/routine-editor-defaults";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

function between(contents: string, start: string, end: string): string {
  return contents.slice(contents.indexOf(start), contents.indexOf(end));
}

describe("Routine → editor adoption", () => {
  it("Use today carries routineId into the editor", () => {
    const client = source("./RoutinesClient.tsx");
    const scheduleToday = between(
      client,
      "const scheduleToday = useCallback",
      "Use today",
    );
    expect(scheduleToday).toContain("routineId: r.id");
    expect(scheduleToday).toContain("date: clientToday()");
    expect(scheduleToday).toContain("start: String(8 * 60)");
  });

  it("editor page loads the routine and its steps", () => {
    const page = source("../app/app/editor/page.tsx");
    expect(page).toContain("const routineId = typeof sp.routineId === \"string\" ? sp.routineId : undefined");
    expect(page).toContain("getRoutine(session.userId, routineId)");
    expect(page).toContain("listRoutineSteps(session.userId, routine.id)");
    expect(page).toContain("routineToEditorDefaults(routine, routineSteps)");
    expect(page).toContain("initialDurationMin={routineDefaults?.initialDurationMin}");
  });

  it("create() prepends the created routine and always clears busy", () => {
    const client = source("./RoutinesClient.tsx");
    const create = between(
      client,
      "const create = useCallback",
      "const togglePause = useCallback",
    );
    expect(create).toContain("createdRoutineToView(created, steps)");
    expect(create).toContain("Couldn't reach the server — try again?");
    expect(create).toContain("finally {");
    expect(create).toContain("setBusy(false)");
    expect(client).toContain("if (initial !== prevInitial)");
  });
});

describe("routineToEditorDefaults", () => {
  it("maps steps to editor checklist and sums duration", () => {
    expect(
      routineToEditorDefaults(
        { title: "Morning reset", emoji: "☀️" },
        [
          { title: "Water", durationMin: 5 },
          { title: "Stretch", durationMin: 10 },
        ],
      ),
    ).toEqual({
      initialTitle: "Morning reset",
      initialEmoji: "☀️",
      initialSteps: [
        { label: "Water", done: false },
        { label: "Stretch", done: false },
      ],
      initialDurationMin: 15,
    });
  });

  it("drops a null emoji and a zero duration so the editor keeps its defaults", () => {
    expect(
      routineToEditorDefaults({ title: "Empty", emoji: null }, []),
    ).toEqual({
      initialTitle: "Empty",
      initialEmoji: undefined,
      initialSteps: [],
      initialDurationMin: undefined,
    });
  });
});

describe("createdRoutineToView", () => {
  it("maps a create response onto the routines list card", () => {
    expect(
      createdRoutineToView(
        { id: "r1", title: "Wind down", emoji: "🌙", revision: 1 },
        [
          { title: "Lights", durationMin: 10 },
          { title: "Read", durationMin: 20 },
        ],
      ),
    ).toEqual({
      id: "r1",
      title: "Wind down",
      emoji: "🌙",
      stepCount: 2,
      totalMin: 30,
      revision: 1,
      paused: false,
      scheduleId: undefined,
      scheduleRevision: undefined,
      rruleLabel: "Daily",
    });
  });
});
