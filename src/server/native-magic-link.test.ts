import { describe, expect, it } from "vitest";
import {
  buildMagicLinkDeliveryUrl,
  parseMagicCallbackToken,
} from "./native-magic-link";

describe("native magic-link delivery", () => {
  it("rewrites only explicit iOS requests to the canonical universal link", () => {
    expect(
      buildMagicLinkDeliveryUrl({
        token: "single-use-token",
        defaultUrl:
          "https://time.neima.me/api/auth/magic-link/verify?token=single-use-token",
        metadata: { platform: "ios" },
      }),
    ).toBe(
      "https://time.neima.me/auth/callback?token=single-use-token",
    );
  });

  it("preserves the standard Better Auth URL for web and unknown metadata", () => {
    const defaultUrl =
      "https://time.neima.me/api/auth/magic-link/verify?token=token";
    expect(
      buildMagicLinkDeliveryUrl({
        token: "token",
        defaultUrl,
      }),
    ).toBe(defaultUrl);
    expect(
      buildMagicLinkDeliveryUrl({
        token: "token",
        defaultUrl,
        metadata: { platform: "android" },
      }),
    ).toBe(defaultUrl);
  });
});

describe("magic callback token parsing", () => {
  it("accepts one bounded opaque token", () => {
    expect(parseMagicCallbackToken("abc-DEF_123")).toBe("abc-DEF_123");
  });

  it.each([undefined, "", "  ", ["one", "two"], "a".repeat(513)])(
    "rejects invalid callback token %j",
    (token) => {
      expect(parseMagicCallbackToken(token)).toBeNull();
    },
  );
});
