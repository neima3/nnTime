import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { auditGlanceSurfaceContract } from "../scripts/ios-glance-surface-contract";

const root = process.cwd();

describe("iOS glance surface contract", () => {
  it("keeps the widget target read-only and isolated from authenticated transport", () => {
    const result = auditGlanceSurfaceContract(root);

    expect(result.failures).toEqual([]);
    expect(result.widgetFamilies).toEqual([
      "systemSmall",
      "systemMedium",
      "systemLarge",
      "accessoryCircular",
      "accessoryRectangular",
      "accessoryInline",
    ]);
    expect(result.deepLinks).toEqual(
      expect.arrayContaining(["kairo://today", "kairo://focus"]),
    );
  });

  it("detects an extension mutation or transport regression", () => {
    const project = readFileSync(resolve(root, "ios/project.yml"), "utf8");
    const widget = readFileSync(
      resolve(root, "ios/Widget/KairoWidget.swift"),
      "utf8",
    );
    const liveActivity = readFileSync(
      resolve(root, "ios/Widget/FocusLiveActivity.swift"),
      "utf8",
    );
    const app = readFileSync(resolve(root, "ios/App/KairoApp.swift"), "utf8");
    const today = readFileSync(
      resolve(root, "ios/App/Features/Today/TodayView.swift"),
      "utf8",
    );

    const result = auditGlanceSurfaceContract(root, {
      project,
      widget: `${widget}\nstruct CompleteIntent: AppIntent {}`,
      liveActivity: `${liveActivity}\nlet session = URLSession.shared`,
      app,
      today,
    });

    expect(result.failures).toEqual(
      expect.arrayContaining([
        "Widget sources must not declare AppIntent mutations",
        "Widget sources must not create network sessions",
      ]),
    );
  });
});
