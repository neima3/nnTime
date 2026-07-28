#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
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

export const expectedWidgetPrivacyContract = Object.freeze({
  tracking: false,
  trackingDomains: [],
  collectedDataTypes: [],
  accessedApiTypes: [
    {
      apiType: "NSPrivacyAccessedAPICategoryUserDefaults",
      reasons: ["1C8F.1"],
    },
  ],
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
  if (String(contract.targetDeviceFamily) !== "1") {
    failures.push("Kairo release target must be iPhone-only");
  }
  if (contract.marketingVersion !== "1.0.0") {
    failures.push("Marketing version must be 1.0.0");
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
  if (!sameContract(contract.widgetPrivacy, expectedWidgetPrivacyContract)) {
    failures.push(
      "Widget privacy manifest required-reason declarations do not match the approved contract",
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

function readPlistText(text) {
  return JSON.parse(
    execFileSync("plutil", ["-convert", "json", "-o", "-", "-"], {
      encoding: "utf8",
      input: text,
    }),
  );
}

function readCodeSignEntitlements(bundlePath) {
  const plist = execFileSync(
    "codesign",
    ["--display", "--entitlements", ":-", bundlePath],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  return readPlistText(plist);
}

function readCodeSignMetadata(bundlePath) {
  const result = spawnSync(
    "codesign",
    ["--display", "--verbose=4", bundlePath],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || `codesign metadata failed for ${bundlePath}`);
  }
  const output = `${result.stdout}${result.stderr}`;
  return {
    authorities: [...output.matchAll(/^Authority=(.+)$/gm)].map(
      (match) => match[1],
    ),
    teamIdentifier: output.match(/^TeamIdentifier=(.+)$/m)?.[1],
  };
}

export function validateBuiltAppReleaseContract(contract, expected = {}) {
  const failures = [];

  if (contract.appBundleId !== "me.neima.kairo") {
    failures.push("App bundle ID must be me.neima.kairo");
  }
  if (contract.widgetBundleId !== "me.neima.kairo.widgets") {
    failures.push("Widget bundle ID must be me.neima.kairo.widgets");
  }
  if (contract.marketingVersion !== "1.0.0") {
    failures.push("Marketing version must be 1.0.0");
  }
  if (!/^[1-9]\d*$/.test(contract.buildNumber ?? "")) {
    failures.push("Build number must be a positive integer");
  }
  if (contract.widgetMarketingVersion !== contract.marketingVersion) {
    failures.push("Widget marketing version must match the app");
  }
  if (contract.widgetBuildNumber !== contract.buildNumber) {
    failures.push("Widget build number must match the app");
  }
  if (
    !Array.isArray(contract.targetDeviceFamilies) ||
    contract.targetDeviceFamilies.length !== 1 ||
    Number(contract.targetDeviceFamilies[0]) !== 1
  ) {
    failures.push("Signed app must be iPhone-only");
  }
  if (!contract.healthShareDescription?.trim()) {
    failures.push("Signed app is missing NSHealthShareUsageDescription");
  }
  if (!contract.healthUpdateDescription?.trim()) {
    failures.push("Signed app is missing NSHealthUpdateUsageDescription");
  }
  if (expected.buildNumber && contract.buildNumber !== expected.buildNumber) {
    failures.push(
      `Build number must match release input ${expected.buildNumber}`,
    );
  }
  if (expected.gitSha && contract.gitCommit !== expected.gitSha) {
    failures.push(`Git provenance must match release input ${expected.gitSha}`);
  }
  if (expected.buildDate && contract.buildDate !== expected.buildDate) {
    failures.push(`Build date must match release input ${expected.buildDate}`);
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(
      contract.buildDate ?? "",
    )
  ) {
    failures.push("Build date must be a UTC ISO-8601 timestamp");
  }
  if (!contract.appGroups?.includes("group.me.neima.kairo")) {
    failures.push("Signed app is missing group.me.neima.kairo");
  }
  if (contract.hasHealthKit !== true) {
    failures.push("Signed app is missing the HealthKit entitlement");
  }
  if (!contract.widgetAppGroups?.includes("group.me.neima.kairo")) {
    failures.push("Signed widget is missing group.me.neima.kairo");
  }
  if (contract.widgetHasHealthKit === true) {
    failures.push("Signed widget must not contain the HealthKit entitlement");
  }
  if (!sameContract(contract.privacy, expectedPrivacyContract)) {
    failures.push("App privacy manifest does not match the approved contract");
  }
  if (!sameContract(contract.widgetPrivacy, expectedWidgetPrivacyContract)) {
    failures.push(
      "Widget privacy manifest required-reason declarations do not match the approved contract",
    );
  }
  if (expected.distribution === true) {
    if (
      !contract.appSigningAuthorities?.some((authority) =>
        authority.startsWith("Apple Distribution:"),
      )
    ) {
      failures.push("App must be signed by Apple Distribution");
    }
    if (
      !contract.widgetSigningAuthorities?.some((authority) =>
        authority.startsWith("Apple Distribution:"),
      )
    ) {
      failures.push("Widget must be signed by Apple Distribution");
    }
    if (contract.appBetaReportsActive !== true) {
      failures.push(
        "App distribution entitlement beta-reports-active must be true",
      );
    }
    if (contract.widgetBetaReportsActive !== true) {
      failures.push(
        "Widget distribution entitlement beta-reports-active must be true",
      );
    }
    if (contract.appGetTaskAllow !== false) {
      failures.push(
        "App distribution entitlement get-task-allow must be false",
      );
    }
    if (contract.widgetGetTaskAllow !== false) {
      failures.push(
        "Widget distribution entitlement get-task-allow must be false",
      );
    }
    if (expected.teamId) {
      if (
        contract.appTeamIdentifier !== expected.teamId ||
        contract.appApplicationIdentifier !==
          `${expected.teamId}.me.neima.kairo`
      ) {
        failures.push("App distribution team identity does not match");
      }
      if (
        contract.widgetTeamIdentifier !== expected.teamId ||
        contract.widgetApplicationIdentifier !==
          `${expected.teamId}.me.neima.kairo.widgets`
      ) {
        failures.push("Widget distribution team identity does not match");
      }
    }
  }

  return failures;
}

export function readBuiltAppReleaseContract(appPath) {
  const widgetPath = resolve(appPath, "PlugIns/KairoWidget.appex");
  const info = readPlist(resolve(appPath, "Info.plist"));
  const widgetInfo = readPlist(resolve(widgetPath, "Info.plist"));
  const appEntitlements = readCodeSignEntitlements(appPath);
  const widgetEntitlements = readCodeSignEntitlements(widgetPath);
  const appSigning = readCodeSignMetadata(appPath);
  const widgetSigning = readCodeSignMetadata(widgetPath);
  const appPrivacyPath = resolve(appPath, "PrivacyInfo.xcprivacy");
  const widgetPrivacyPath = resolve(widgetPath, "PrivacyInfo.xcprivacy");

  return {
    appBundleId: info.CFBundleIdentifier,
    widgetBundleId: widgetInfo.CFBundleIdentifier,
    marketingVersion: String(info.CFBundleShortVersionString ?? ""),
    buildNumber: String(info.CFBundleVersion ?? ""),
    widgetMarketingVersion: String(
      widgetInfo.CFBundleShortVersionString ?? "",
    ),
    widgetBuildNumber: String(widgetInfo.CFBundleVersion ?? ""),
    targetDeviceFamilies: info.UIDeviceFamily ?? [],
    gitCommit: info.KairoGitCommit,
    buildDate: info.KairoBuildDate,
    healthShareDescription: info.NSHealthShareUsageDescription,
    healthUpdateDescription: info.NSHealthUpdateUsageDescription,
    appSigningAuthorities: appSigning.authorities,
    widgetSigningAuthorities: widgetSigning.authorities,
    appTeamIdentifier:
      appEntitlements["com.apple.developer.team-identifier"] ??
      appSigning.teamIdentifier,
    widgetTeamIdentifier:
      widgetEntitlements["com.apple.developer.team-identifier"] ??
      widgetSigning.teamIdentifier,
    appApplicationIdentifier: appEntitlements["application-identifier"],
    widgetApplicationIdentifier:
      widgetEntitlements["application-identifier"],
    appBetaReportsActive: appEntitlements["beta-reports-active"],
    widgetBetaReportsActive: widgetEntitlements["beta-reports-active"],
    appGetTaskAllow: appEntitlements["get-task-allow"],
    widgetGetTaskAllow: widgetEntitlements["get-task-allow"],
    appGroups:
      appEntitlements["com.apple.security.application-groups"] ?? [],
    hasHealthKit:
      appEntitlements["com.apple.developer.healthkit"] === true,
    widgetAppGroups:
      widgetEntitlements["com.apple.security.application-groups"] ?? [],
    widgetHasHealthKit:
      widgetEntitlements["com.apple.developer.healthkit"] === true,
    privacy: existsSync(appPrivacyPath)
      ? privacyContractFromPlist(readPlist(appPrivacyPath))
      : undefined,
    widgetPrivacy: existsSync(widgetPrivacyPath)
      ? privacyContractFromPlist(readPlist(widgetPrivacyPath))
      : undefined,
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
  const widgetPrivacyPath = resolve(root, "ios/Widget/PrivacyInfo.xcprivacy");
  const privacy = existsSync(privacyPath)
    ? privacyContractFromPlist(readPlist(privacyPath))
    : undefined;
  const widgetPrivacy = existsSync(widgetPrivacyPath)
    ? privacyContractFromPlist(readPlist(widgetPrivacyPath))
    : undefined;
  const baseSettings = project.settings?.base ?? {};
  const appSettings = project.targets?.Kairo?.settings?.base ?? {};
  const widgetSettings = project.targets?.KairoWidget?.settings?.base ?? {};

  return {
    appBundleId: appSettings.PRODUCT_BUNDLE_IDENTIFIER,
    widgetBundleId: widgetSettings.PRODUCT_BUNDLE_IDENTIFIER,
    targetDeviceFamily: String(appSettings.TARGETED_DEVICE_FAMILY ?? ""),
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
    widgetPrivacy,
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
  const appIndex = process.argv.indexOf("--app");
  const archiveIndex = process.argv.indexOf("--archive");
  const expectedBuildIndex = process.argv.indexOf("--expected-build-number");
  const expectedGitIndex = process.argv.indexOf("--expected-git-sha");
  const expectedDateIndex = process.argv.indexOf("--expected-build-date");
  const expectedTeamIndex = process.argv.indexOf("--expected-team-id");
  let failures;
  let successMessage;

  try {
    if (appIndex >= 0 || archiveIndex >= 0) {
      const appPath =
        appIndex >= 0
          ? resolve(process.argv[appIndex + 1])
          : resolve(
              process.argv[archiveIndex + 1],
              "Products/Applications/Kairo.app",
            );
      const expected = {
        buildNumber:
          expectedBuildIndex >= 0
            ? process.argv[expectedBuildIndex + 1]
            : undefined,
        gitSha:
          expectedGitIndex >= 0
            ? process.argv[expectedGitIndex + 1]
            : undefined,
        buildDate:
          expectedDateIndex >= 0
            ? process.argv[expectedDateIndex + 1]
            : undefined,
        distribution: process.argv.includes("--distribution"),
        teamId:
          expectedTeamIndex >= 0
            ? process.argv[expectedTeamIndex + 1]
            : undefined,
      };
      failures = validateBuiltAppReleaseContract(
        readBuiltAppReleaseContract(appPath),
        expected,
      );
      successMessage = `Kairo signed artifact contract passed: ${appPath}`;
    } else {
      const root =
        rootIndex >= 0
          ? resolve(process.argv[rootIndex + 1])
          : resolve(dirname(fileURLToPath(import.meta.url)), "..");
      failures = validateRepositoryReleaseContract(root);
      successMessage = "Kairo iOS release contract passed.";
    }
  } catch (error) {
    console.error(`Kairo iOS release contract could not be read: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (failures.length > 0) {
    console.error("Kairo iOS release contract failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(successMessage);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
