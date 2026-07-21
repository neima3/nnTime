"use client";

/**
 * Activity editor sheet — create / edit (10× Phase 2).
 * Design reference: /app/editor mock. Tokens only; Soft Focus system.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Flag,
  Plus,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { localMinutesToInstant } from "@/lib/adapters";
import { clientToday } from "@/lib/client-date";

const CATEGORY_UI = [
  { key: "peach", fill: "bg-cat-peach", ink: "text-cat-peach-ink", label: "Life" },
  { key: "butter", fill: "bg-cat-butter", ink: "text-cat-butter-ink", label: "Morning" },
  { key: "mint", fill: "bg-cat-mint", ink: "text-cat-mint-ink", label: "Body" },
  { key: "sky", fill: "bg-cat-sky", ink: "text-cat-sky-ink", label: "Work" },
  { key: "lilac", fill: "bg-cat-lilac", ink: "text-cat-lilac-ink", label: "Deep" },
  { key: "rose", fill: "bg-cat-rose", ink: "text-cat-rose-ink", label: "People" },
] as const;

const EMOJI_PRESETS = ["📋", "💊", "🎨", "🚶", "🍜", "🏋️", "📞", "☕", "📚", "🧠", "🧹", "✨"];

type CategoryRow = { id: string; key: string; label: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </p>
      {children}
    </div>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/* ---- Recurrence (Phase 1 wave 2): five friendly repeat choices ---------- */

type RepeatKind = "none" | "daily" | "weekdays" | "weekly" | "everyN" | "custom";

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const WEEKDAY_RULE = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";

/** Weekday label ("Saturday") for a YYYY-MM-DD calendar date. */
function weekdayOf(dateStr: string): { code: string; label: string } {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    code: BYDAY[d.getDay()] ?? "MO",
    label: d.toLocaleDateString("en-US", { weekday: "long" }),
  };
}

function buildRrule(kind: RepeatKind, dateStr: string, n: number): string | null {
  switch (kind) {
    case "daily":
      return "FREQ=DAILY";
    case "weekdays":
      return WEEKDAY_RULE;
    case "weekly":
      return `FREQ=WEEKLY;BYDAY=${weekdayOf(dateStr).code}`;
    case "everyN":
      return `FREQ=DAILY;INTERVAL=${n}`;
    default:
      return null;
  }
}

/** Map an existing RRULE back onto the chip row (unknown shapes → custom). */
function parseRrule(rrule: string | null | undefined): {
  kind: RepeatKind;
  n: number;
} {
  if (!rrule) return { kind: "none", n: 2 };
  const r = rrule.toUpperCase();
  if (r === WEEKDAY_RULE) return { kind: "weekdays", n: 2 };
  const interval = /INTERVAL=(\d+)/.exec(r);
  if (r.startsWith("FREQ=DAILY")) {
    const n = interval ? Number(interval[1]) : 1;
    if (n <= 1) return { kind: "daily", n: 2 };
    if (n >= 2 && n <= 14 && !r.includes("BYDAY")) return { kind: "everyN", n };
    return { kind: "custom", n: 2 };
  }
  if (/^FREQ=WEEKLY;BYDAY=[A-Z]{2}$/.test(r) && !interval)
    return { kind: "weekly", n: 2 };
  return { kind: "custom", n: 2 };
}

function minutesToTimeInput(min: number) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

function timeInputToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export type ActivityEditorProps = {
  mode: "create" | "edit";
  activityId?: string;
  initialTitle?: string;
  initialEmoji?: string;
  initialCategoryKey?: string;
  initialDate?: string;
  initialStartMin?: number;
  initialDurationMin?: number;
  initialEnergy?: "low" | "medium" | "high" | null;
  initialPriority?: "none" | "low" | "high";
  initialNotes?: string;
  initialSteps?: string[];
  initialRevision?: number;
  initialOccurrenceKey?: string;
  timezone?: string;
  /** When embedded without full page chrome */
  onClose?: () => void;
};

