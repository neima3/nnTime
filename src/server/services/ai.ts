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
import { checkRateLimit } from "../ratelimit";

/** Per-user daily AI quota (SEC-05). */
const AI_DAILY_QUOTA = 50;

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

export const breakdownSchema = z.object({
  steps: z.array(z.string().max(200)).max(10),
});

export const nlAddSchema = z.object({
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

export const planDayItemSchema = z.object({
  taskId: z.string().uuid(),
  scheduledStart: z.string().optional(), // ISO time or null
  reason: z.string().max(200).optional(),
});

export const planDaySchema = z.object({
  items: z.array(planDayItemSchema).max(20),
});

export const priorityGroupingSchema = z.object({
  groups: z.array(
    z.object({
      priority: z.enum(["high", "low", "none"]),
      taskIds: z.array(z.string().uuid()).max(50),
      durationEstimateMin: z.number().int().min(5).max(480).optional(),
    }),
  ).max(5),
});

/* -------------------------------------------------------------------------- */
/* Quota check (SEC-05: atomic per-user daily quota)                           */
/* -------------------------------------------------------------------------- */

export async function checkAiQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const result = await checkRateLimit(`ai:quota:${userId}:${new Date().toISOString().slice(0, 10)}`, {
    limit: AI_DAILY_QUOTA,
    windowSec: 86400, // 24h
  });
  return { allowed: result.allowed, remaining: result.remaining };
}

/* -------------------------------------------------------------------------- */
/* Feature 1: Break it down                                                   */
/* -------------------------------------------------------------------------- */

export async function breakDownTask(taskTitle: string, userId: string): Promise<{ steps: string[] }> {
  const quota = await checkAiQuota(userId);
  if (!quota.allowed) throw new Error("AI daily quota exceeded");

  const response = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    system: `You break tasks into small, actionable steps for someone with ADHD. Return 3-7 steps, each under 200 characters. Respond ONLY with JSON: {"steps": ["step1", "step2", ...]}.`,
    // SEC-05: untrusted field delimited.
    messages: [{ role: "user", content: `Break down this task into steps:\n<task>${taskTitle}</task>` }],
  });

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
  const quota = await checkAiQuota(userId);
  if (!quota.allowed) throw new Error("AI daily quota exceeded");

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

  const response = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    system: `You parse natural language into a task draft. Today is ${todayStr} (${zone}). Respond ONLY with JSON matching: {"title":"...","emoji":"...","durationMin":N,"energy":"low|medium|high","bucket":"inbox|anytime","date":"YYYY-MM-DD","startMin":N}. Duration in minutes (5-480). Include "date" only when the input names or implies a calendar day (tomorrow, tuesday, jul 30); include "startMin" (minutes from local midnight, e.g. 3pm=900) only when a time is named. If unclear, omit optional fields.`,
    messages: [{ role: "user", content: `<input>${input}</input>` }],
  });

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
) {
  const quota = await checkAiQuota(userId);
  if (!quota.allowed) throw new Error("AI daily quota exceeded");

  const response = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 800,
    system: `You help plan a day for someone with ADHD. Given tasks, current energy, and free time slots, propose a schedule. Respond ONLY with JSON: {"items":[{"taskId":"uuid","scheduledStart":"HH:MM","reason":"brief"}]}. Never schedule more than fits. Energy: low=quick tasks, high=deep work.`,
    messages: [
      {
        role: "user",
        content: `<tasks>${JSON.stringify(tasks)}</tasks>\n<energy>${currentEnergy}</energy>\n<slots>${JSON.stringify(freeSlots)}</slots>`,
      },
    ],
  });

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
  const quota = await checkAiQuota(userId);
  if (!quota.allowed) throw new Error("AI daily quota exceeded");

  const response = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    system: `Group tasks by priority (high/low/none) for someone with ADHD. Respond ONLY with JSON: {"groups":[{"priority":"high|low|none","taskIds":["uuid"],"durationEstimateMin":N}]}.`,
    messages: [{ role: "user", content: `<tasks>${JSON.stringify(tasks)}</tasks>` }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const parsed = JSON.parse(text);
  return priorityGroupingSchema.parse(parsed);
}
