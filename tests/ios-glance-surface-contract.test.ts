import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { auditGlanceSurfaceContract } from "../scripts/ios-glance-surface-contract";

const root = process.cwd();

describe("iOS glance surface contract", () => {
  it("keeps widget writes on the network-first session bridge (R38)", () => {
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

  it("detects transport or inline-intent regressions in widget UI", () => {
    const widget = readFileSync(
      resolve(root, "ios/Widget/KairoWidget.swift"),
      "utf8",
    );
    const liveActivity = readFileSync(
      resolve(root, "ios/Widget/FocusLiveActivity.swift"),
      "utf8",
    );

    const result = auditGlanceSurfaceContract(root, {
      widget: `${widget}\nstruct RogueIntent: AppIntent {}`,
      liveActivity: `${liveActivity}\nlet session = URLSession.shared`,
    });

    expect(result.failures).toEqual(
      expect.arrayContaining([
        "Widget UI sources must not declare inline App Intents",
        "Widget sources must not create network sessions",
      ]),
    );
  });

  it("detects a widget button bypassing the audited intents", () => {
    const widget = readFileSync(
      resolve(root, "ios/Widget/KairoWidget.swift"),
      "utf8",
    );

    const result = auditGlanceSurfaceContract(root, {
      widget: `${widget}\nlet rogue = Button(intent: SomeOtherIntent()) {}`,
    });

    expect(result.failures).toEqual(
      expect.arrayContaining([
        "Widget intent buttons must all route through audited intents",
      ]),
    );
  });

  it("detects the Live Activity losing its focus controls", () => {
    const liveActivity = readFileSync(
      resolve(root, "ios/Widget/FocusLiveActivity.swift"),
      "utf8",
    );

    const result = auditGlanceSurfaceContract(root, {
      liveActivity: liveActivity.replaceAll(
        /Button\(intent: (?:ToggleFocusIntent|CompleteFocusIntent)\(/g,
        "Button(action: {})(",
      ),
    });

    expect(result.failures).toEqual(
      expect.arrayContaining([
        "Focus Live Activity must ship pause and complete controls (H04)",
      ]),
    );
  });

  it("detects focus intents leaving the app-process bridge", () => {
    const focusIntents = readFileSync(
      resolve(root, "ios/Shared/FocusIntents.swift"),
      "utf8",
    );

    const result = auditGlanceSurfaceContract(root, {
      focusIntents: focusIntents
        .replaceAll(": LiveActivityIntent", ": AppIntent")
        .replaceAll("FocusIntentBridge.dispatch(", "directCall("),
    });

    expect(result.failures).toEqual(
      expect.arrayContaining([
        "Focus intents must be LiveActivityIntents (app-process)",
        "Focus intents must dispatch through FocusIntentBridge",
      ]),
    );
  });

  it("detects an optimistic-cache regression in the completion service", () => {
    const service = readFileSync(
      resolve(root, "ios/Shared/WidgetCompletion.swift"),
      "utf8",
    );
    // Move a cache write ahead of the status gate — the exact failure mode
    // H03 was withheld over.
    const optimistic = service.replace(
      "let (data, response) = try await session.data(for: request)",
      [
        "_ = try cacheStore.updateStatus(",
        "    scope: scope, date: snapshot.date, activityID: activityID,",
        "    occurrenceKey: occurrenceKey, done: done)",
        "let (data, response) = try await session.data(for: request)",
      ].join("\n        "),
    );

    const result = auditGlanceSurfaceContract(root, {
      widgetCompletion: optimistic,
    });

    expect(result.failures).toEqual(
      expect.arrayContaining([
        "Widget completion must update the cache only after the 2xx gate",
      ]),
    );
  });
});
