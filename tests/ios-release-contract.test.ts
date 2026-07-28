import { describe, expect, it } from "vitest";

import {
  expectedPrivacyContract,
  readRepositoryReleaseContract,
  validateReleaseContract,
} from "../scripts/ios-release-contract.mjs";
import { resolve } from "node:path";

const validContract = {
  appBundleId: "me.neima.kairo",
  widgetBundleId: "me.neima.kairo.widgets",
  targetDeviceFamily: "1",
  marketingVersion: "1.0.0",
  buildNumber: "731",
  appGroups: ["group.me.neima.kairo"],
  hasHealthKit: true,
  healthShareDescription:
    "Kairo reads recent sleep times to suggest a private wind-down reminder on this iPhone.",
  healthUpdateDescription:
    "Kairo saves completed focus sessions as mindful minutes so your focused time can appear in Apple Health.",
  gitCommitValue: "$(KAIRO_GIT_SHA)",
  buildDateValue: "$(KAIRO_BUILD_DATE)",
  privacy: expectedPrivacyContract,
};

describe("iOS release contract", () => {
  it("keeps the checked-in app target aligned with the release contract", () => {
    const repositoryContract = readRepositoryReleaseContract(resolve("."));
    expect(validateReleaseContract(repositoryContract)).toEqual([]);
  });

  it("accepts Kairo's exact production release contract", () => {
    expect(validateReleaseContract(validContract)).toEqual([]);
  });

  it("rejects incorrect identities, versions, and provenance", () => {
    const failures = validateReleaseContract({
      ...validContract,
      appBundleId: "com.example.kairo",
      widgetBundleId: "com.example.kairo.widgets",
      marketingVersion: "",
      buildNumber: "0",
      gitCommitValue: "",
      buildDateValue: "",
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        "App bundle ID must be me.neima.kairo",
        "Widget bundle ID must be me.neima.kairo.widgets",
        "Marketing version must be set",
        "Build number must be a positive integer",
        "Info.plist must embed KairoGitCommit from $(KAIRO_GIT_SHA)",
        "Info.plist must embed KairoBuildDate from $(KAIRO_BUILD_DATE)",
      ]),
    );
  });

  it("rejects an accidental iPad release surface", () => {
    expect(
      validateReleaseContract({
        ...validContract,
        targetDeviceFamily: "1,2",
      }),
    ).toContain("Kairo release target must be iPhone-only");
  });

  it("rejects missing HealthKit and App Group declarations", () => {
    const failures = validateReleaseContract({
      ...validContract,
      appGroups: [],
      hasHealthKit: false,
      healthShareDescription: "",
      healthUpdateDescription: "",
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        "App Group group.me.neima.kairo is missing",
        "HealthKit entitlement is missing",
        "NSHealthShareUsageDescription is missing",
        "NSHealthUpdateUsageDescription is missing",
      ]),
    );
  });

  it("rejects privacy drift with actionable diagnostics", () => {
    const failures = validateReleaseContract({
      ...validContract,
      privacy: {
        tracking: true,
        trackingDomains: ["tracker.example"],
        collectedDataTypes: [],
        accessedApiTypes: [],
      },
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        "Privacy manifest must declare tracking disabled",
        "Privacy manifest must not declare tracking domains",
        "Privacy manifest collected-data declarations do not match the approved contract",
        "Privacy manifest required-reason API declarations do not match the approved contract",
      ]),
    );
  });
});
