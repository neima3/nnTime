import { describe, expect, it } from "vitest";
import { buildChecklistTemplate, normalizeEditorSteps } from "./activity-editor-steps";

describe("activity editor checklist payload", () => {
  it("preserves completed source-task steps", () => {
    const steps = normalizeEditorSteps([
      { label: "Already done", done: true },
      { label: "Still open", done: false },
    ]);

    expect(buildChecklistTemplate(steps)).toEqual([
      { label: "Already done", done: true },
      { label: "Still open", done: false },
    ]);
  });

  it("keeps an explicit remove-all as an empty array", () => {
    expect(buildChecklistTemplate([])).toEqual([]);
  });
});
