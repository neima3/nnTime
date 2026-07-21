/**
 * Pure unit tests for the built-in templates service (Phase 5D).
 * No DB — listTemplates/getTemplate operate on a static in-memory array.
 */
import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES, listTemplates, getTemplate } from "./templates";

describe("BUILTIN_TEMPLATES", () => {
  it("has stable, unique ids", () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("every template has a positive minutes total and version", () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(t.minutes).toBeGreaterThan(0);
      expect(t.version).toBeGreaterThanOrEqual(1);
      expect(t.steps.length).toBeGreaterThan(0);
    }
  });
});

describe("listTemplates", () => {
  it("returns all templates when no filter is given", () => {
    expect(listTemplates()).toEqual(BUILTIN_TEMPLATES);
    expect(listTemplates({})).toEqual(BUILTIN_TEMPLATES);
  });

  it("filters by group", () => {
    const work = listTemplates({ group: "Work" });
    expect(work.length).toBeGreaterThan(0);
    expect(work.every((t) => t.group === "Work")).toBe(true);
    // Sanity: fewer than the full set (there are multiple groups).
    expect(work.length).toBeLessThan(BUILTIN_TEMPLATES.length);
  });

  it("returns an empty array for an unknown group", () => {
    expect(listTemplates({ group: "Nonexistent Group" })).toEqual([]);
  });
});

describe("getTemplate", () => {
  it("finds a known template by id", () => {
    const t = getTemplate("tpl_morning_gentle");
    expect(t?.title).toBe("Gentle morning");
  });

  it("returns undefined for an unknown id", () => {
    expect(getTemplate("tpl_does_not_exist")).toBeUndefined();
  });

  it("returns undefined for an empty id", () => {
    expect(getTemplate("")).toBeUndefined();
  });
});
