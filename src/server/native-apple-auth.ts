import { eq } from "drizzle-orm";
import { verification } from "./auth-schema";

const CHALLENGE_PREFIX = "kairo:native-apple:";
const CHALLENGE_TTL_MS = 5 * 60 * 1_000;

export type AppleAuthIntent = "sign_in" | "link";

export type StoredAppleChallenge = Readonly<{
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
}>;

export interface AppleChallengeStore {
  create(record: StoredAppleChallenge): Promise<void>;
  consume(identifier: string): Promise<StoredAppleChallenge | null>;
}

export interface AppleCredentialProvider {
  signIn(input: {
    idToken: string;
    nonce: string;
  }): Promise<Response>;
  link(input: {
    idToken: string;
    nonce: string;
    userId: string;
  }): Promise<Response>;
}

type ChallengeDependencies = Readonly<{
  store: AppleChallengeStore;
  now?: () => Date;
  randomBytes?: (size: number) => Uint8Array;
  createId?: () => string;
}>;

type ExchangeDependencies = Readonly<{
  store: AppleChallengeStore;
  provider: AppleCredentialProvider;
  now?: () => Date;
}>;

type ChallengePayload = Readonly<{
  version: 1;
  nonceHash: string;
  intent: AppleAuthIntent;
  userId?: string;
}>;

export class NativeAppleAuthError extends Error {
  constructor(
    readonly code: "invalid_challenge" | "expired_challenge",
    readonly status: 400 | 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "NativeAppleAuthError";
  }
}

function secureRandomBytes(size: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(size));
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Buffer.from(digest).toString("hex");
}

async function challengeIdentifier(state: string): Promise<string> {
  return `${CHALLENGE_PREFIX}${await sha256(state)}`;
}

function parsePayload(value: string): ChallengePayload | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== 1 ||
      !("nonceHash" in parsed) ||
      typeof parsed.nonceHash !== "string" ||
      !("intent" in parsed) ||
      (parsed.intent !== "sign_in" && parsed.intent !== "link") ||
      ("userId" in parsed &&
        parsed.userId !== undefined &&
        typeof parsed.userId !== "string")
    ) {
      return null;
    }
    return parsed as ChallengePayload;
  } catch {
    return null;
  }
}

export async function createAppleChallenge(
  input: {
    intent: AppleAuthIntent;
    userId?: string;
  },
  dependencies: ChallengeDependencies,
): Promise<{
  state: string;
  nonce: string;
  expiresAt: string;
}> {
  if (input.intent === "link" && !input.userId) {
    throw new NativeAppleAuthError(
      "invalid_challenge",
      401,
      "Sign in before connecting Apple.",
    );
  }

  const random = dependencies.randomBytes ?? secureRandomBytes;
  const state = base64url(random(32));
  const nonce = base64url(random(32));
  const issuedAt = (dependencies.now ?? (() => new Date()))();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
  const payload: ChallengePayload = {
    version: 1,
    nonceHash: await sha256(nonce),
    intent: input.intent,
    ...(input.userId ? { userId: input.userId } : {}),
  };

  await dependencies.store.create({
    id: (dependencies.createId ?? crypto.randomUUID)(),
    identifier: await challengeIdentifier(state),
    value: JSON.stringify(payload),
    expiresAt,
  });

  return {
    state,
    nonce,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function exchangeAppleCredential(
  input: {
    state: string;
    nonce: string;
    intent: AppleAuthIntent;
    idToken: string;
    userId?: string;
  },
  dependencies: ExchangeDependencies,
): Promise<Response> {
  const identifier = await challengeIdentifier(input.state);
  const stored = await dependencies.store.consume(identifier);
  if (!stored) {
    throw new NativeAppleAuthError(
      "invalid_challenge",
      400,
      "This Apple sign-in request is no longer valid.",
    );
  }

  const now = (dependencies.now ?? (() => new Date()))();
  if (stored.expiresAt.getTime() <= now.getTime()) {
    throw new NativeAppleAuthError(
      "expired_challenge",
      400,
      "This Apple sign-in request expired. Please try again.",
    );
  }

  const payload = parsePayload(stored.value);
  const nonceHash = await sha256(input.nonce);
  if (
    !payload ||
    payload.nonceHash !== nonceHash ||
    payload.intent !== input.intent
  ) {
    throw new NativeAppleAuthError(
      "invalid_challenge",
      400,
      "This Apple sign-in request is not valid.",
    );
  }

  if (input.intent === "link") {
    if (
      !input.userId ||
      !payload.userId ||
      input.userId !== payload.userId
    ) {
      throw new NativeAppleAuthError(
        "invalid_challenge",
        403,
        "This Apple connection request belongs to another session.",
      );
    }
    return dependencies.provider.link({
      idToken: input.idToken,
      nonce: input.nonce,
      userId: input.userId,
    });
  }

  return dependencies.provider.signIn({
    idToken: input.idToken,
    nonce: input.nonce,
  });
}

export const postgresAppleChallengeStore: AppleChallengeStore = {
  async create(record) {
    const { default: db } = await import("./db");
    await db.insert(verification).values(record);
  },
  async consume(identifier) {
    const { default: db } = await import("./db");
    const [record] = await db
      .delete(verification)
      .where(eq(verification.identifier, identifier))
      .returning({
        id: verification.id,
        identifier: verification.identifier,
        value: verification.value,
        expiresAt: verification.expiresAt,
      });
    return record ?? null;
  },
};
