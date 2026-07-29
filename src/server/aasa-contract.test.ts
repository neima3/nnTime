import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Apple App Site Association contract", () => {
  it("associates only the auth callback with the production app ID", () => {
    const document = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "public/.well-known/apple-app-site-association",
        ),
        "utf8",
      ),
    );

    expect(document).toEqual({
      applinks: {
        apps: [],
        details: [
          {
            appIDs: ["A45F46XD54.me.neima.kairo"],
            components: [{ "/": "/auth/callback" }],
          },
        ],
      },
    });
  });

  it("serves the extensionless file as JSON without caching", async () => {
    const headers = await nextConfig.headers?.();
    expect(headers).toContainEqual({
      source: "/.well-known/apple-app-site-association",
      headers: [
        { key: "Content-Type", value: "application/json" },
        { key: "Cache-Control", value: "public, no-cache" },
      ],
    });
  });
});
