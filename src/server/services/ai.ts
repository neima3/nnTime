/**
 * AI co-planner service — Phase 4, ADR-005 (SEC-05 binding).
 *
 * Safety contract (SEC-05): AI endpoints have NO tools, NO credentials, NO
 * mutation authority. Minimum necessary user data. Untrusted fields delimited
 * in prompts. Strict zod output schema with length caps + unknown-field
 * rejection. Output rendered as text and applied ONLY via per-item user
 * confirmation. Atomic per-user daily quota + IP throttle. Timeout/cancel.
 * Prompts/outputs redacted from default logs.
 *
 * Features:
 *  1. Break it down — task → suggested steps → user edits/accepts → checklist.
 *  2. Natural-language add — omnibox → structured draft chip → confirm.
 *  3. Plan my day — Anytime+inbox tasks, current energy, free gaps → proposal.
 *  4. Disruption re-planning — "running late" → shift/reschedule proposal.
 *  5. AI priority grouping of the inbox + duration estimation chip.
 */
import "server-only";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, releaseRateLimit, type RateLimitResult } from "../ratelimit";

/** Per-user daily AI quota (SEC-05) — one bucket shared by every AI route. */
const AI_DAILY_QUOTA = 50;

/** Max tasks handed to the model in one call — bounds input-token cost. */
export const AI_MAX_TASKS = 20;

/** Max characters of a user-authored title forwarded to the model. */
const AI_MAX_TITLE_CHARS = 200;

/** The Anthropic client is created lazily so the key isn't required at import. */
let client: Anthropic | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
    client = new Anthropic({ apiKey, timeout: 30000 });
  }
  return client;
}

/* -------------------------------------------------------------------------- */
/* Output schemas (strict — unknown fields rejected, length caps)             */
/* -------------------------------------------------------------------------- */

export const breakdownSchema = z.strictObject({
  steps: z.array(z.string().max(200)).max(10),
});

export const nlAddSchema = z.strictObject({
  title: z.string().max(200),
  emoji: z.string().max(10).optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
  energy: z.enum(["low", "medium", "high"]).optional(),
  bucket: z.enum(["inbox", "anytime"]).optional(),
  /** Calendar date when the input names one ("tomorrow 3pm"). */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Minutes-from-midnight local start when the input names a time. */
  startMin: z.number().int().min(0).max(1439).optional(),
});

export const planDayItemSchema = z.strictObject({
  taskId: z.string().uuid(),
  scheduledStart: z.string().optional(), // ISO time or null
  reason: z.string().max(200).optional(),
});

export const planDaySchema = z.strictObject({
  items: z.array(planDayItemSchema).max(20),
});

export const priorityGroupingSchema = z.strictObject({
  groups: z.array(
    z.strictObject({
      priority: z.enum(["high", "low", "none"]),
      taskIds: z.array(z.string().uuid()).max(50),
      durationEstimateMin: z.number().int().min(5).max(480).optional(),
    }),
  ).max(5),
});

/* -------------------------------------------------------------------------- */
/* Quota check (SEC-05: atomic per-user daily quota)                           */
/* -------------------------------------------------------------------------- */

/** Thrown when the shared daily AI quota is spent; routes map it to 429. */
export class AiQuotaExceededError extends Error {
  readonly result: RateLimitResult;
  constructor(result: RateLimitResult) {
    super("AI daily quota exceeded");
    this.name = "AiQuotaExceededError";
    this.result = result;
  }
}

export async function checkAiQuota(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(`ai:quota:${userId}:${new Date().toISOString().slice(0, 10)}`, {
    limit: AI_DAILY_QUOTA,
    windowSec: 86400, // 24h
  });
}

/** Thrown when the provider itself is unavailable; routes map it to 503. */
export class AiUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("AI is temporarily unavailable");
    this.name = "AiUnavailableError";
    this.cause = cause;
  }
}

/** The single quota gate: every AI feature consumes this one counter. */
async function consumeAiQuota(userId: string): Promise<void> {
  const result = await checkAiQuota(userId);
  if (!result.allowed) throw new AiQuotaExceededError(result);
}

/**
 * Give a quota slot back after a call that was never billed.
 *
 * The quota is consumed BEFORE the provider call so a hostile client can't spam
 * Anthropic — but that meant an outage on our side silently ate the user's whole
 * daily allowance. (Found in QA: a lapsed credit balance burned all 50 in a row.)
 * Refund only failures where no tokens were charged; a successful call, or one
 * whose response we failed to parse, still costs its slot.
 */
async function refundAiQuota(userId: string): Promise<void> {
  const bucket = `ai:quota:${userId}:${new Date().toISOString().slice(0, 10)}`;
  await releaseRateLimit(bucket).catch(() => {});
}

/** True when the provider never billed the request, so the slot can be refunded. */
function isUnbilledProviderFailure(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (typeof status !== "number") return true; // network / timeout — never reached them
  if (status >= 500) return true; // provider outage
  // 401/403 = our key is wrong; 400 invalid_request for billing = our account.
  if (status === 401 || status === 403) return true;
  const message = String((error as { message?: string })?.message ?? "");
  return status === 400 && /credit balance|billing|quota/i.test(message);
}

/**
 * Run a provider call, refunding the quota slot and reporting 503 when the
 * failure is ours rather than the user's.
 */
async function callProvider<T>(userId: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isUnbilledProviderFailure(error)) {
      await refundAiQuota(userId);
      throw new AiUnavailableError(error);
    }
    throw error;
  }
}

