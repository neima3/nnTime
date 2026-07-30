import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("Round 23 Google authentication release documentation", () => {
  it("records Apple Reminders as a privacy-motivated exclusion", () => {
    const checklist = read("docs/plans/parity-checklist.md");
    const row = checklist
      .split("\n")
      .find((line) => line.startsWith("| F02 |"));

    expect(row).toContain("| excluded | 0 |");
    expect(row).toContain("no read-only");
    expect(row).toContain("full read/write");
    expect(row).toContain("data minimization");
  });

  it("keeps Phase 8B open until live web and physical-iPhone proof exists", () => {
    const roadmap = read("docs/plans/2026-07-12-kairo-roadmap.md");

    expect(roadmap).toContain("- [ ] 8B Google sign-in");
    expect(roadmap).toContain("code-complete");
    expect(roadmap).toContain("live production web");
    expect(roadmap).toContain("physical-iPhone");
  });

  it("documents the fail-closed server and public native configuration", () => {
    const deployment = read("docs/DEPLOYMENT.md");
    const nativeReadme = read("ios/README.md");

    for (const variable of [
      "GOOGLE_WEB_CLIENT_ID",
      "GOOGLE_IOS_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ]) {
      expect(deployment).toContain(variable);
    }
    expect(deployment).toContain("magicLink");
    expect(deployment).toContain("apple");
    expect(deployment).toContain("google");
    expect(deployment).toContain("/api/auth/callback/google");
    expect(deployment).toContain("Coolify");
    expect(deployment).toContain("fail-closed");
    expect(deployment).toContain("kairo-nntime-2026");
    expect(deployment).toMatch(/Google API\s+Services: User Data Policy/);
    expect(deployment).toMatch(
      /no Web client, iOS client, or client secret exists/,
    );

    for (const setting of [
      "KAIRO_GOOGLE_IOS_CLIENT_ID",
      "KAIRO_GOOGLE_SERVER_CLIENT_ID",
      "KAIRO_GOOGLE_REVERSED_CLIENT_ID",
    ]) {
      expect(nativeReadme).toContain(setting);
    }
    expect(nativeReadme).toContain("physical iPhone");
    expect(nativeReadme).toContain("Keychain");
    expect(nativeReadme).toContain("logout");
  });
});
