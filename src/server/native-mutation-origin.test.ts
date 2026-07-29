import { afterEach, describe, expect, it, vi } from "vitest";
import { enforceNativeMutationOrigin } from "./native-mutation-origin";

function request(
  url: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(url, { method: "POST", headers });
}

describe("native mutation origin boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows headerless native requests", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(
      enforceNativeMutationOrigin(
        request("https://time.neima.me/api/v1/auth/apple/exchange"),
      ),
    ).toBeNull();
  });

  it("allows only the canonical production web origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(
      enforceNativeMutationOrigin(
        request(
          "https://time.neima.me/api/v1/auth/apple/exchange",
          {
            origin: "https://time.neima.me",
            "sec-fetch-site": "same-origin",
          },
        ),
      ),
    ).toBeNull();
  });

  it("rejects the staging origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = enforceNativeMutationOrigin(
      request(
        "https://time.neima.me/api/v1/auth/apple/exchange",
        {
          origin: "https://time-staging.neima.me",
          "sec-fetch-site": "same-site",
        },
      ),
    );

    expect(response?.status).toBe(403);
  });

  it("rejects the production origin in staging", () => {
    vi.stubEnv("NODE_ENV", "staging");

    const response = enforceNativeMutationOrigin(
      request(
        "https://time-staging.neima.me/api/v1/auth/apple/exchange",
        {
          origin: "https://time.neima.me",
          "sec-fetch-site": "same-site",
        },
      ),
    );

    expect(response?.status).toBe(403);
  });

  it("rejects cross-site browser requests without relying on Origin", () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = enforceNativeMutationOrigin(
      request(
        "https://time.neima.me/api/v1/auth/apple/exchange",
        { "sec-fetch-site": "cross-site" },
      ),
    );

    expect(response?.status).toBe(403);
  });
});
