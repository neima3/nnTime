import { generateKeyPairSync } from "node:crypto";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, it } from "vitest";
import {
  APPLE_NATIVE_BUNDLE_ID,
  accountSecurityOptions,
  createAppleClientSecret,
  createAppleProviderOptions,
  getAppleAuthConfig,
  getAuthCapabilities,
  getTrustedOrigins,
  mapAppleProfile,
} from "./auth-capabilities";

const completeAppleEnv = {
  APPLE_CLIENT_ID: "me.neima.kairo.web",
  APPLE_TEAM_ID: "A45F46XD54",
  APPLE_KEY_ID: "KEY1234567",
  APPLE_PRIVATE_KEY: "private-key",
  APPLE_APP_BUNDLE_IDENTIFIER: APPLE_NATIVE_BUNDLE_ID,
};

describe("native auth capability configuration", () => {
  it("exposes only completely configured delivery methods", () => {
    expect(getAuthCapabilities({})).toEqual({
      magicLink: false,
      apple: false,
    });
    expect(
      getAuthCapabilities({
        RESEND_API_KEY: "re_live",
        ...completeAppleEnv,
      }),
    ).toEqual({
      magicLink: true,
      apple: true,
    });
  });

  it("treats blank and partial configuration as unavailable", () => {
    expect(
      getAuthCapabilities({
        RESEND_API_KEY: "   ",
        ...completeAppleEnv,
        APPLE_KEY_ID: "\n",
      }),
    ).toEqual({
      magicLink: false,
      apple: false,
    });
    expect(
      getAppleAuthConfig({
        ...completeAppleEnv,
        APPLE_TEAM_ID: "",
      }),
    ).toBeNull();
  });

  it("normalizes multiline private keys and pins the native audience", () => {
    expect(
      getAppleAuthConfig({
        ...completeAppleEnv,
        APPLE_PRIVATE_KEY: "line 1\\nline 2",
      }),
    ).toEqual({
      clientId: "me.neima.kairo.web",
      teamId: "A45F46XD54",
      keyId: "KEY1234567",
      privateKey: "line 1\nline 2",
      appBundleIdentifier: APPLE_NATIVE_BUNDLE_ID,
    });
  });

  it("does not mix local, staging, and production trusted origins", () => {
    expect(
      getTrustedOrigins({
        NODE_ENV: "production",
        BETTER_AUTH_URL: "https://time.neima.me",
        ...completeAppleEnv,
      }),
    ).toEqual([
      "https://time.neima.me",
      "https://appleid.apple.com",
    ]);
    expect(
      getTrustedOrigins({
        NODE_ENV: "development",
        BETTER_AUTH_URL: "http://localhost:3456",
      }),
    ).toEqual(["http://localhost:3456", "http://localhost:3000"]);
    expect(
      getTrustedOrigins({
        NODE_ENV: "staging",
        BETTER_AUTH_URL: "https://time-staging.neima.me",
      }),
    ).toEqual(["https://time-staging.neima.me"]);
  });
});

describe("Apple provider helpers", () => {
  it("generates a bounded ES256 client secret with Apple claims", async () => {
    const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const privateKeyPem = privateKey.export({
      format: "pem",
      type: "pkcs8",
    }).toString();
    const now = 1_785_264_000;

    const token = await createAppleClientSecret(
      {
        ...getAppleAuthConfig({
          ...completeAppleEnv,
          APPLE_PRIVATE_KEY: privateKeyPem,
        })!,
      },
      now,
    );

    expect(decodeProtectedHeader(token)).toMatchObject({
      alg: "ES256",
      kid: "KEY1234567",
    });
    expect(decodeJwt(token)).toMatchObject({
      iss: "A45F46XD54",
      sub: "me.neima.kairo.web",
      aud: "https://appleid.apple.com",
      iat: now,
      exp: now + 60 * 60 * 24 * 30,
    });
  });

  it("keeps first-use relay email and creates a stable later fallback", () => {
    expect(
      mapAppleProfile({
        sub: "apple-user-123",
        email: "relay@privaterelay.appleid.com",
        name: "Neima",
      }),
    ).toEqual({
      email: "relay@privaterelay.appleid.com",
      name: "Neima",
    });
    expect(
      mapAppleProfile({
        sub: "apple-user-123",
        name: "",
      }),
    ).toEqual({
      email: "apple-user-123@apple.kairo.invalid",
      name: "Kairo Planner",
    });
  });

  it("builds the native-audience provider without enabling implicit linking", async () => {
    const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const config = getAppleAuthConfig({
      ...completeAppleEnv,
      APPLE_PRIVATE_KEY: privateKey.export({
        format: "pem",
        type: "pkcs8",
      }).toString(),
    })!;

    const provider = await createAppleProviderOptions(config, 1_785_264_000);

    expect(provider).toMatchObject({
      clientId: "me.neima.kairo.web",
      appBundleIdentifier: APPLE_NATIVE_BUNDLE_ID,
    });
    expect(provider.clientSecret.split(".")).toHaveLength(3);
    expect(provider.mapProfileToUser?.({
      sub: "apple-user-123",
      name: "",
    })).toEqual({
      email: "apple-user-123@apple.kairo.invalid",
      name: "Kairo Planner",
    });
    expect(accountSecurityOptions).toEqual({
      encryptOAuthTokens: true,
      accountLinking: {
        disableImplicitLinking: true,
        allowDifferentEmails: false,
      },
    });
  });
});
