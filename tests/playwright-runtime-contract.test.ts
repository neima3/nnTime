import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve("package.json"), "utf8"),
) as { scripts?: Record<string, string> };
const playwrightConfig = readFileSync(resolve("playwright.config.ts"), "utf8");

describe("Playwright production runtime", () => {
  it("boots the same standalone artifact used by production", () => {
    const standaloneCommand = packageJson.scripts?.["start:standalone"] ?? "";

    expect(standaloneCommand).toContain(".next/standalone/server.js");
    expect(standaloneCommand).toContain("public/.");
    expect(standaloneCommand).toContain(".next/static/.");
    expect(packageJson.scripts?.start).toBe("pnpm start:standalone");
    expect(playwrightConfig).toContain("pnpm start:standalone");
    expect(playwrightConfig).not.toContain("pnpm start --port");
  });
});
