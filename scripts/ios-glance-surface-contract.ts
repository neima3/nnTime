import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type ContractSources = {
  project: string;
  widget: string;
  liveActivity: string;
  app: string;
  today: string;
};

type ContractResult = {
  failures: string[];
  widgetFamilies: string[];
  deepLinks: string[];
};

const supportedFamilies = [
  "systemSmall",
  "systemMedium",
  "systemLarge",
  "accessoryCircular",
  "accessoryRectangular",
  "accessoryInline",
];

const forbiddenSourcePatterns: Array<[RegExp, string]> = [
  [/\bAppIntent\b/, "Widget sources must not declare AppIntent mutations"],
  [
    /Button\s*\(\s*intent\s*:/,
    "Widget sources must not expose AppIntent buttons",
  ],
  [/\bURLSession\b/, "Widget sources must not create network sessions"],
  [
    /\bKairoAPIClient\b/,
    "Widget sources must not import the generated API client",
  ],
  [/\bSecItem(?:Add|CopyMatching|Delete|Update)\b/, "Widget sources must not access Keychain"],
];

export function auditGlanceSurfaceContract(
  root: string,
  overrides: Partial<ContractSources> = {},
): ContractResult {
  const sources: ContractSources = {
    project:
      overrides.project ??
      readFileSync(resolve(root, "ios/project.yml"), "utf8"),
    widget:
      overrides.widget ??
      readFileSync(resolve(root, "ios/Widget/KairoWidget.swift"), "utf8"),
    liveActivity:
      overrides.liveActivity ??
      readFileSync(
        resolve(root, "ios/Widget/FocusLiveActivity.swift"),
        "utf8",
      ),
    app:
      overrides.app ??
      readFileSync(resolve(root, "ios/App/KairoApp.swift"), "utf8"),
    today:
      overrides.today ??
      readFileSync(
        resolve(root, "ios/App/Features/Today/TodayView.swift"),
        "utf8",
      ),
  };
  const failures: string[] = [];
  const extensionSource = `${sources.widget}\n${sources.liveActivity}`;

  for (const [pattern, failure] of forbiddenSourcePatterns) {
    if (pattern.test(extensionSource)) failures.push(failure);
  }
  if (/String\s*\(\s*format:\s*"%d:%02d"/.test(sources.widget)) {
    failures.push("Widget time labels must use the shared clock formatter");
  }
  if (!sources.widget.includes("WidgetClock.text(")) {
    failures.push("Widget families must adopt the shared clock formatter");
  }
  if (!sources.widget.includes("WidgetSelection.state(")) {
    failures.push("Widget provider must adopt shared day selection");
  }
  if (!sources.widget.includes(".accessibilityLabel(")) {
    failures.push("Widget families must provide accessibility labels");
  }
  if (!sources.liveActivity.includes(".accessibilityLabel(")) {
    failures.push("Live Activity must provide accessibility labels");
  }

  const cacheWriters = `${sources.app}\n${sources.today}`;
  const cacheWriteCount = (
    cacheWriters.match(/DayCache\.write\s*\(/g) ?? []
  ).length;
  const hourCycleWriteCount = (
    cacheWriters.match(/hourCycle:\s*KairoPrefs\.hourCycle/g) ?? []
  ).length;
  if (cacheWriteCount === 0 || hourCycleWriteCount !== cacheWriteCount) {
    failures.push("Every app day-cache writer must persist the hour cycle");
  }
  if (!sources.app.includes("-kairoRound22GlanceFixture")) {
    failures.push("Debug app must expose the Round 22 glance fixture");
  }
  if (!sources.app.includes("installRound22GlanceFixture")) {
    failures.push("Round 22 fixture must install a synthetic shared snapshot");
  }
  if (!sources.app.includes("-kairoRound22StartLiveActivity")) {
    failures.push("Round 22 fixture must expose deterministic Live Activity QA");
  }

  const widgetTarget = sources.project.match(
    /^  KairoWidget:\n([\s\S]*?)(?=^  \S|\Z)/m,
  )?.[1];
  if (!widgetTarget?.includes("- path: Widget")) {
    failures.push("KairoWidget target must compile ios/Widget");
  }
  if (!widgetTarget?.includes("- path: Shared")) {
    failures.push("KairoWidget target must compile ios/Shared");
  }
  if (widgetTarget?.includes("KairoAPIClient")) {
    failures.push("KairoWidget target must not depend on KairoAPIClient");
  }
  if (!sources.project.includes("group.me.neima.kairo")) {
    failures.push("KairoWidget target must retain the app-group entitlement");
  }

  const widgetFamilies = supportedFamilies.filter((family) =>
    sources.widget.includes(`.${family}`),
  );
  if (widgetFamilies.length !== supportedFamilies.length) {
    failures.push("KairoWidget must support every approved widget family");
  }

  const deepLinks = Array.from(
    extensionSource.matchAll(/kairo:\/\/(?:today|focus)/g),
    (match) => match[0],
  ).filter((value, index, values) => values.indexOf(value) === index);
  for (const required of ["kairo://today", "kairo://focus"]) {
    if (!deepLinks.includes(required)) {
      failures.push(`Glance surfaces must retain deep link ${required}`);
    }
  }

  return { failures, widgetFamilies, deepLinks };
}