export function ActivityEditor(props: ActivityEditorProps) {
  const router = useRouter();
  const todayStr = useMemo(() => clientToday(), []);

  const [title, setTitle] = useState(props.initialTitle ?? "");
  const [emoji, setEmoji] = useState(props.initialEmoji ?? "📋");
  const [categoryKey, setCategoryKey] = useState(props.initialCategoryKey ?? "sky");
  const [date, setDate] = useState(props.initialDate ?? todayStr);
  const [startMin, setStartMin] = useState(props.initialStartMin ?? 9 * 60);
  const [durationMin, setDurationMin] = useState(props.initialDurationMin ?? 45);
  const [energy, setEnergy] = useState<"low" | "medium" | "high" | null>(
    props.initialEnergy ?? null,
  );
  const [priority, setPriority] = useState<"none" | "low" | "high">(
    props.initialPriority ?? "none",
  );
  const [notes, setNotes] = useState(props.initialNotes ?? "");
  const [steps, setSteps] = useState<string[]>(props.initialSteps ?? []);
  const [stepDraft, setStepDraft] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [tz, setTz] = useState(
    props.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [revision, setRevision] = useState(props.initialRevision);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [estimateRatio, setEstimateRatio] = useState<number | null>(null);
  const [repeat, setRepeat] = useState<RepeatKind>("none");
  const [repeatN, setRepeatN] = useState(2);
  /** Preserved verbatim when the existing rule doesn't fit the chip row. */
  const [customRrule, setCustomRrule] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/stats?days=14")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.estimate) return;
        const ratio = data.estimate.ratio as number;
        if (ratio >= 1.3) setEstimateRatio(ratio);
      })
      .catch(() => {
        /* silent — hint is a nice-to-have, never blocks editing */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catRes, setRes] = await Promise.all([
          fetch("/api/v1/categories"),
          fetch("/api/v1/settings"),
        ]);
        if (catRes.ok) {
          const data = await catRes.json();
          if (!cancelled) setCategories(data.items ?? []);
        }
        if (setRes.ok) {
          const s = await setRes.json();
          if (!cancelled && s.timezone) setTz(s.timezone);
        }
      } catch {
        /* logged-out / offline — create will 401 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load existing activity when editing without prefilled props.
  useEffect(() => {
    if (props.mode !== "edit" || !props.activityId) return;
    if (props.initialTitle) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/v1/activities/${props.activityId}`);
      if (!res.ok || cancelled) return;
      const a = await res.json();
      if (cancelled) return;
      setTitle(a.title ?? "");
      setEmoji(a.emoji ?? "📋");
      setDurationMin(a.durationMin ?? 45);
      setEnergy(a.energy ?? null);
      setPriority(a.priority ?? "none");
      setNotes(a.notes ?? "");
      setRevision(a.revision);
      setTz(a.tz ?? tz);
      const parsed = parseRrule(a.rrule);
      setRepeat(parsed.kind);
      setRepeatN(parsed.n);
      setCustomRrule(parsed.kind === "custom" ? a.rrule : null);
      if (Array.isArray(a.checklistTemplate)) {
        setSteps(
          a.checklistTemplate.map((x: { label?: string } | string) =>
            typeof x === "string" ? x : String(x?.label ?? ""),
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.mode, props.activityId, props.initialTitle, tz]);

  const categoryId = useMemo(() => {
    const row = categories.find((c) => c.key === categoryKey);
    return row?.id;
  }, [categories, categoryKey]);

  const close = useCallback(() => {
    if (props.onClose) props.onClose();
    else router.push(`/app/today?date=${date}`);
  }, [props, router, date]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const save = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give this activity a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dtstartLocal = localMinutesToInstant(date, startMin, tz);
      const checklistTemplate = steps
        .filter(Boolean)
        .map((label) => ({ label, done: false }));
      const rrule =
        repeat === "custom" ? customRrule : buildRrule(repeat, date, repeatN);

      if (props.mode === "create") {
        const res = await fetch("/api/v1/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tz,
            dtstartLocal,
            rrule,
            title: trimmed,
            emoji,
            categoryId,
            durationMin,
            energy,
            priority,
            notes: notes || undefined,
            checklistTemplate: checklistTemplate.length
              ? checklistTemplate
              : undefined,
            source: "manual",
          }),
        });
        if (res.status === 401) {
          setError("Sign in to save activities.");
          setSaving(false);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error?.message ?? "Could not create activity.");
          setSaving(false);
          return;
        }
      } else {
        if (!props.activityId || revision == null) {
          setError("Missing activity revision — refresh and try again.");
          setSaving(false);
          return;
        }
        const res = await fetch(`/api/v1/activities/${props.activityId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(revision),
          },
          body: JSON.stringify({
            editScope: "all",
            tz,
            dtstartLocal,
            rrule,
            title: trimmed,
            emoji,
            categoryId: categoryId ?? null,
            durationMin,
            energy,
            priority,
            notes: notes || null,
            checklistTemplate,
          }),
        });
        if (res.status === 409) {
          setError("Someone else changed this — refresh and try again.");
          setSaving(false);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error?.message ?? "Could not save activity.");
          setSaving(false);
          return;
        }
      }

      router.push(`/app/today?date=${date}`);
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setSaving(false);
    }
  }, [
    title,
    date,
    startMin,
    tz,
    steps,
    props.mode,
    props.activityId,
    emoji,
    categoryId,
    durationMin,
    energy,
    priority,
    notes,
    revision,
    router,
    repeat,
    repeatN,
    customRrule,
  ]);

  const remove = useCallback(async () => {
    if (props.mode !== "edit" || !props.activityId || revision == null) return;
    if (!confirm("Delete this activity?")) return;
    setSaving(true);
    const res = await fetch(`/api/v1/activities/${props.activityId}`, {
      method: "DELETE",
      headers: { "If-Match": String(revision) },
    });
    if (!res.ok && res.status !== 204) {
      setError("Could not delete.");
      setSaving(false);
      return;
    }
    router.push(`/app/today?date=${date}`);
    router.refresh();
  }, [props.mode, props.activityId, revision, router, date]);

  return (
    <div className="relative flex min-h-dvh items-end bg-surface-sunken/60 md:block md:px-4 md:py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-editor-title"
        className="sheet-up mx-auto max-h-[94dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border border-border bg-surface shadow-float md:max-h-none md:overflow-hidden md:rounded-3xl"
      >
        <div className="flex justify-center pt-2.5 md:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-center justify-between px-6 pt-4">
          <h1 id="activity-editor-title" className="font-display text-xl font-bold">
            {props.mode === "create" ? "New activity" : "Edit activity"}
          </h1>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                aria-label="Change icon"
                onClick={() => setShowEmoji((v) => !v)}
                className="grid size-14 shrink-0 place-items-center rounded-2xl bg-cat-sky text-2xl shadow-card transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
              >
                {emoji}
              </button>
              {showEmoji && (
                <div className="absolute left-0 top-16 z-20 grid grid-cols-6 gap-1 rounded-2xl border border-border bg-surface p-2 shadow-float">
                  {EMOJI_PRESETS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="grid size-9 place-items-center rounded-lg text-lg hover:bg-surface-sunken"
                      onClick={() => {
                        setEmoji(e);
                        setShowEmoji(false);
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you doing?"
              className="w-full rounded-2xl border border-border bg-surface-raised px-4 py-3.5 text-[17px] font-semibold outline-none focus:ring-2 focus:ring-iris"
              autoFocus
            />
          </div>

          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_UI.map((c) => {
                const selected = c.key === categoryKey;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategoryKey(c.key)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all ${c.fill} ${c.ink} ${
                      selected
                        ? "ring-2 ring-iris ring-offset-2 ring-offset-surface"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    {selected && <Check size={13} strokeWidth={3} />}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="When">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-[14px] font-semibold text-ink"
              />
              <input
                type="time"
                value={minutesToTimeInput(startMin)}
                onChange={(e) => setStartMin(timeInputToMinutes(e.target.value))}
                className="tnum rounded-xl border border-border bg-surface px-3 py-2 text-[14px] font-semibold text-ink"
              />
              <span className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-2 py-1">
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={durationMin}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setDurationMin(Math.max(5, Math.min(480, v)));
                  }}
                  aria-label="Duration in minutes"
                  className="tnum w-14 bg-transparent py-1 text-right text-[14px] font-semibold text-ink outline-none"
                />
                <span className="text-[13px] font-medium text-ink-soft">min</span>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {/* Zero-decision helpers: start-time + duration one-taps. */}
              {(
                [
                  {
                    label: "Now",
                    apply: () => {
                      setDate(clientToday());
                      const nowM = new Date().getHours() * 60 + new Date().getMinutes();
                      setStartMin(Math.min(1425, Math.ceil(nowM / 15) * 15));
                    },
                  },
                  {
                    label: "+30 min",
                    apply: () => {
                      setDate(clientToday());
                      const nowM = new Date().getHours() * 60 + new Date().getMinutes() + 30;
                      setStartMin(Math.min(1425, Math.ceil(nowM / 15) * 15));
                    },
                  },
                  { label: "Tonight 20:00", apply: () => setStartMin(20 * 60) },
                ] as { label: string; apply: () => void }[]
              ).map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={c.apply}
                  className="rounded-lg bg-surface-sunken px-2.5 py-1 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-iris-ghost hover:text-iris"
                >
                  {c.label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-border" aria-hidden />
              {[15, 25, 45, 60, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={durationMin === d}
                  onClick={() => setDurationMin(d)}
                  className={`tnum rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                    durationMin === d
                      ? "bg-iris-soft text-iris"
                      : "bg-surface-sunken text-ink-soft hover:text-ink"
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
            {estimateRatio != null && (
              <p className="mt-1.5 text-[12px] text-ink-faint">
                Similar plans usually run ~×{estimateRatio} longer than expected
              </p>
            )}
          </Field>

          <Field label="Repeats">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { kind: "none" as const, label: "Doesn't repeat" },
                  { kind: "daily" as const, label: "Daily" },
                  { kind: "weekdays" as const, label: "Weekdays" },
                  {
                    kind: "weekly" as const,
                    label: `Weekly on ${weekdayOf(date).label}`,
                  },
                  { kind: "everyN" as const, label: "Every N days" },
                ] as { kind: RepeatKind; label: string }[]
              ).map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={repeat === kind}
                  onClick={() => setRepeat(kind)}
                  className={`rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
                    repeat === kind
                      ? "border-iris bg-iris-soft text-iris"
                      : "border-border bg-surface text-ink-soft hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
              {repeat === "custom" && (
                <span className="rounded-xl border border-iris bg-iris-soft px-3 py-1.5 text-[13px] font-semibold text-iris">
                  Custom schedule (kept as-is)
                </span>
              )}
              {repeat === "everyN" && (
                <span className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-sunken px-2 py-1">
                  <button
                    type="button"
                    aria-label="Fewer days between repeats"
                    onClick={() => setRepeatN((n) => Math.max(2, n - 1))}
                    className="grid size-6 place-items-center rounded-lg text-ink-soft hover:bg-surface hover:text-ink"
                  >
                    −
                  </button>
                  <span className="tnum min-w-14 text-center text-[13px] font-semibold">
                    {repeatN} days
                  </span>
                  <button
                    type="button"
                    aria-label="More days between repeats"
                    onClick={() => setRepeatN((n) => Math.min(14, n + 1))}
                    className="grid size-6 place-items-center rounded-lg text-ink-soft hover:bg-surface hover:text-ink"
                  >
                    +
                  </button>
                </span>
              )}
            </div>
            {props.mode === "edit" && repeat !== "none" && (
              <p className="mt-1.5 text-[12px] text-ink-faint">
                Saving updates every occurrence of this activity.
              </p>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Energy">
              <div className="flex gap-1.5">
                {(["low", "medium", "high"] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEnergy(energy === e ? null : e)}
                    className={`flex-1 whitespace-nowrap rounded-xl px-2 py-2 text-[13px] font-semibold capitalize transition-colors ${
                      energy === e
                        ? "bg-iris text-ink-inverse"
                        : "border border-border bg-surface text-ink-soft"
                    }`}
                  >
                    <Zap size={13} className="mr-1 inline" />
                    {e}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Priority">
              <div className="flex gap-1.5">
                {(["none", "low", "high"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 rounded-xl px-2 py-2 text-[13px] font-semibold capitalize transition-colors ${
                      priority === p
                        ? "bg-iris text-ink-inverse"
                        : "border border-border bg-surface text-ink-soft"
                    }`}
                  >
                    {p !== "none" && (
                      <Flag size={12} className="mr-1 inline" fill="currentColor" />
                    )}
                    {p}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Steps">
            <div className="space-y-1.5">
              {steps.map((s, i) => (
                <div
                  key={`${s}-${i}`}
                  className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-2"
                >
                  <span className="grid size-5 place-items-center rounded-full border-2 border-border-strong" />
                  <span className="flex-1 text-[14px] font-medium">{s}</span>
                  <button
                    type="button"
                    aria-label="Remove step"
                    className="text-ink-faint hover:text-danger"
                    onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={stepDraft}
                  onChange={(e) => setStepDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && stepDraft.trim()) {
                      e.preventDefault();
                      setSteps((prev) => [...prev, stepDraft.trim()]);
                      setStepDraft("");
                    }
                  }}
                  placeholder="Add a step…"
                  className="flex-1 rounded-xl border border-dashed border-border-strong px-3 py-2 text-[13px] font-semibold outline-none focus:ring-2 focus:ring-iris"
                />
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-ink-soft hover:text-ink"
                  onClick={() => {
                    if (!stepDraft.trim()) return;
                    setSteps((prev) => [...prev, stepDraft.trim()]);
                    setStepDraft("");
                  }}
                >
                  <Plus size={14} />
                  Add
                </button>
                <button
                  type="button"
                  title="AI suggests steps — you confirm each one"
                  disabled={saving || !title.trim()}
                  onClick={async () => {
                    setError(null);
                    setSaving(true);
                    try {
                      const res = await fetch("/api/v1/ai/breakdown", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: title.trim() }),
                      });
                      const data = await res.json().catch(() => null);
                      if (!res.ok) {
                        setError(
                          data?.error?.message ??
                            "AI unavailable — add steps manually.",
                        );
                        setSaving(false);
                        return;
                      }
                      const next = (data?.steps as string[] | undefined) ?? [];
                      if (next.length) {
                        setSteps((prev) => [...prev, ...next.filter(Boolean)]);
                      }
                    } catch {
                      setError("Couldn't reach the AI — add steps by hand for now.");
                    }
                    setSaving(false);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-iris-soft px-3 py-2 text-[13px] font-semibold text-iris transition-colors hover:bg-iris-ghost disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  Break it down
                </button>
              </div>
            </div>
          </Field>

          <Field label="Notes">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything future-you should know…"
              className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-iris"
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border bg-surface-raised px-6 py-4">
          {props.mode === "edit" && (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-danger hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              <Trash2 size={15} />
              Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-iris px-6 py-2.5 text-[14px] font-semibold text-ink-inverse shadow-card transition-colors hover:bg-iris-deep disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
