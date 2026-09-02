import { describe, expect, it } from "vitest";
import { routineToEditorDefaults } from "./routine-editor-defaults";

describe("routineToEditorDefaults", () => {
  it("is the helper the editor page uses to hydrate from a routine", () => {
    const defaults = routineToEditorDefaults(
      { title: "Gym block", emoji: "🏋️" },
      [{ title: "Warm up", durationMin: 8 }, { title: "Lift", durationMin: 22 }],
    );
    expect(defaults.initialTitle).toBe("Gym block");
    expect(defaults.initialSteps.map((step) => step.label)).toEqual([
      "Warm up",
      "Lift",
    ]);
    expect(defaults.initialDurationMin).toBe(30);
  });
});
