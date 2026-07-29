import { importPKCS8, SignJWT } from "jose";

export const APPLE_NATIVE_BUNDLE_ID = "me.neima.kairo";

type Environment = Readonly<Record<string, string | undefined>>;

export type AuthCapabilities = Readonly<{
  magicLink: boolean;
  apple: boolean;
  google: boolean;
}>;

export type AppleAuthConfig = Readonly<{
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  appBundleIdentifier: typeof APPLE_NATIVE_BUNDLE_ID;
}>;

export type AppleProfile = Readonly<{
  sub: string;
  email?: string | null;
  name?: string | null;
}>;

export type GoogleAuthConfig = Readonly<{
  clientIds: readonly [web: string, ios: string];
  clientSecret: string;
}>;

export type GoogleProviderOptions = Readonly<{
  clientId: [web: string, ios: string];
  clientSecret: string;
  scope: [];
  prompt: "select_account";
}>;

export const accountSecurityOptions = Object.freeze({
  encryptOAuthTokens: true,
  accountLinking: Object.freeze({
    disableImplicitLinking: true,
    allowDifferentEmails: false,
  }),
});

function configured(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getAppleAuthConfig(
  environment: Environment,
): AppleAuthConfig | null {
  const clientId = configured(environment.APPLE_CLIENT_ID);
  const teamId = configured(environment.APPLE_TEAM_ID);
  const keyId = configured(environment.APPLE_KEY_ID);
  const privateKey = configured(environment.APPLE_PRIVATE_KEY);
  const appBundleIdentifier = configured(
    environment.APPLE_APP_BUNDLE_IDENTIFIER,
  );

  if (
    !clientId ||
    !teamId ||
    !keyId ||
    !privateKey ||
    appBundleIdentifier !== APPLE_NATIVE_BUNDLE_ID
  ) {
    return null;
  }

  return {
    clientId,
    teamId,
    keyId,
    privateKey: privateKey.replaceAll("\\n", "\n"),
    appBundleIdentifier: APPLE_NATIVE_BUNDLE_ID,
  };
}

export function getGoogleAuthConfig(
  environment: Environment,
): GoogleAuthConfig | null {
  const webClientId = configured(environment.GOOGLE_WEB_CLIENT_ID);
  const iosClientId = configured(environment.GOOGLE_IOS_CLIENT_ID);
  const clientSecret = configured(environment.GOOGLE_CLIENT_SECRET);

  if (!webClientId || !iosClientId || !clientSecret) {
    return null;
  }

  return Object.freeze({
    clientIds: Object.freeze([webClientId, iosClientId] as const),
    clientSecret,
  });
}

export function getGoogleProviderOptions(
  environment: Environment,
): GoogleProviderOptions | null {
  const config = getGoogleAuthConfig(environment);
  if (!config) {
    return null;
  }

  return {
    clientId: [...config.clientIds],
    clientSecret: config.clientSecret,
    scope: [],
    prompt: "select_account",
  };
}

export function getAuthCapabilities(
  environment: Environment,
): AuthCapabilities {
  return Object.freeze({
    magicLink: configured(environment.RESEND_API_KEY) !== null,
    apple: getAppleAuthConfig(environment) !== null,
    google: getGoogleAuthConfig(environment) !== null,
  });
}

export function getTrustedOrigins(environment: Environment): string[] {
  const mode = configured(environment.NODE_ENV) ?? "development";
  const configuredBaseURL = configured(environment.BETTER_AUTH_URL);
  const fallbackBaseURL =
    mode === "production"
      ? "https://time.neima.me"
      : mode === "staging"
        ? "https://time-staging.neima.me"
        : "http://localhost:3000";
  const origins = [configuredBaseURL ?? fallbackBaseURL];

  if (mode === "development") {
    origins.push("http://localhost:3000");
  }
  if (getAppleAuthConfig(environment)) {
    origins.push("https://appleid.apple.com");
  }

  return [...new Set(origins)];
}

export async function createAppleClientSecret(
  config: AppleAuthConfig,
  nowSeconds = Math.floor(Date.now() / 1_000),
): Promise<string> {
  const key = await importPKCS8(config.privateKey, "ES256");
  return new SignJWT({})
    .setProtectedHeader({
      alg: "ES256",
      kid: config.keyId,
    })
    .setIssuer(config.teamId)
    .setSubject(config.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 60 * 60 * 24 * 30)
    .sign(key);
}

export async function createAppleProviderOptions(
  config: AppleAuthConfig,
  nowSeconds?: number,
) {
  return {
    clientId: config.clientId,
    clientSecret: await createAppleClientSecret(config, nowSeconds),
    appBundleIdentifier: config.appBundleIdentifier,
    mapProfileToUser: mapAppleProfile,
  };
}

export function mapAppleProfile(profile: AppleProfile): {
  email: string;
  name: string;
} {
  return {
    email:
      configured(profile.email ?? undefined) ??
      `${profile.sub}@apple.kairo.invalid`,
    name: configured(profile.name ?? undefined) ?? "Kairo Planner",
  };
}
