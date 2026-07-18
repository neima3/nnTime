"use client";

/**
 * Today timeline wrapper — bridges the Server Component's data with the
 * interactive TimelineCanvas. Handles optimistic mutations via /api/v1.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { TimelineCanvas } from "./TimelineCanvas";
import type { Activity } from "@/lib/mock";
import { localMinutesToInstant } from "@/lib/adapters";
import { toast } from "./Toast";

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

        const patchRes = await fetch(`/api/v1/activities/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(revision),
          },
          body: JSON.stringify({
            dtstartLocal,
            durationMin: duration,
            editScope: "all",
          }),
        });

        if (patchRes.status === 409) {
          toast("Conflict — refresh and try again");
          return { ok: false };
        }
        if (!patchRes.ok) return { ok: false };
        toast("Saved");
        router.refresh();
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
        let revision = act?.revision;
        if (revision == null) {
          const getRes = await fetch(`/api/v1/activities/${id}`);
          if (!getRes.ok) return { ok: false };
          revision = (await getRes.json()).revision;
        }
        const occurrenceKey = act?.occurrenceKey;
        const nextStatus = act?.done ? "pending" : "completed";

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
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    [activities, authed, router],
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

        const checklistTemplate = act.checklist.map((c, i) => ({
          label: c.label,
          done: i === stepIndex ? !c.done : c.done,
        }));

        const res = await fetch(`/api/v1/activities/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(revision),
          },
          body: JSON.stringify({ editScope: "all", checklistTemplate }),
        });
        if (res.status === 409) {
          toast("Conflict — refresh and try again");
          return { ok: false };
        }
        if (!res.ok) return { ok: false };
        router.refresh();
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
      });
      router.push(`/app/focus?${params}`);
    },
    [activities, router],
  );

  return (
    <TimelineCanvas
      activities={activities}
      nowMin={nowMin}
      showNowLine={isToday}
      onUpdateActivity={handleUpdateActivity}
      onCreateActivity={handleCreateActivity}
      onComplete={authed ? handleComplete : undefined}
      onOpen={handleOpen}
      onFocus={handleFocus}
      onToggleStep={authed ? handleToggleStep : undefined}
    />
  );
}
