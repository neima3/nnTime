#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const expectedCollectedDataTypes = [
  {
    dataType: "NSPrivacyCollectedDataTypeEmailAddress",
    linked: true,
    tracking: false,
    purposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
  },
  {
    dataType: "NSPrivacyCollectedDataTypeOtherUserContent",
    linked: true,
    tracking: false,
    purposes: [
      "NSPrivacyCollectedDataTypePurposeAppFunctionality",
      "NSPrivacyCollectedDataTypePurposeProductPersonalization",
    ],
  },
  {
    dataType: "NSPrivacyCollectedDataTypeProductInteraction",
    linked: true,
    tracking: false,
    purposes: [
      "NSPrivacyCollectedDataTypePurposeAppFunctionality",
      "NSPrivacyCollectedDataTypePurposeProductPersonalization",
    ],
  },
  {
    dataType: "NSPrivacyCollectedDataTypeUserID",
    linked: true,
    tracking: false,
    purposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
  },
];

const expectedAccessedApiTypes = [
  {
    apiType: "NSPrivacyAccessedAPICategoryUserDefaults",
    reasons: ["1C8F.1", "CA92.1"],
  },
];

export const expectedPrivacyContract = Object.freeze({
  tracking: false,
  trackingDomains: [],
  collectedDataTypes: expectedCollectedDataTypes,
  accessedApiTypes: expectedAccessedApiTypes,
});

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue).sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b)),
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function sameContract(actual, expected) {
  return JSON.stringify(stableValue(actual)) === JSON.stringify(stableValue(expected));
}

export function validateReleaseContract(contract) {
  const failures = [];

  if (contract.appBundleId !== "me.neima.kairo") {
    failures.push("App bundle ID must be me.neima.kairo");
  }
  if (contract.widgetBundleId !== "me.neima.kairo.widgets") {
    failures.push("Widget bundle ID must be me.neima.kairo.widgets");
  }
  if (!contract.marketingVersion?.trim()) {
    failures.push("Marketing version must be set");
  }
  if (!/^[1-9]\d*$/.test(contract.buildNumber ?? "")) {
    failures.push("Build number must be a positive integer");
  }
  if (!contract.appGroups?.includes("group.me.neima.kairo")) {
    failures.push("App Group group.me.neima.kairo is missing");
  }
  if (contract.hasHealthKit !== true) {
    failures.push("HealthKit entitlement is missing");
  }
  if (!contract.healthShareDescription?.trim()) {
    failures.push("NSHealthShareUsageDescription is missing");
  }
  if (!contract.healthUpdateDescription?.trim()) {
    failures.push("NSHealthUpdateUsageDescription is missing");
  }
  if (contract.gitCommitValue !== "$(KAIRO_GIT_SHA)") {
    failures.push("Info.plist must embed KairoGitCommit from $(KAIRO_GIT_SHA)");
  }
  if (contract.buildDateValue !== "$(KAIRO_BUILD_DATE)") {
    failures.push("Info.plist must embed KairoBuildDate from $(KAIRO_BUILD_DATE)");
  }

  const privacy = contract.privacy ?? {};
  if (privacy.tracking !== false) {
    failures.push("Privacy manifest must declare tracking disabled");
  }
  if ((privacy.trackingDomains ?? []).length !== 0) {
    failures.push("Privacy manifest must not declare tracking domains");
  }
  if (
    !sameContract(
      privacy.collectedDataTypes ?? [],
      expectedPrivacyContract.collectedDataTypes,
    )
  ) {
    failures.push(
      "Privacy manifest collected-data declarations do not match the approved contract",
    );
  }
  if (
    !sameContract(
      privacy.accessedApiTypes ?? [],
      expectedPrivacyContract.accessedApiTypes,
    )
  ) {
    failures.push(
      "Privacy manifest required-reason API declarations do not match the approved contract",
    );
  }

  return failures;
}

function readPlist(path) {
  return JSON.parse(
    execFileSync("plutil", ["-convert", "json", "-o", "-", path], {
      encoding: "utf8",
    }),
  );
}

function privacyContractFromPlist(plist) {
  return {
    tracking: plist.NSPrivacyTracking,
    trackingDomains: plist.NSPrivacyTrackingDomains ?? [],
    collectedDataTypes: (plist.NSPrivacyCollectedDataTypes ?? []).map((entry) => ({
      dataType: entry.NSPrivacyCollectedDataType,
      linked: entry.NSPrivacyCollectedDataTypeLinked,
      tracking: entry.NSPrivacyCollectedDataTypeTracking,
      purposes: entry.NSPrivacyCollectedDataTypePurposes ?? [],
    })),
    accessedApiTypes: (plist.NSPrivacyAccessedAPITypes ?? []).map((entry) => ({
      apiType: entry.NSPrivacyAccessedAPIType,
      reasons: entry.NSPrivacyAccessedAPITypeReasons ?? [],
    })),
  };
}

export function readRepositoryReleaseContract(
  root,
  buildNumber = process.env.KAIRO_BUILD_NUMBER,
) {
  const project = parseYaml(readFileSync(resolve(root, "ios/project.yml"), "utf8"));
  const info = readPlist(resolve(root, "ios/App/Info.plist"));
  const entitlements = readPlist(resolve(root, "ios/App/Kairo.entitlements"));
  const privacyPath = resolve(root, "ios/App/PrivacyInfo.xcprivacy");
  const privacy = existsSync(privacyPath)
    ? privacyContractFromPlist(readPlist(privacyPath))
    : undefined;
  const baseSettings = project.settings?.base ?? {};
  const appSettings = project.targets?.Kairo?.settings?.base ?? {};
  const widgetSettings = project.targets?.KairoWidget?.settings?.base ?? {};

  return {
    appBundleId: appSettings.PRODUCT_BUNDLE_IDENTIFIER,
    widgetBundleId: widgetSettings.PRODUCT_BUNDLE_IDENTIFIER,
    marketingVersion: String(baseSettings.MARKETING_VERSION ?? ""),
    buildNumber: String(
      buildNumber ??
        baseSettings.KAIRO_BUILD_NUMBER ??
        baseSettings.CURRENT_PROJECT_VERSION ??
        "",
    ),
    appGroups: entitlements["com.apple.security.application-groups"] ?? [],
    hasHealthKit: entitlements["com.apple.developer.healthkit"] === true,
    healthShareDescription: info.NSHealthShareUsageDescription,
    healthUpdateDescription: info.NSHealthUpdateUsageDescription,
    gitCommitValue: info.KairoGitCommit,
    buildDateValue: info.KairoBuildDate,
    privacy,
  };
}

export function validateRepositoryReleaseContract(
  root,
  buildNumber = process.env.KAIRO_BUILD_NUMBER,
) {
  return validateReleaseContract(readRepositoryReleaseContract(root, buildNumber));
}

function runCli() {
  const rootIndex = process.argv.indexOf("--root");
  const root =
    rootIndex >= 0
      ? resolve(process.argv[rootIndex + 1])
      : resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const failures = validateRepositoryReleaseContract(root);

  if (failures.length > 0) {
    console.error("Kairo iOS release contract failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("Kairo iOS release contract passed.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
