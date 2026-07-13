"use client";

/**
 * Today timeline wrapper — bridges the Server Component's data with the
 * interactive TimelineCanvas (Phase 2C). Handles optimistic mutations via
 * fetch calls to the /api/v1/tasks and /api/v1/activities endpoints.
 */

import { useCallback } from "react";
import { TimelineCanvas } from "./TimelineCanvas";
import type { Activity } from "@/lib/mock";
import { NOW_MIN } from "@/lib/mock";

interface TodayTimelineProps {
  activities: Activity[];
}

export function TodayTimeline({ activities }: TodayTimelineProps) {
  const handleUpdateActivity = useCallback(
    async (id: string, start: number, duration: number): Promise<{ ok: boolean }> => {
      try {
        // For 2C: activities are activity_series rows. The PATCH endpoint with
        // edit-scope is Phase 2A — here we update the dtstartLocal (start time)
        // and durationMin. We need the current revision for If-Match.
        // First, GET the activity to get its revision.
        const getRes = await fetch(`/api/v1/activities/${id}`);
        if (!getRes.ok) return { ok: false };
        const activity = await getRes.json();
        const revision = activity.revision;

        // Convert minutes-from-midnight back to a UTC instant (today's date).
        const today = new Date();
        const dtstartLocal = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          Math.floor(start / 60),
          start % 60,
          0,
        );

        const patchRes = await fetch(`/api/v1/activities/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(revision),
          },
          body: JSON.stringify({
            dtstartLocal: dtstartLocal.toISOString(),
            durationMin: duration,
            editScope: "all",
          }),
        });

        if (patchRes.status === 409) return { ok: false }; // conflict
        if (!patchRes.ok) return { ok: false };
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    [],
  );

  const handleCreateActivity = useCallback((start: number) => {
    // For 2C: tapping an empty slot opens the editor (Phase 1D's editor sheet).
    // For now, navigate to the editor with query params.
    const params = new URLSearchParams({ start: String(start), date: new Date().toISOString().slice(0, 10) });
    window.location.href = `/app/editor?${params}`;
  }, []);

  return (
    <TimelineCanvas
      activities={activities}
      nowMin={NOW_MIN}
      onUpdateActivity={handleUpdateActivity}
      onCreateActivity={handleCreateActivity}
    />
  );
}
