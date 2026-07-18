"use client";

/**
 * Timeline interactions — Phase 2C (Client Component).
 *
 * Roadmap 2C binding requirements:
 *  - Drag move / resize (15-min snap)
 *  - Tap-empty-slot create
 *  - Defined collision layout (side-by-side lanes for overlaps — design-spec addendum)
 *  - Keyboard alternative + ARIA
 *  - Optimistic writes with revision conflict handling
 *
 * This component receives the activity list + a mutation callback, handles all
 * pointer/keyboard interactions, and calls back to the server on commit.
 */

import { useCallback, useRef, useState } from "react";
import { Check, Timer } from "lucide-react";
import { catClasses, fmt, fmtDuration, type Activity } from "@/lib/mock";
import { LiveNowLine, useLiveNowMin } from "./LiveNowLine";

const DAY_START = 7 * 60; // 07:00
const DAY_END = 23 * 60; // 23:00
const PX_PER_MIN = 1.7;
const SNAP_MIN = 15; // 15-minute snap

const top = (min: number) => (min - DAY_START) * PX_PER_MIN;
const minFromY = (y: number) => Math.round((y / PX_PER_MIN + DAY_START) / SNAP_MIN) * SNAP_MIN;

interface DragState {
  id: string;
  mode: "move" | "resize-top" | "resize-bottom";
  startY: number;
  origStart: number;
  origDuration: number;
}

interface TimelineCanvasProps {
  activities: Activity[];
  nowMin: number;
  /** When false, hide the live now-line (viewing another day). */
  showNowLine?: boolean;
  onUpdateActivity: (id: string, start: number, duration: number) => Promise<{ ok: boolean }>;
  onCreateActivity?: (start: number) => void;
  onComplete?: (id: string) => Promise<{ ok: boolean }>;
  onOpen?: (id: string) => void;
  onFocus?: (id: string) => void;
}

/** Compute overlap lanes for side-by-side layout (design-spec addendum 1). */
function computeLanes(activities: Activity[]): Map<string, { lane: number; laneCount: number }> {
  const result = new Map<string, { lane: number; laneCount: number }>();
  const sorted = [...activities].sort((a, b) => a.start - b.start || b.duration - a.duration);

  // Track active intervals per lane: [{ end, ids }]
  const lanes: number[] = []; // end time of the last activity in each lane

  for (const act of sorted) {
    const actEnd = act.start + act.duration;
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] <= act.start) {
        // This lane is free; place here.
        lanes[i] = actEnd;
        result.set(act.id, { lane: i, laneCount: 0 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push(actEnd);
      result.set(act.id, { lane: lanes.length - 1, laneCount: 0 });
    }
  }

  // Count lanes per overlap group (for width calculation).
  // An overlap group is a set of activities whose time ranges intersect.
  for (const act of sorted) {
    const actEnd = act.start + act.duration;
    const overlapping = sorted.filter(
      (o) => o.id !== act.id && o.start < actEnd && o.start + o.duration > act.start,
    );
    if (overlapping.length > 0) {
      // The lane count is the max lanes in this overlap group.
      const groupIds = new Set([act.id, ...overlapping.map((o) => o.id)]);
      const groupLanes = new Set<number>();
      for (const id of groupIds) {
        const info = result.get(id);
        if (info) groupLanes.add(info.lane);
      }
      const laneCount = Math.min(groupLanes.size, 3); // max 3 lanes per addendum
      for (const id of groupIds) {
        const info = result.get(id);
        if (info) result.set(id, { ...info, laneCount: Math.max(info.laneCount, laneCount) });
      }
    }
  }

  return result;
}

