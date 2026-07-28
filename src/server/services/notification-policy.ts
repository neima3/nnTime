export type NotificationType =
  | "start"
  | "halfway"
  | "wrap-up"
  | "review-today"
  | "weekly-review";

export interface CandidateFire {
  type: NotificationType;
  fireAt: Date;
  expiresAt: Date;
}

export interface NotificationPushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

const MINUTE_MS = 60_000;
const PREF_KEY = {
  start: "startNudges",
  halfway: "halfwayNudges",
  "wrap-up": "wrapUpNudges",
  "review-today": "reviewTodayNudges",
  "weekly-review": "weeklyReviewNudges",
} as const satisfies Record<NotificationType, string>;

export function activityFireTimes(
  startAt: Date,
  durationMin: number,
): CandidateFire[] {
  const duration =
    Number.isFinite(durationMin) && durationMin > 0 ? durationMin : 1;
  const halfwayAt = new Date(startAt.getTime() + (duration * MINUTE_MS) / 2);
  const candidates: CandidateFire[] = [
    {
      type: "start",
      fireAt: new Date(startAt),
      expiresAt: new Date(startAt.getTime() + 30 * MINUTE_MS),
    },
    {
      type: "halfway",
      fireAt: halfwayAt,
      expiresAt: new Date(halfwayAt.getTime() + 45 * MINUTE_MS),
    },
  ];

  if (duration > 10) {
    const wrapUpAt = new Date(
      startAt.getTime() + (duration - 5) * MINUTE_MS,
    );
    candidates.push({
      type: "wrap-up",
      fireAt: wrapUpAt,
      expiresAt: new Date(wrapUpAt.getTime() + 45 * MINUTE_MS),
    });
  }

  return candidates;
}

export function notificationTypeEnabled(
  prefs: unknown,
  type: NotificationType,
): boolean {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return true;
  return (prefs as Record<string, unknown>)[PREF_KEY[type]] !== false;
}

export function retryDelayMs(attempt: number): number {
  const normalized = Math.max(1, Math.floor(attempt));
  return [1, 5, 15, 30][Math.min(normalized - 1, 3)] * MINUTE_MS;
}

export function activityDedupKey(input: {
  userId: string;
  seriesId: string;
  occurrenceKey: Date;
  type: NotificationType;
  fireAt: Date;
}): string {
  return [
    input.userId,
    "activity",
    input.seriesId,
    input.occurrenceKey.toISOString(),
    input.type,
    input.fireAt.toISOString(),
  ].join(":");
}

export function buildPushPayload(
  type: NotificationType,
  input: { title?: string; emoji?: string; entityId?: string },
): NotificationPushPayload {
  const title = input.title?.trim() || "Next activity";
  const entityId = input.entityId?.trim() || "activity";

  switch (type) {
    case "start":
      return {
        title: `${input.emoji?.trim() || "⏰"} ${title}`,
        body: "Starting now — no rush, just a nudge.",
        tag: `start-${entityId}`,
        url: "/app/today",
      };
    case "halfway":
      return {
        title: `Halfway through ${title}`,
        body: "A gentle check-in — keep going or adjust the plan.",
        tag: `halfway-${entityId}`,
        url: "/app/today",
      };
    case "wrap-up":
      return {
        title: `${title} is wrapping up`,
        body: "About five minutes left — finish softly or extend.",
        tag: `wrap-up-${entityId}`,
        url: "/app/focus",
      };
    case "review-today":
      return {
        title: "Review today",
        body: "A quiet moment to close the loop on your day.",
        tag: "review-today",
        url: "/app/review",
      };
    case "weekly-review":
      return {
        title: "Weekly review",
        body: "Notice what worked and shape a gentler week ahead.",
        tag: "weekly-review",
        url: "/app/week",
      };
  }
}
