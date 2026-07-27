"use client";

/**
 * Today timeline wrapper — bridges the Server Component's data with the
 * interactive TimelineCanvas. Handles optimistic mutations via /api/v1.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TimelineCanvas } from "./TimelineCanvas";
import type { Activity } from "@/lib/mock";
import { localMinutesToInstant } from "@/lib/adapters";
import { toast } from "./Toast";
import { notifyDayChanged } from "./NowBar";
import { useLowBattery } from "./LowBattery";
import { enqueueMutation, resolveQueueUser } from "@/lib/offline-queue";

interface TodayTimelineProps {
  activities: Activity[];
  date: string;
  zone: string;
  /** Minutes from midnight for "now" styling; live line when isToday. */
  nowMin: number;
  isToday: boolean;
  authed: boolean;
}

export function TodayTimeline({
  activities,
  date,
  zone,
  nowMin,
  isToday,
  authed,
}: TodayTimelineProps) {
  const router = useRouter();
  const lowBattery = useLowBattery(date);

  // Done-state toggled while offline, shown until the queue replays it and the
  // server re-render takes over (T13 / ADR-002 rebase-on-replay).
  const [offlineDone, setOfflineDone] = useState<Record<string, boolean>>({});

  // Focus-session calibration ratio (T12) — same source the editor hint reads.
  // Progressive enhancement: blocks render immediately, the "usually ~Xm"
  // labels appear once Stats answers.
  const [estimateRatio, setEstimateRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!authed) return;
    // Localhost-only debug override, matching the ?ritualDebug precedent —
    // the real signal needs ≥5 qualifying focus sessions, which a fresh QA
    // account never has.
    if (window.location.hostname === "localhost") {
      const p = new URLSearchParams(window.location.search).get("calibrationDebug");
      const forced = p ? Number(p) : NaN;
      if (Number.isFinite(forced) && forced > 0) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setEstimateRatio(forced);
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    }
    let cancelled = false;
    fetch("/api/v1/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const ratio = data?.estimate?.ratio;
        if (!cancelled && typeof ratio === "number") setEstimateRatio(ratio);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authed]);

  useEffect(() => {
    const onDrained = () => {
      setOfflineDone({});
      router.refresh();
      notifyDayChanged();
    };
    window.addEventListener("kairo:queue-drained", onDrained);
    return () => window.removeEventListener("kairo:queue-drained", onDrained);
  }, [router]);

  const handleUpdateActivity = useCallback(
    async (id: string, start: number, duration: number): Promise<{ ok: boolean }> => {
      if (!authed) return { ok: false };
      try {
        const act = activities.find((a) => a.id === id);
        let revision = act?.revision;

        if (revision == null) {
          const getRes = await fetch(`/api/v1/activities/${id}`);
          if (!getRes.ok) return { ok: false };
          const activity = await getRes.json();
          revision = activity.revision;
        }

        const dtstartLocal = localMinutesToInstant(date, start, zone);
        const occurrenceKey = act?.occurrenceKey;
        // Prefer occurrence override so drag/resize only moves this instance
        // for recurring series (safer than rewriting the master).
        const editScope = occurrenceKey ? "this" : "all";

        const patchRes = await fetch(`/api/v1/activities/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(revision),
          },
          body: JSON.stringify(
            editScope === "this"
              ? {
                  editScope,
                  occurrenceKey,
                  startAt: dtstartLocal,
                  durationMin: duration,
                }
              : {
                  editScope,
                  dtstartLocal,
                  durationMin: duration,
                },
          ),
        });

        if (patchRes.status === 409) {
          toast("Someone else just touched this — refresh to see the latest");
          return { ok: false };
        }
        if (!patchRes.ok) return { ok: false };
        toast("Saved");
        router.refresh();
        notifyDayChanged();
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    [activities, date, zone, authed, router],
  );

  const handleCreateActivity = useCallback(
    (start: number) => {
      const params = new URLSearchParams({
        start: String(start),
        date,
      });
      router.push(`/app/editor?${params}`);
    },
    [date, router],
  );

  const handleComplete = useCallback(
    async (id: string): Promise<{ ok: boolean }> => {
      if (!authed) return { ok: false };
      try {
        const act = activities.find((a) => a.id === id);
        const occurrenceKey = act?.occurrenceKey;
        const currentDone = offlineDone[id] ?? act?.done ?? false;
        const nextStatus = currentDone ? "pending" : "completed";

        // Offline (T13): a status flip is the one edit that's safe to replay —
        // it touches nothing else, so the queue re-reads the revision on
        // reconnect (rebase-on-replay) and can't clobber a concurrent edit.
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const queueUser = resolveQueueUser(null);
          const queued = queueUser
            ? await enqueueMutation(queueUser, {
                method: "PATCH",
                path: `/api/v1/activities/${id}`,
                rebasePath: `/api/v1/activities/${id}`,
                body: {
                  editScope: "this",
                  occurrenceKey,
                  status: nextStatus,
                  completedAt:
                    nextStatus === "completed" ? new Date().toISOString() : null,
                },
                idempotencyKey: crypto.randomUUID(),
              })
            : null;
          if (!queued) return { ok: false };
          setOfflineDone((prev) => ({ ...prev, [id]: nextStatus === "completed" }));
          toast(
            nextStatus === "completed"
              ? "Done — saved on this device, syncs when you're back"
              : "Restored — syncs when you're back",
          );
          return { ok: true };
        }

        let revision = act?.revision;
        if (revision == null) {
          const getRes = await fetch(`/api/v1/activities/${id}`);
          if (!getRes.ok) return { ok: false };
          revision = (await getRes.json()).revision;
        }

        const res = await fetch(`/api/v1/activities/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(revision),
          },
          body: JSON.stringify({
            editScope: "this",
            occurrenceKey,
            status: nextStatus,
            completedAt:
              nextStatus === "completed" ? new Date().toISOString() : null,
          }),
        });
        if (!res.ok) return { ok: false };
        toast(nextStatus === "completed" ? "Nice — marked done" : "Restored");
        router.refresh();
        notifyDayChanged();
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    [activities, authed, router, offlineDone],
  );

  const handleToggleStep = useCallback(
    async (id: string, stepIndex: number): Promise<{ ok: boolean }> => {
      if (!authed) return { ok: false };
      try {
        const act = activities.find((a) => a.id === id);
        if (!act?.checklist || !act.checklist[stepIndex]) return { ok: false };

        let revision = act.revision;
        if (revision == null) {
          const getRes = await fetch(`/api/v1/activities/${id}`);
          if (!getRes.ok) return { ok: false };
          revision = (await getRes.json()).revision;
        }

        const checklistOverride = act.checklist.map((c, i) => ({
          label: c.label,
          done: i === stepIndex ? !c.done : c.done,
        }));

        const res = await fetch(`/api/v1/activities/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(revision),
          },
          body: JSON.stringify({
            editScope: "this",
            occurrenceKey: act.occurrenceKey ?? undefined,
            checklistOverride,
          }),
        });
        if (res.status === 409) {
          toast("Someone else just touched this — refresh to see the latest");
          return { ok: false };
        }
        if (!res.ok) return { ok: false };
        router.refresh();
        notifyDayChanged();
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    [activities, authed, router],
  );

  const handleOpen = useCallback(
    (id: string) => {
      router.push(`/app/editor?id=${id}&date=${date}`);
    },
    [router, date],
  );

  const handleFocus = useCallback(
    (id: string) => {
      const act = activities.find((a) => a.id === id);
      if (!act) return;
      const params = new URLSearchParams({
        title: act.title,
        emoji: act.emoji,
        duration: String(act.duration),
        activityId: act.id,
        ...(act.occurrenceKey ? { occurrenceKey: act.occurrenceKey } : {}),
      });
      router.push(`/app/focus?${params}`);
    },
    [activities, router],
  );

  const shownActivities = useMemo(
    () =>
      Object.keys(offlineDone).length === 0
        ? activities
        : activities.map((a) =>
            offlineDone[a.id] == null ? a : { ...a, done: offlineDone[a.id] },
          ),
    [activities, offlineDone],
  );

  return (
    <TimelineCanvas
      activities={shownActivities}
      lowBattery={lowBattery}
      nowMin={nowMin}
      showNowLine={isToday}
      zone={zone}
      onUpdateActivity={handleUpdateActivity}
      onCreateActivity={handleCreateActivity}
      onComplete={authed ? handleComplete : undefined}
      onOpen={handleOpen}
      onFocus={handleFocus}
      onToggleStep={authed ? handleToggleStep : undefined}
      estimateRatio={estimateRatio}
    />
  );
}