export function TimelineCanvas({
  activities,
  nowMin,
  showNowLine = true,
  onUpdateActivity,
  onCreateActivity,
  onComplete,
  onOpen,
  onFocus,
}: TimelineCanvasProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [optimistic, setOptimistic] = useState<Map<string, { start: number; duration: number }>>(
    new Map(),
  );
  const [doneOptimistic, setDoneOptimistic] = useState<Map<string, boolean>>(new Map());
  const [conflictId, setConflictId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Live clock drives past/current styling when viewing today (Phase 18).
  const liveNow = useLiveNowMin(showNowLine);
  const effectiveNow = showNowLine && liveNow != null ? liveNow : nowMin;

  // Merge optimistic overrides into the activity list.
  const displayActivities = activities.map((a) => {
    const opt = optimistic.get(a.id);
    const done = doneOptimistic.has(a.id) ? doneOptimistic.get(a.id) : a.done;
    return {
      ...a,
      ...(opt ? { start: opt.start, duration: opt.duration } : {}),
      done,
    };
  });

  const lanes = computeLanes(displayActivities);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, id: string, mode: DragState["mode"], act: Activity) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({
        id,
        mode,
        startY: e.clientY,
        origStart: act.start,
        origDuration: act.duration,
      });
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const deltaY = e.clientY - drag.startY;
      const deltaMin = Math.round(deltaY / PX_PER_MIN / SNAP_MIN) * SNAP_MIN;

      if (drag.mode === "move") {
        const newStart = Math.max(
          DAY_START,
          Math.min(DAY_END - drag.origDuration, drag.origStart + deltaMin),
        );
        setOptimistic((prev) => {
          const next = new Map(prev);
          next.set(drag.id, { start: newStart, duration: drag.origDuration });
          return next;
        });
      } else if (drag.mode === "resize-bottom") {
        const newDuration = Math.max(SNAP_MIN, drag.origDuration + deltaMin);
        setOptimistic((prev) => {
          const next = new Map(prev);
          next.set(drag.id, { start: drag.origStart, duration: newDuration });
          return next;
        });
      } else if (drag.mode === "resize-top") {
        const newStart = Math.max(DAY_START, Math.min(DAY_END - SNAP_MIN, drag.origStart + deltaMin));
        const newDuration = Math.max(SNAP_MIN, drag.origDuration - deltaMin);
        setOptimistic((prev) => {
          const next = new Map(prev);
          next.set(drag.id, { start: newStart, duration: newDuration });
          return next;
        });
      }
    },
    [drag],
  );

  const handlePointerUp = useCallback(async () => {
    if (!drag) return;
    const opt = optimistic.get(drag.id);
    setDrag(null);

    if (!opt || (opt.start === drag.origStart && opt.duration === drag.origDuration)) {
      // No change.
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.delete(drag.id);
        return next;
      });
      return;
    }

    // Optimistic write: call the server mutation.
    const result = await onUpdateActivity(drag.id, opt.start, opt.duration);
    if (result.ok) {
      // Commit: clear the optimistic override (the server will refresh data).
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.delete(drag.id);
        return next;
      });
    } else {
      // Conflict: rollback the optimistic override + flash conflict indicator.
      setConflictId(drag.id);
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.delete(drag.id);
        return next;
      });
      setTimeout(() => setConflictId(null), 3000);
    }
  }, [drag, optimistic, onUpdateActivity]);

  // Keyboard: focus an activity, arrow keys to move/resize.
  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent, act: Activity) => {
      const delta = e.shiftKey ? 60 : SNAP_MIN;
      let newStart = act.start;
      let newDuration = act.duration;

      switch (e.key) {
        case "ArrowUp":
          newStart = Math.max(DAY_START, act.start - delta);
          break;
        case "ArrowDown":
          newStart = Math.min(DAY_END - act.duration, act.start + delta);
          break;
        case "ArrowUp+Shift":
        case "+":
          newDuration = act.duration + SNAP_MIN;
          break;
        case "-":
          newDuration = Math.max(SNAP_MIN, act.duration - SNAP_MIN);
          break;
        default:
          return;
      }
      e.preventDefault();
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.set(act.id, { start: newStart, duration: newDuration });
        return next;
      });
      const result = await onUpdateActivity(act.id, newStart, newDuration);
      if (!result.ok) {
        setConflictId(act.id);
        setTimeout(() => setConflictId(null), 3000);
      }
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.delete(act.id);
        return next;
      });
    },
    [onUpdateActivity],
  );

  // Tap empty slot to create.
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== containerRef.current) return;
      if (!onCreateActivity) return;
      const rect = containerRef.current!.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const startMin = minFromY(y);
      if (startMin >= DAY_START && startMin < DAY_END) {
        onCreateActivity(startMin);
      }
    },
    [onCreateActivity],
  );

  return (
    <div
      ref={containerRef}
      className="relative cursor-crosshair"
      style={{ height: (DAY_END - DAY_START) * PX_PER_MIN }}
      onClick={handleContainerClick}
    >
      {/* Hour grid */}
      {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START / 60 + i).map(
        (h) => (
          <div
            key={h}
            className="absolute inset-x-0 flex items-start gap-3"
            style={{ top: top(h * 60) }}
          >
            <span className="tnum w-10 -translate-y-1/2 text-right text-[12px] font-medium text-ink-faint">
              {h}:00
            </span>
            <div className="mt-px h-px flex-1 bg-border" />
          </div>
        ),
      )}

      {/* Now line — live only when viewing today */}
      {showNowLine && liveNow != null && <LiveNowLine nowMin={liveNow} />}

      {/* Activities */}
      <div
        className="absolute inset-y-0 left-14 right-1"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {displayActivities.map((a) => {
          const cat = catClasses[a.category];
          const past = a.start + a.duration <= effectiveNow;
          const current =
            showNowLine &&
            a.start <= effectiveNow &&
            effectiveNow < a.start + a.duration;
          const h = a.duration * PX_PER_MIN;
          const compact = h < 76;
          // Checklist lines only when the block is tall enough to hold them.
          const checklistRows = compact
            ? 0
            : Math.max(0, Math.min(3, Math.floor((h - 72) / 18)));
          const laneInfo = lanes.get(a.id);
          const lane = laneInfo?.lane ?? 0;
          const laneCount = laneInfo?.laneCount ?? 0;
          const widthPct = laneCount > 1 ? `calc(${100 / laneCount}% - 3px)` : "100%";
          const leftPct = laneCount > 1 ? `${(lane * 100) / laneCount}%` : "0";
          const hasConflict = conflictId === a.id;

          return (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              aria-label={`${a.title}, ${fmt(a.start)} to ${fmt(a.start + a.duration)}, ${fmtDuration(a.duration)}. Use arrow keys to move, plus or minus to resize. Enter to edit.`}
              aria-keyshortcuts="ArrowUp ArrowDown + - Enter"
              className={`group absolute flex gap-3 overflow-hidden rounded-2xl px-3.5 outline-none transition-transform hover:-translate-y-px hover:shadow-card focus-visible:ring-2 focus-visible:ring-iris ${cat.fill} ${
                past && !a.done ? "opacity-55 saturate-50" : ""
              } ${a.done ? "opacity-70" : ""} ${current ? "shadow-float ring-2 ring-now/70" : ""} ${
                compact ? "items-center py-1.5" : "py-3"
              } ${hasConflict ? "ring-2 ring-danger animate-pulse" : ""} cursor-grab active:cursor-grabbing`}
              style={{
                top: top(a.start),
                height: h,
                width: widthPct,
                left: leftPct,
                touchAction: "none",
              }}
              onPointerDown={(e) => handlePointerDown(e, a.id, "move", a)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && onOpen) {
                  e.preventDefault();
                  onOpen(a.id);
                  return;
                }
                handleKeyDown(e, a);
              }}
              onDoubleClick={() => onOpen?.(a.id)}
            >
              <span
                className={`grid shrink-0 place-items-center rounded-full bg-surface-raised/80 ${
                  compact ? "size-8 text-base" : "size-10 text-lg"
                }`}
                aria-hidden
              >
                {a.emoji}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate font-semibold leading-tight ${cat.ink} ${
                    compact ? "text-[14px]" : "text-[15px]"
                  } ${a.done ? "line-through decoration-2 opacity-70" : ""}`}
                >
                  {a.title}
                </p>
                <p className={`tnum mt-0.5 truncate text-[12px] font-medium ${cat.ink} opacity-70`}>
                  {fmt(a.start)} – {fmt(a.start + a.duration)} · {fmtDuration(a.duration)}
                  {a.checklist && a.checklist.length > 0
                    ? ` · ${a.checklist.filter((c) => c.done).length}/${a.checklist.length} steps`
                    : ""}
                </p>
                {checklistRows > 0 && a.checklist && a.checklist.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {a.checklist.slice(0, checklistRows).map((c, i) => (
                      <li
                        key={i}
                        className={`truncate text-[11px] font-medium ${cat.ink} opacity-60 ${
                          c.done ? "line-through" : ""
                        }`}
                      >
                        {c.done ? "✓" : "○"} {c.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {onFocus && !a.done && (
                  <button
                    type="button"
                    aria-label={`Focus on ${a.title}`}
                    className={`grid place-items-center rounded-full border-2 border-current opacity-40 hover:opacity-100 ${cat.ink} ${
                      compact ? "size-7" : "size-8"
                    }`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocus(a.id);
                    }}
                  >
                    <Timer size={14} />
                  </button>
                )}
                {onComplete && (
                  <button
                    type="button"
                    aria-label={a.done ? `Mark ${a.title} incomplete` : `Complete ${a.title}`}
                    className={`grid place-items-center rounded-full border-2 transition-colors ${
                      compact ? "size-7" : "size-8"
                    } ${
                      a.done
                        ? "border-transparent bg-success text-ink-inverse"
                        : `border-current ${cat.ink} opacity-50 hover:opacity-100 hover:bg-surface-raised/50`
                    }`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const next = !a.done;
                      setDoneOptimistic((prev) => {
                        const m = new Map(prev);
                        m.set(a.id, next);
                        return m;
                      });
                      const result = await onComplete(a.id);
                      if (!result.ok) {
                        setDoneOptimistic((prev) => {
                          const m = new Map(prev);
                          m.delete(a.id);
                          return m;
                        });
                      }
                    }}
                  >
                    {a.done && <Check size={14} strokeWidth={3} />}
                  </button>
                )}
              </div>

              {/* Resize handles (hidden on compact) */}
              {!compact && (
                <>
                  <div
                    className="absolute inset-x-0 top-0 h-2 cursor-ns-resize"
                    onPointerDown={(e) => handlePointerDown(e, a.id, "resize-top", a)}
                    aria-hidden
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                    onPointerDown={(e) => handlePointerDown(e, a.id, "resize-bottom", a)}
                    aria-hidden
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Conflict banner */}
      {conflictId && (
        <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-danger-soft px-4 py-2 text-[13px] font-semibold text-danger shadow-float">
          ⚠ Edit rolled back — someone else changed this activity. Refresh to see the latest.
        </div>
      )}
    </div>
  );
}
