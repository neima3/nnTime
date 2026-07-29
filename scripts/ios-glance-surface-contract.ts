import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type ContractSources = {
  project: string;
  widget: string;
  liveActivity: string;
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
  };
  const failures: string[] = [];
  const extensionSource = `${sources.widget}\n${sources.liveActivity}`;

  for (const [pattern, failure] of forbiddenSourcePatterns) {
    if (pattern.test(extensionSource)) failures.push(failure);
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
