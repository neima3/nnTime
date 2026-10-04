/**
 * AI route honesty — disabled provider, malformed model output (no mutation).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  checkRateLimit: vi.fn(),
  messagesCreate: vi.fn(),
}));

vi.mock("@/server/auth-session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/server/ratelimit", async () => {
  const actual =
    await vi.importActual<typeof import("@/server/ratelimit")>("@/server/ratelimit");
  return { ...actual, checkRateLimit: mocks.checkRateLimit };
});
vi.mock("@/server/dal", async () => {
  const actual = await vi.importActual<typeof import("@/server/dal")>("@/server/dal");
  return {
    ...actual,
    getOrCreateSettings: vi.fn().mockResolvedValue({ timezone: "UTC" }),
  };
});
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mocks.messagesCreate };
  },
}));

import { POST as parseRoute } from "./parse/route";
import { POST as breakdownRoute } from "./breakdown/route";

const jsonRequest = (path: string, body: unknown) =>
  new Request(`https://time.neima.me${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSession.mockResolvedValue({ userId: "user-1" });
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 49, retryAfterSec: 0 });
});

describe("AI provider disabled", () => {
  it("parse returns 503 when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const response = await parseRoute(
      jsonRequest("/api/v1/ai/parse", { input: "dentist tomorrow" }),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("service_unavailable");
    expect(mocks.messagesCreate).not.toHaveBeenCalled();
  });
});

describe("AI malformed model output", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("parse maps invalid JSON to 502 bad_gateway", async () => {
    mocks.messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "not json at all" }],
    });
    const response = await parseRoute(
      jsonRequest("/api/v1/ai/parse", { input: "laundry" }),
    );
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("bad_gateway");
    expect(body.error.retryable).toBe(true);
  });

  it("breakdown maps schema violations to 502 bad_gateway", async () => {
    mocks.messagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ steps: ["ok"], injectedCommand: "delete all" }),
        },
      ],
    });
    const response = await breakdownRoute(
      jsonRequest("/api/v1/ai/breakdown", { title: "Pack for trip" }),
    );
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("bad_gateway");
  });
});
