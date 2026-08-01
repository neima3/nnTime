import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type ContractSources = {
  project: string;
  widget: string;
  liveActivity: string;
  completeIntent: string;
  focusIntents: string;
  widgetCompletion: string;
  sessionEnvelope: string;
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

// R38 replaced "the widget is read-only" with "the widget writes only through
// the network-first bridge". Widget UI sources still may not own transport,
// keychain access, or inline intent declarations — those live in the
// dedicated intent + shared service files audited below.
const forbiddenUiPatterns: Array<[RegExp, string]> = [
  [
    /:\s*AppIntent\b/,
    "Widget UI sources must not declare inline App Intents",
  ],
  [/\bURLSession\b/, "Widget sources must not create network sessions"],
  [
    /\bKairoAPIClient\b/,
    "Widget sources must not import the generated API client",
  ],
  [
    /\bSecItem(?:Add|CopyMatching|Delete|Update)\b/,
    "Widget sources must not access Keychain directly",
  ],
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
    completeIntent:
      overrides.completeIntent ??
      readFileSync(
        resolve(root, "ios/Widget/CompleteBlockIntent.swift"),
        "utf8",
      ),
    focusIntents:
      overrides.focusIntents ??
      readFileSync(resolve(root, "ios/Shared/FocusIntents.swift"), "utf8"),
    widgetCompletion:
      overrides.widgetCompletion ??
      readFileSync(
        resolve(root, "ios/Shared/WidgetCompletion.swift"),
        "utf8",
      ),
    sessionEnvelope:
      overrides.sessionEnvelope ??
      readFileSync(
        resolve(root, "ios/Shared/SessionEnvelope.swift"),
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
  const extensionUiSource = `${sources.widget}\n${sources.liveActivity}`;

  for (const [pattern, failure] of forbiddenUiPatterns) {
    if (pattern.test(extensionUiSource)) failures.push(failure);
  }

  // Every intent button in the UI must be one of the audited intents.
  const intentButtons = (
    extensionUiSource.match(/Button\s*\(\s*intent\s*:/g) ?? []
  ).length;
  const auditedButtons = (
    extensionUiSource.match(
      /Button\s*\(\s*intent\s*:\s*(?:CompleteBlockIntent|ToggleFocusIntent|CompleteFocusIntent)\s*\(/g,
    ) ?? []
  ).length;
  if (intentButtons !== auditedButtons) {
    failures.push(
      "Widget intent buttons must all route through audited intents",
    );
  }
  const completionButtons = (
    sources.widget.match(
      /Button\s*\(\s*intent\s*:\s*CompleteBlockIntent\s*\(/g,
    ) ?? []
  ).length;
  if (completionButtons === 0) {
    failures.push("Next Up widget must ship complete-from-widget (H03)");
  }
  const focusButtons = (
    sources.liveActivity.match(
      /Button\s*\(\s*intent\s*:\s*(?:ToggleFocusIntent|CompleteFocusIntent)\s*\(/g,
    ) ?? []
  ).length;
  if (focusButtons < 2) {
    failures.push(
      "Focus Live Activity must ship pause and complete controls (H04)",
    );
  }

  // The intent itself: performs through the shared service, then reloads.
  if (!/:\s*AppIntent\b/.test(sources.completeIntent)) {
    failures.push("CompleteBlockIntent must be an AppIntent");
  }
  if (!sources.completeIntent.includes("WidgetCompletionService.live()")) {
    failures.push(
      "CompleteBlockIntent must perform through WidgetCompletionService",
    );
  }
  if (!sources.completeIntent.includes("reloadTimelines")) {
    failures.push("CompleteBlockIntent must reload the widget timelines");
  }
  if (/\bURLSession\b/.test(sources.completeIntent)) {
    failures.push("CompleteBlockIntent must not own transport");
  }

  // Focus intents run in the app process (LiveActivityIntent) and dispatch
  // through the bridge — they own no transport of their own.
  if (!/:\s*LiveActivityIntent\b/.test(sources.focusIntents)) {
    failures.push("Focus intents must be LiveActivityIntents (app-process)");
  }
  if (!sources.focusIntents.includes("FocusIntentBridge.dispatch(")) {
    failures.push("Focus intents must dispatch through FocusIntentBridge");
  }
  if (/\bURLSession\b/.test(sources.focusIntents)) {
    failures.push("Focus intents must not own transport");
  }

  // The service: session isolation, optimistic-concurrency headers, and the
  // network-first ordering — the cache write must appear after the 2xx gate.
  if (!sources.widgetCompletion.includes("httpShouldSetCookies = false")) {
    failures.push(
      "Widget completion transport must not use an ambient cookie jar",
    );
  }
  if (!sources.widgetCompletion.includes('"If-Match"')) {
    failures.push("Widget completion must send If-Match");
  }
  if (!sources.widgetCompletion.includes('"Idempotency-Key"')) {
    failures.push("Widget completion must send an idempotency key");
  }
  const statusGate = sources.widgetCompletion.indexOf("(200..<300)");
  const cacheWrite = sources.widgetCompletion.indexOf("updateStatus(");
  if (statusGate === -1 || cacheWrite === -1 || cacheWrite < statusGate) {
    failures.push(
      "Widget completion must update the cache only after the 2xx gate",
    );
  }

  // The bridge: the envelope store must pin the shared app-group access
  // group both targets already hold.
  if (
    !sources.sessionEnvelope.includes(
      'sharedAccessGroup = "group.me.neima.kairo"',
    )
  ) {
    failures.push(
      "Session envelope store must use the shared app-group keychain group",
    );
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
    extensionUiSource.matchAll(/kairo:\/\/(?:today|focus)/g),
    (match) => match[0],
  ).filter((value, index, values) => values.indexOf(value) === index);
  for (const required of ["kairo://today", "kairo://focus"]) {
    if (!deepLinks.includes(required)) {
      failures.push(`Glance surfaces must retain deep link ${required}`);
    }
  }

  return { failures, widgetFamilies, deepLinks };
}
