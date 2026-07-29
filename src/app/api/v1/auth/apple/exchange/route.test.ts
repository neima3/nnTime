import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthCapabilities: vi.fn(),
  requireSession: vi.fn(),
  exchangeAppleCredential: vi.fn(),
  signInSocial: vi.fn(),
  linkSocialAccount: vi.fn(),
}));

vi.mock("@/server/auth-capabilities", () => ({
  getAuthCapabilities: mocks.getAuthCapabilities,
}));
vi.mock("@/server/auth-session", () => ({
  requireSession: mocks.requireSession,
}));
vi.mock("@/server/native-apple-auth", () => ({
  NativeAppleAuthError: class NativeAppleAuthError extends Error {
    constructor(
      readonly code: string,
      readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
  exchangeAppleCredential: mocks.exchangeAppleCredential,
  postgresAppleChallengeStore: { kind: "postgres-store" },
}));
vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      signInSocial: mocks.signInSocial,
      linkSocialAccount: mocks.linkSocialAccount,
    },
  },
}));

import { POST } from "./route";
import { NativeAppleAuthError } from "@/server/native-apple-auth";

function request(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(
    "https://time.neima.me/api/v1/auth/apple/exchange",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "kairo.session=current",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
}

const body = {
  intent: "sign_in",
  state: "state",
  nonce: "nonce",
  idToken: "identity-token",
};

describe("POST /api/v1/auth/apple/exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthCapabilities.mockReturnValue({
      magicLink: true,
      apple: true,
    });
    mocks.requireSession.mockResolvedValue({
      userId: "user-7",
      sessionId: "session-7",
    });
    mocks.signInSocial.mockResolvedValue(
      Response.json(
        { user: { id: "user-7" } },
        { headers: { "set-cookie": "kairo.session=new; HttpOnly" } },
      ),
    );
    mocks.linkSocialAccount.mockResolvedValue(
      Response.json({ status: true }),
    );
    mocks.exchangeAppleCredential.mockImplementation(
      async (
        input: { intent: "sign_in" | "link" },
        dependencies: {
          provider: {
            signIn: (value: unknown) => Promise<Response>;
            link: (value: unknown) => Promise<Response>;
          };
        },
      ) =>
        input.intent === "link"
          ? dependencies.provider.link(input)
          : dependencies.provider.signIn(input),
    );
  });

  it("delegates ID-token sign-in to Better Auth and preserves its cookie", async () => {
    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "kairo.session=new",
    );
    expect(mocks.requireSession).not.toHaveBeenCalled();
    expect(mocks.signInSocial).toHaveBeenCalledWith({
      body: {
        provider: "apple",
        idToken: {
          token: "identity-token",
          nonce: "nonce",
        },
        requestSignUp: true,
      },
      asResponse: true,
      headers: expect.any(Headers),
    });
  });

  it("delegates explicit linking with the authenticated session headers", async () => {
    const response = await POST(
      request({ ...body, intent: "link" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.requireSession).toHaveBeenCalledOnce();
    expect(mocks.exchangeAppleCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "link",
        userId: "user-7",
      }),
      expect.any(Object),
    );
    expect(mocks.linkSocialAccount).toHaveBeenCalledWith({
      body: {
        provider: "apple",
        idToken: {
          token: "identity-token",
          nonce: "nonce",
        },
      },
      asResponse: true,
      headers: expect.any(Headers),
    });
  });

  it("maps challenge failures to the standard envelope", async () => {
    mocks.exchangeAppleCredential.mockRejectedValueOnce(
      new NativeAppleAuthError(
        "expired_challenge",
        400,
        "This Apple sign-in request expired. Please try again.",
      ),
    );

    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "expired_challenge",
        message: "This Apple sign-in request expired. Please try again.",
        retryable: false,
      },
    });
  });

  it("turns disabled implicit linking into actionable email-first guidance", async () => {
    mocks.signInSocial.mockResolvedValueOnce(
      Response.json(
        {
          code: "OAUTH_LINK_ERROR",
          message: "account not linked",
        },
        { status: 401 },
      ),
    );

    const response = await POST(request(body));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "account_not_linked",
        message:
          "Sign in with your existing email first, then connect Apple in Settings.",
        retryable: false,
      },
    });
  });

  it("maps invalid Apple link credentials to 400 without signaling session expiry", async () => {
    mocks.linkSocialAccount.mockResolvedValueOnce(
      Response.json(
        {
          code: "INVALID_TOKEN",
          message: "invalid Apple identity token",
        },
        { status: 401 },
      ),
    );

    const response = await POST(request({ ...body, intent: "link" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_credential",
        message: "Apple could not verify this sign-in. Please try again.",
        retryable: false,
      },
    });
  });

  it("rejects cross-site browser linking before reading the session", async () => {
    const response = await POST(
      request(
        { ...body, intent: "link" },
        {
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(mocks.requireSession).not.toHaveBeenCalled();
    expect(mocks.exchangeAppleCredential).not.toHaveBeenCalled();
  });

  it("rejects unknown fields without reflecting credentials", async () => {
    const response = await POST(
      request({ ...body, unexpected: "identity-token" }),
    );
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).not.toContain("identity-token");
    expect(mocks.exchangeAppleCredential).not.toHaveBeenCalled();
  });

  it("returns 503 before consuming a challenge when Apple is unavailable", async () => {
    mocks.getAuthCapabilities.mockReturnValue({
      magicLink: true,
      apple: false,
    });

    const response = await POST(request(body));

    expect(response.status).toBe(503);
    expect(mocks.exchangeAppleCredential).not.toHaveBeenCalled();
  });
});