/** Bound an untrusted task list before it becomes prompt input. */
function capTasks<T extends { title: string }>(tasks: T[]): T[] {
  return tasks
    .slice(0, AI_MAX_TASKS)
    .map((t) => ({ ...t, title: t.title.slice(0, AI_MAX_TITLE_CHARS) }));
}

/* -------------------------------------------------------------------------- */
/* Feature 1: Break it down                                                   */
/* -------------------------------------------------------------------------- */

export async function breakDownTask(taskTitle: string, userId: string): Promise<{ steps: string[] }> {
  await consumeAiQuota(userId);

  const response = await callProvider(userId, () =>
    getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    system: `You break tasks into small, actionable steps for someone with ADHD. Return 3-7 steps, each under 200 characters. Respond ONLY with JSON: {"steps": ["step1", "step2", ...]}.`,
    // SEC-05: untrusted field delimited.
    messages: [
      {
        role: "user",
        content: `Break down this task into steps:\n<task>${taskTitle.slice(0, AI_MAX_TITLE_CHARS)}</task>`,
      },
    ],
  }),
  );

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const parsed = JSON.parse(text);
  return breakdownSchema.parse(parsed); // strict: rejects unknown fields
}

/* -------------------------------------------------------------------------- */
/* Feature 2: Natural-language add                                            */
/* -------------------------------------------------------------------------- */

export async function parseNaturalLanguage(input: string, userId: string) {
  await consumeAiQuota(userId);

  // Ground relative dates ("tomorrow", "tuesday") in the user's planning zone.
  const { getOrCreateSettings } = await import("../dal");
  const settings = await getOrCreateSettings(userId);
  const zone = settings.timezone || "UTC";
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const response = await callProvider(userId, () =>
    getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    system: `You parse natural language into a task draft. Today is ${todayStr} (${zone}). Respond ONLY with JSON matching: {"title":"...","emoji":"...","durationMin":N,"energy":"low|medium|high","bucket":"inbox|anytime","date":"YYYY-MM-DD","startMin":N}. Duration in minutes (5-480). Include "date" only when the input names or implies a calendar day (tomorrow, tuesday, jul 30); include "startMin" (minutes from local midnight, e.g. 3pm=900) only when a time is named. If unclear, omit optional fields.`,
    messages: [{ role: "user", content: `<input>${input}</input>` }],
  }),
  );

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const parsed = JSON.parse(text);
  return nlAddSchema.parse(parsed);
}

/* -------------------------------------------------------------------------- */
/* Feature 3: Plan my day                                                     */
/* -------------------------------------------------------------------------- */

export async function planMyDay(
  userId: string,
  tasks: { id: string; title: string; durationMin?: number; energy?: string }[],
  currentEnergy: "low" | "medium" | "high",
  freeSlots: { start: string; end: string }[],
  learned?: { chargedStart: number; chargedEnd: number } | null,
) {
  await consumeAiQuota(userId);
  const capped = capTasks(tasks);

  // Round 9 (E07): the learned pattern travels as data, described in the
  // system prompt — same delimiting discipline as every other untrusted field.
  const learnedBlock = learned
    ? `\n<learned>{"chargedHours":"${String(learned.chargedStart).padStart(2, "0")}:00-${String(learned.chargedEnd).padStart(2, "0")}:00"}</learned>`
    : "";

  const response = await callProvider(userId, () =>
    getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 800,
    system: `You help plan a day for someone with ADHD. Given tasks (each may carry an "energy" tag), the person's current energy, and free time slots, propose a gentle schedule. Respond ONLY with JSON: {"items":[{"taskId":"uuid","scheduledStart":"HH:MM","reason":"brief"}]}. Never schedule more than comfortably fits — under-fill rather than over-pack. Honor energy: current=low means quick/low-energy tasks only and LEAVE OUT tasks tagged "high" (don't force a hard task on a depleted day); current=high favors deep/high-energy work. A <learned> block, when present, gives the clock hours where this person's high-energy work has historically been completed — when a free slot overlaps those hours, prefer placing "high"-tagged tasks there (reason e.g. "your charged hours"). When matched to energy, the "reason" should be kind and brief (e.g. "gentle start", "you're sharp now"). It's fine to schedule fewer tasks than given.`,
    messages: [
      {
        role: "user",
        content: `<tasks>${JSON.stringify(capped)}</tasks>\n<energy>${currentEnergy}</energy>\n<slots>${JSON.stringify(freeSlots)}</slots>${learnedBlock}`,
      },
    ],
  }),
  );

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const parsed = JSON.parse(text);
  return planDaySchema.parse(parsed); // NEVER auto-commits; user confirms per-item
}

/* -------------------------------------------------------------------------- */
/* Feature 5: Priority grouping                                               */
/* -------------------------------------------------------------------------- */

export async function groupByPriority(
  userId: string,
  tasks: { id: string; title: string }[],
) {
  await consumeAiQuota(userId);
  const capped = capTasks(tasks);

  const response = await callProvider(userId, () =>
    getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    system: `Group tasks by priority (high/low/none) for someone with ADHD. Respond ONLY with JSON: {"groups":[{"priority":"high|low|none","taskIds":["uuid"],"durationEstimateMin":N}]}.`,
    messages: [{ role: "user", content: `<tasks>${JSON.stringify(capped)}</tasks>` }],
  }),
  );

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const parsed = JSON.parse(text);
  return priorityGroupingSchema.parse(parsed);
}
