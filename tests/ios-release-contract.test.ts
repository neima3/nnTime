import { describe, expect, it } from "vitest";

import {
  expectedPrivacyContract,
  expectedWidgetPrivacyContract,
  readRepositoryReleaseContract,
  validateBuiltAppReleaseContract,
  builtArtifactExpectationFromArguments,
  validateProductionAuthCapabilityResponse,
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
  associatedDomains: ["applinks:time.neima.me"],
  signInWithApple: ["Default"],
  aasaAppIDs: ["A45F46XD54.me.neima.kairo"],
  aasaPaths: ["/auth/callback"],
  authCapabilityFields: ["magicLink", "apple", "google"],
  googlePackageVersion: "9.0.0",
  googleAppProducts: ["GoogleSignIn", "GoogleSignInSwift"],
  googleOtherTargetProducts: [],
  googleIOSClientIDValue: "$(KAIRO_GOOGLE_IOS_CLIENT_ID)",
  googleServerClientIDValue: "$(KAIRO_GOOGLE_SERVER_CLIENT_ID)",
  googleReversedClientIDValue: "$(KAIRO_GOOGLE_REVERSED_CLIENT_ID)",
  googleBuildSettings: [
    "KAIRO_GOOGLE_IOS_CLIENT_ID",
    "KAIRO_GOOGLE_SERVER_CLIENT_ID",
    "KAIRO_GOOGLE_REVERSED_CLIENT_ID",
  ],
  openAPISynced: true,
  healthShareDescription:
    "Kairo reads recent sleep times to suggest a private wind-down reminder on this iPhone.",
  healthUpdateDescription:
    "Kairo saves completed focus sessions as mindful minutes so your focused time can appear in Apple Health.",
  gitCommitValue: "$(KAIRO_GIT_SHA)",
  buildDateValue: "$(KAIRO_BUILD_DATE)",
  privacy: expectedPrivacyContract,
  widgetPrivacy: expectedWidgetPrivacyContract,
};

const validBuiltArtifact = {
  appBundleId: "me.neima.kairo",
  widgetBundleId: "me.neima.kairo.widgets",
  marketingVersion: "1.0.0",
  buildNumber: "731",
  widgetMarketingVersion: "1.0.0",
  widgetBuildNumber: "731",
  targetDeviceFamilies: [1],
  gitCommit: "abc123",
  buildDate: "2026-07-28T05:22:23Z",
  healthShareDescription:
    "Kairo reads recent sleep times to suggest a private wind-down reminder on this iPhone.",
  healthUpdateDescription:
    "Kairo saves completed focus sessions as mindful minutes so your focused time can appear in Apple Health.",
  appSigningAuthorities: [
    "Apple Distribution: NEIMA NAKHAEE (A45F46XD54)",
  ],
  widgetSigningAuthorities: [
    "Apple Distribution: NEIMA NAKHAEE (A45F46XD54)",
  ],
  appTeamIdentifier: "A45F46XD54",
  widgetTeamIdentifier: "A45F46XD54",
  appApplicationIdentifier: "A45F46XD54.me.neima.kairo",
  widgetApplicationIdentifier: "A45F46XD54.me.neima.kairo.widgets",
  appBetaReportsActive: true,
  widgetBetaReportsActive: true,
  appGetTaskAllow: false,
  widgetGetTaskAllow: false,
  appGroups: ["group.me.neima.kairo"],
  hasHealthKit: true,
  associatedDomains: ["applinks:time.neima.me"],
  signInWithApple: ["Default"],
  googleIOSClientID: "ios-client.apps.googleusercontent.com",
  googleServerClientID: "web-client.apps.googleusercontent.com",
  googleURLSchemes: [
    "kairo",
    "com.googleusercontent.apps.ios-client",
  ],
  widgetAppGroups: ["group.me.neima.kairo"],
  widgetHasHealthKit: false,
  privacy: expectedPrivacyContract,
  widgetPrivacy: expectedWidgetPrivacyContract,
};

