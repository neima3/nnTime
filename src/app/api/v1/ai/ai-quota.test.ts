/**
 * One quota, one 429 — every AI route consumes the same `ai:quota:*` bucket
 * and surfaces exhaustion as an ADR-002 `rate_limited` envelope (never a 500).
 * The service layer runs for real here; only the limiter + DAL are stubbed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  checkRateLimit: vi.fn(),
  listTasks: vi.fn(),
  getEnergyPattern: vi.fn(),
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
  return { ...actual, listTasks: mocks.listTasks };
});
vi.mock("@/server/services/stats", () => ({ getEnergyPattern: mocks.getEnergyPattern }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mocks.messagesCreate };
  },
}));

import { POST as breakdown } from "./breakdown/route";
import { POST as parse } from "./parse/route";
import { POST as planDay } from "./plan-day/route";
import { POST as groupPriority } from "./group-priority/route";
import { AI_MAX_TASKS } from "@/server/services/ai";

const jsonRequest = (path: string, body: unknown) =>
  new Request(`https://time.neima.me${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const task = (i: number) => ({
  id: `0198aaaa-7000-8000-8000-${String(i).padStart(12, "0")}`,
  title: `Task ${i}`,
  energy: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
  mocks.requireSession.mockResolvedValue({ userId: "user-1" });
  mocks.listTasks.mockResolvedValue([task(1), task(2)]);
  mocks.getEnergyPattern.mockResolvedValue(null);
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 49, retryAfterSec: 0 });
  mocks.messagesCreate.mockResolvedValue({
    content: [{ type: "text", text: JSON.stringify({ groups: [] }) }],
  });
});

describe("AI daily quota (SEC-05)", () => {
  const cases: [string, () => Promise<Response>][] = [
    ["breakdown", () => breakdown(jsonRequest("/api/v1/ai/breakdown", { title: "Do laundry" }))],
    ["parse", () => parse(jsonRequest("/api/v1/ai/parse", { input: "laundry at 3pm" }))],
    ["plan-day", () => planDay(jsonRequest("/api/v1/ai/plan-day", { energy: "medium" }))],
    ["group-priority", () => groupPriority()],
  ];

  for (const [name, call] of cases) {
    it(`${name} returns 429 rate_limited when the quota is spent`, async () => {
      mocks.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfterSec: 86400,
      });

      const response = await call();

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error.code).toBe("rate_limited");
      expect(body.error.retryable).toBe(true);
      expect(response.headers.get("retry-after")).toBe("86400");
      expect(mocks.messagesCreate).not.toHaveBeenCalled();
    });
  }

  it("every route consumes the same ai:quota bucket", async () => {
    for (const [, call] of cases) await call();

    const buckets = mocks.checkRateLimit.mock.calls.map((c) => c[0] as string);
    expect(buckets).toHaveLength(cases.length);
    expect(new Set(buckets).size).toBe(1);
    expect(buckets[0]).toMatch(/^ai:quota:user-1:\d{4}-\d{2}-\d{2}$/);
    expect(mocks.checkRateLimit.mock.calls[0][1]).toEqual({ limit: 50, windowSec: 86400 });
  });
});

describe("group-priority payload cap", () => {
  it(`sends at most ${AI_MAX_TASKS} tasks and reports truncation`, async () => {
    const tasks = Array.from({ length: AI_MAX_TASKS + 5 }, (_, i) => task(i));
    mocks.listTasks.mockResolvedValue(tasks);

    const response = await groupPriority();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.truncated).toBe(true);
    expect(body.consideredCount).toBe(AI_MAX_TASKS);
    expect(body.totalCount).toBe(tasks.length);

    const prompt = mocks.messagesCreate.mock.calls[0][0].messages[0].content as string;
    expect(JSON.parse(prompt.replace(/^<tasks>|<\/tasks>$/g, ""))).toHaveLength(AI_MAX_TASKS);
  });

  it("reports truncated:false when the whole inbox fits", async () => {
    const response = await groupPriority();
    const body = await response.json();
    expect(body.truncated).toBe(false);
    expect(body.consideredCount).toBe(2);
  });

  it("caps a pathologically long title before it reaches the model", async () => {
    mocks.listTasks.mockResolvedValue([{ ...task(1), title: "x".repeat(50_000) }]);

    await groupPriority();

    const prompt = mocks.messagesCreate.mock.calls[0][0].messages[0].content as string;
    const sent = JSON.parse(prompt.replace(/^<tasks>|<\/tasks>$/g, ""));
    expect(sent[0].title).toHaveLength(200);
  });
});
