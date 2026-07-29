import { describe, expect, it, vi } from "vitest";
import {
  NativeAppleAuthError,
  createAppleChallenge,
  exchangeAppleCredential,
  type AppleChallengeStore,
  type StoredAppleChallenge,
} from "./native-apple-auth";

const now = new Date("2026-07-29T12:00:00.000Z");

class MemoryChallengeStore implements AppleChallengeStore {
  records = new Map<string, StoredAppleChallenge>();
  createdIdentifier: string | null = null;

  async create(record: StoredAppleChallenge) {
    this.createdIdentifier = record.identifier;
    this.records.set(record.identifier, record);
  }

  async consume(identifier: string) {
    const record = this.records.get(identifier) ?? null;
    this.records.delete(identifier);
    return record;
  }
}

function deterministicRandom() {
  let call = 0;
  return (size: number) => {
    call += 1;
    return new Uint8Array(size).fill(call);
  };
}

async function issue(
  store: MemoryChallengeStore,
  input: { intent?: "sign_in" | "link"; userId?: string } = {},
) {
  return createAppleChallenge(
    {
      intent: input.intent ?? "sign_in",
      userId: input.userId,
    },
    {
      store,
      now: () => now,
      randomBytes: deterministicRandom(),
      createId: () => "verification-id",
    },
  );
}

const providers = () => ({
  signIn: vi.fn(async () =>
    Response.json(
      { user: { id: "user-1" } },
      { headers: { "set-cookie": "kairo.session=secret; HttpOnly" } },
    ),
  ),
  link: vi.fn(async () => Response.json({ status: true })),
});

describe("Apple one-time challenge issuance", () => {
  it("returns independent 256-bit values but persists only hashes", async () => {
    const store = new MemoryChallengeStore();

    const challenge = await issue(store);
    const persisted = [...store.records.values()][0];

    expect(Buffer.from(challenge.state, "base64url")).toHaveLength(32);
    expect(Buffer.from(challenge.nonce, "base64url")).toHaveLength(32);
    expect(challenge.state).not.toBe(challenge.nonce);
    expect(persisted.identifier).toMatch(
      /^kairo:native-apple:[a-f0-9]{64}$/,
    );
    expect(persisted.identifier).not.toContain(challenge.state);
    expect(persisted.value).not.toContain(challenge.nonce);
    expect(JSON.parse(persisted.value)).toEqual({
      version: 1,
      nonceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      intent: "sign_in",
    });
    expect(challenge.expiresAt).toBe("2026-07-29T12:05:00.000Z");
    expect(persisted.expiresAt).toEqual(
      new Date("2026-07-29T12:05:00.000Z"),
    );
  });

  it("binds link challenges to the authenticated user", async () => {
    const store = new MemoryChallengeStore();

    await issue(store, { intent: "link", userId: "user-7" });

    expect(JSON.parse([...store.records.values()][0].value)).toEqual({
      version: 1,
      nonceHash: expect.any(String),
      intent: "link",
      userId: "user-7",
    });
  });

  it("rejects a link challenge without an authenticated user", async () => {
    await expect(
      issue(new MemoryChallengeStore(), { intent: "link" }),
    ).rejects.toMatchObject({
      code: "invalid_challenge",
      status: 401,
    });
  });
});

describe("Apple one-time challenge exchange", () => {
  it("consumes state before sign-in and forwards the provider response", async () => {
    const store = new MemoryChallengeStore();
    const challenge = await issue(store);
    const provider = providers();

    const response = await exchangeAppleCredential(
      {
        ...challenge,
        intent: "sign_in",
        idToken: "identity-token",
      },
      { store, provider, now: () => now },
    );

    expect(store.records.size).toBe(0);
    expect(provider.signIn).toHaveBeenCalledWith({
      idToken: "identity-token",
      nonce: challenge.nonce,
    });
    expect(provider.link).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("kairo.session");
  });

  it("rejects replay without invoking the provider twice", async () => {
    const store = new MemoryChallengeStore();
    const challenge = await issue(store);
    const provider = providers();
    const input = {
      ...challenge,
      intent: "sign_in" as const,
      idToken: "identity-token",
    };

    await exchangeAppleCredential(input, {
      store,
      provider,
      now: () => now,
    });

    await expect(
      exchangeAppleCredential(input, {
        store,
        provider,
        now: () => now,
      }),
    ).rejects.toMatchObject({ code: "invalid_challenge", status: 400 });
    expect(provider.signIn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["wrong nonce", { nonce: "wrong" }, "invalid_challenge"],
    ["wrong intent", { intent: "link" as const }, "invalid_challenge"],
  ])("rejects %s after consuming the challenge", async (_, patch, code) => {
    const store = new MemoryChallengeStore();
    const challenge = await issue(store);
    const provider = providers();

    await expect(
      exchangeAppleCredential(
        {
          ...challenge,
          intent: "sign_in",
          idToken: "identity-token",
          ...patch,
        },
        { store, provider, now: () => now },
      ),
    ).rejects.toMatchObject({ code });
    expect(store.records.size).toBe(0);
    expect(provider.signIn).not.toHaveBeenCalled();
    expect(provider.link).not.toHaveBeenCalled();
  });

  it("rejects an expired challenge distinctly", async () => {
    const store = new MemoryChallengeStore();
    const challenge = await issue(store);

    await expect(
      exchangeAppleCredential(
        {
          ...challenge,
          intent: "sign_in",
          idToken: "identity-token",
        },
        {
          store,
          provider: providers(),
          now: () => new Date("2026-07-29T12:05:00.001Z"),
        },
      ),
    ).rejects.toMatchObject({
      code: "expired_challenge",
      status: 400,
    });
    expect(store.records.size).toBe(0);
  });

  it("binds linking to the same signed-in user", async () => {
    const store = new MemoryChallengeStore();
    const challenge = await issue(store, {
      intent: "link",
      userId: "user-7",
    });
    const provider = providers();

    await expect(
      exchangeAppleCredential(
        {
          ...challenge,
          intent: "link",
          idToken: "identity-token",
          userId: "user-8",
        },
        { store, provider, now: () => now },
      ),
    ).rejects.toBeInstanceOf(NativeAppleAuthError);
    expect(provider.link).not.toHaveBeenCalled();

    const retryChallenge = await issue(store, {
      intent: "link",
      userId: "user-7",
    });
    await exchangeAppleCredential(
      {
        ...retryChallenge,
        intent: "link",
        idToken: "identity-token",
        userId: "user-7",
      },
      { store, provider, now: () => now },
    );
    expect(provider.link).toHaveBeenCalledWith({
      idToken: "identity-token",
      nonce: retryChallenge.nonce,
      userId: "user-7",
    });
  });

  it("stays consumed when provider verification fails", async () => {
    const store = new MemoryChallengeStore();
    const challenge = await issue(store);
    const provider = providers();
    provider.signIn.mockRejectedValueOnce(new Error("provider rejected"));

    await expect(
      exchangeAppleCredential(
        {
          ...challenge,
          intent: "sign_in",
          idToken: "identity-token",
        },
        { store, provider, now: () => now },
      ),
    ).rejects.toThrow("provider rejected");
    expect(store.records.size).toBe(0);
  });
});