describe("iOS release contract", () => {
  it("fails closed when a built artifact CLI omits distribution validation", () => {
    expect(() =>
      builtArtifactExpectationFromArguments([
        "--archive",
        "Kairo.xcarchive",
        "--expected-team-id",
        "A45F46XD54",
      ]),
    ).toThrow("requires --distribution");
  });

  it("parses an explicit distribution artifact expectation", () => {
    expect(
      builtArtifactExpectationFromArguments([
        "--archive",
        "Kairo.xcarchive",
        "--distribution",
        "--expected-team-id",
        "A45F46XD54",
      ]),
    ).toMatchObject({
      distribution: true,
      teamId: "A45F46XD54",
    });
  });

  it("fails closed when distribution validation omits its team", () => {
    expect(() =>
      builtArtifactExpectationFromArguments([
        "--app",
        "Kairo.app",
        "--distribution",
      ]),
    ).toThrow("requires --expected-team-id");
  });
  it("keeps the checked-in app target aligned with the release contract", () => {
    const repositoryContract = readRepositoryReleaseContract(resolve("."));
    expect(validateReleaseContract(repositoryContract)).toEqual([]);
  });

  it("accepts Kairo's exact production release contract", () => {
    expect(validateReleaseContract(validContract)).toEqual([]);
  });

  it("rejects incorrect identities, release versions, and provenance", () => {
    const failures = validateReleaseContract({
      ...validContract,
      appBundleId: "com.example.kairo",
      widgetBundleId: "com.example.kairo.widgets",
      marketingVersion: "release",
      buildNumber: "0",
      gitCommitValue: "",
      buildDateValue: "",
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        "App bundle ID must be me.neima.kairo",
        "Widget bundle ID must be me.neima.kairo.widgets",
        "Marketing version must be 1.0.0",
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

  it("rejects missing native authentication release declarations", () => {
    const failures = validateReleaseContract({
      ...validContract,
      associatedDomains: [],
      signInWithApple: [],
      aasaAppIDs: [],
      aasaPaths: [],
      authCapabilityFields: ["magicLink"],
      googlePackageVersion: "9.1.0",
      googleAppProducts: ["GoogleSignIn"],
      googleOtherTargetProducts: ["GoogleSignIn"],
      googleIOSClientIDValue: "",
      googleServerClientIDValue: "",
      googleReversedClientIDValue: "",
      googleBuildSettings: [],
      openAPISynced: false,
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        "Associated domain applinks:time.neima.me is missing",
        "Sign in with Apple entitlement must include Default",
        "AASA must include A45F46XD54.me.neima.kairo",
        "AASA must route /auth/callback",
        "AuthCapabilities must require magicLink, apple, and google booleans",
        "GoogleSignIn-iOS must be pinned exactly to 9.0.0",
        "Kairo app target must link GoogleSignIn and GoogleSignInSwift",
        "Google Sign-In products must only be linked to the Kairo app target",
        "Info.plist must source Google client identifiers from public build settings",
        "Signing.xcconfig must declare all Google public identifier settings",
        "Generated iOS OpenAPI contract is out of sync with api/openapi.yaml",
      ]),
    );
  });

  it("validates the production capability response without leaking configuration", () => {
    expect(
      validateProductionAuthCapabilityResponse({
        magicLink: true,
        apple: true,
        google: true,
      }),
    ).toEqual([]);

    expect(
      validateProductionAuthCapabilityResponse({
        magicLink: "configured",
        apple: false,
        google: false,
        clientId: "should-not-be-public",
      }),
    ).toEqual(
      expect.arrayContaining([
        "Production auth capabilities must expose boolean magicLink, apple, and google fields",
        "Production auth capabilities must expose availability only",
        "Production native auth providers are not fully configured",
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

  it("requires a widget privacy manifest for App Group UserDefaults", () => {
    expect(
      validateReleaseContract({
        ...validContract,
        widgetPrivacy: undefined,
      }),
    ).toContain(
      "Widget privacy manifest required-reason declarations do not match the approved contract",
    );
  });

  it("validates both signed bundles as one immutable artifact", () => {
    expect(
      validateBuiltAppReleaseContract(validBuiltArtifact, {
        buildNumber: "731",
        gitSha: "abc123",
        buildDate: "2026-07-28T05:22:23Z",
      }),
    ).toEqual([]);

    const failures = validateBuiltAppReleaseContract(
      {
        ...validBuiltArtifact,
        widgetMarketingVersion: "1.0.1",
        widgetBuildNumber: "732",
        targetDeviceFamilies: [1, 2],
        healthShareDescription: "",
        widgetAppGroups: [],
        widgetPrivacy: undefined,
        associatedDomains: [],
        signInWithApple: [],
      },
      { buildNumber: "731", gitSha: "abc123" },
    );

    expect(failures).toEqual(
      expect.arrayContaining([
        "Widget marketing version must match the app",
        "Widget build number must match the app",
        "Signed app must be iPhone-only",
        "Signed app is missing NSHealthShareUsageDescription",
        "Signed widget is missing group.me.neima.kairo",
        "Widget privacy manifest required-reason declarations do not match the approved contract",
        "Signed app is missing applinks:time.neima.me",
        "Signed app must include the Sign in with Apple entitlement",
      ]),
    );
  });

  it("requires App Store distribution identities and production entitlements", () => {
    expect(
      validateBuiltAppReleaseContract(validBuiltArtifact, {
        distribution: true,
        teamId: "A45F46XD54",
      }),
    ).toEqual([]);

    const failures = validateBuiltAppReleaseContract(
      {
        ...validBuiltArtifact,
        appSigningAuthorities: ["Apple Development: NEIMA NAKHAEE"],
        widgetSigningAuthorities: ["Apple Development: NEIMA NAKHAEE"],
        appBetaReportsActive: false,
        widgetBetaReportsActive: false,
        appGetTaskAllow: true,
        widgetGetTaskAllow: true,
      },
      { distribution: true, teamId: "A45F46XD54" },
    );

    expect(failures).toEqual(
      expect.arrayContaining([
        "App must be signed by Apple Distribution",
        "Widget must be signed by Apple Distribution",
        "App distribution entitlement beta-reports-active must be true",
        "Widget distribution entitlement beta-reports-active must be true",
        "App distribution entitlement get-task-allow must be false",
        "Widget distribution entitlement get-task-allow must be false",
      ]),
    );
  });

  it("fails closed when a distribution build has incomplete Google identifiers", () => {
    const failures = validateBuiltAppReleaseContract(
      {
        ...validBuiltArtifact,
        googleIOSClientID: "",
        googleServerClientID: "$(KAIRO_GOOGLE_SERVER_CLIENT_ID)",
        googleURLSchemes: ["kairo"],
      },
      { distribution: true, teamId: "A45F46XD54" },
    );

    expect(failures).toEqual(
      expect.arrayContaining([
        "Distribution app must contain a production Google iOS client ID",
        "Distribution app must contain a production Google server client ID",
        "Distribution app must contain the matching reversed Google client URL scheme",
      ]),
    );
  });
});
