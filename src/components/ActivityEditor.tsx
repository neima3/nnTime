"use client";

/**
 * Activity editor sheet — create / edit (10× Phase 2).
 * Design reference: /app/editor mock. Tokens only; Soft Focus system.
 */

import { getStatsCached } from "@/lib/stats-cache";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { dateToMinutesFromMidnight, localMinutesToInstant } from "@/lib/adapters";
import { clientToday, instantToLocalDateStr } from "@/lib/client-date";
import { nowMinutesInZone } from "@/lib/client-now";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { sendReplaySafeCreate } from "@/lib/offline-mutation";
import {
  buildChecklistTemplate,
  normalizeEditorSteps,
  type EditorStepInput,
} from "@/lib/activity-editor-steps";
import { toast } from "./Toast";

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

/**
 * A labelled section. Pass `htmlFor` when the section wraps exactly one form
 * control so the visible caption becomes that control's accessible name.
 */
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const cls =
    "mb-1.5 block text-[12px] font-bold uppercase tracking-[0.1em] text-ink-soft";
  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={cls}>
          {label}
        </label>
      ) : (
        <p className={cls}>{label}</p>
      )}
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

/* ---- Edit scope (ADR-001) ------------------------------------------------
 *
 * A repeating activity is one series with many days on it. Saving or deleting
 * one of those days has to say which days it means, or a rename on Tuesday
 * quietly rewrites every Tuesday-and-everything-else. The three choices map
 * 1:1 onto the ADR-001 scopes; "Just this time" is always the default so the
 * safe answer is the one you get by pressing Enter.
 */
type EditScope = "this" | "this_and_future" | "all";

const SCOPE_COPY: Record<
  EditScope,
  { label: string; saveHint: string; deleteHint: string }
> = {
  this: {
    label: "Just this time",
    saveHint: "Every other day stays exactly as it is.",
    deleteHint: "It still shows up on all the other days.",
  },
  this_and_future: {
    label: "This and every one after",
    saveHint: "Days before this one stay as they are.",
    deleteHint: "Days before this one stay as they are.",
  },
  all: {
    label: "The whole series",
    saveHint: "Every day this happens, past and future.",
    deleteHint: "Removes it from every day, past and future.",
  },
};

const SCOPE_ORDER: EditScope[] = ["this", "this_and_future", "all"];

/**
 * The scope question, asked once, right before the write.
 *
 * Mobile: bottom sheet over the editor sheet. Desktop: centered card.
 * Radios (not three buttons) so arrow keys move between the choices and the
 * default choice is announced — and so a stray tap can't commit a delete.
 */
function EditScopeChooser({
  intent,
  value,
  onChange,
  onCancel,
  onConfirm,
  busy,
  scopedDisabled,
  sharedFields,
}: {
  intent: "save" | "delete";
  value: EditScope | null;
  onChange: (scope: EditScope) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  /** True when we couldn't tell which day is open, so per-day choices can't be honored. */
  scopedDisabled: boolean;
  /** Changed fields that only exist on the whole series (shown under "Just this time"). */
  sharedFields: string[];
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  useFocusTrap(panelRef, true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const isDelete = intent === "delete";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-sunken/70 p-0 backdrop-blur-[2px] md:items-center md:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-scope-title"
        aria-describedby="edit-scope-body"
        className="sheet-up max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-float md:rounded-3xl md:pb-5"
      >
        <h2
          id="edit-scope-title"
          className="font-display text-[19px] font-bold tracking-tight"
        >
          This one repeats
        </h2>
        <p id="edit-scope-body" className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
          {isDelete
            ? "Which days should it come off?"
            : "Which days should the change land on?"}
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">
            {isDelete ? "Days to remove" : "Days to change"}
          </legend>
          {SCOPE_ORDER.map((scope, i) => {
            const copy = SCOPE_COPY[scope];
            const disabled = scopedDisabled && scope !== "all";
            const selected = value === scope;
            return (
              <label
                key={scope}
                className={`relative flex min-h-[52px] cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-iris has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
                  disabled
                    ? "cursor-not-allowed border-border bg-surface-sunken opacity-55"
                    : selected
                      ? "border-iris bg-iris-soft"
                      : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                <input
                  ref={i === 0 ? firstRef : undefined}
                  type="radio"
                  name="edit-scope"
                  // Transparent, not sr-only: the whole row is the hit target
                  // (≥52px tall), so a thumb never has to find the dot.
                  className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
                  value={scope}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => onChange(scope)}
                />
                <span
                  aria-hidden
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                    selected ? "border-iris" : "border-border-strong"
                  }`}
                >
                  {selected && <span className="size-2.5 rounded-full bg-iris" />}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[15px] font-semibold ${
                      selected ? "text-iris" : "text-ink"
                    }`}
                  >
                    {copy.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-soft">
                    {isDelete ? copy.deleteHint : copy.saveHint}
                  </span>
                  {scope === "this" && !isDelete && sharedFields.length > 0 && (
                    <span className="mt-1.5 block text-[12.5px] leading-relaxed text-ink-faint">
                      {sentenceCase(joinWithAnd(sharedFields))}{" "}
                      {sharedFields.length > 1 ? "are" : "is"} shared by every
                      day, so {sharedFields.length > 1 ? "they" : "it"} won’t
                      change here.
                    </span>
                  )}
                  {disabled && (
                    <span className="mt-1.5 block text-[12.5px] leading-relaxed text-ink-faint">
                      Open it from a day to pick this.
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
          >
            Never mind
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || value === null}
            className={`min-h-11 rounded-xl px-5 py-2.5 text-[14px] font-semibold shadow-card transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
              isDelete
                ? "bg-danger-soft text-danger hover:bg-danger-soft"
                : "bg-iris text-ink-inverse hover:bg-iris-deep"
            }`}
          >
            {busy
              ? isDelete
                ? "Deleting…"
                : "Saving…"
              : isDelete
                ? "Delete"
                : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "the icon, the category and the notes" */
function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function sentenceCase(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

export type ActivityEditorProps = {
  mode: "create" | "edit";
  activityId?: string;
  sourceTaskId?: string;
  initialTitle?: string;
  initialEmoji?: string;
  initialCategoryKey?: string;
  initialCategoryId?: string;
  initialCategories?: CategoryRow[];
  initialDate?: string;
  initialStartMin?: number;
  initialDurationMin?: number;
  initialEnergy?: "low" | "medium" | "high" | null;
  initialPriority?: "none" | "low" | "high";
  initialNotes?: string;
  initialSteps?: EditorStepInput[];
  initialRevision?: number;
  /** Stable identity of the day being edited (ADR-001 occurrence_key). */
  initialOccurrenceKey?: string;
  /** Caller already knows the series repeats — lets the scope prompt render before the fetch lands. */
  initialRepeats?: boolean;
  timezone?: string;
  /** When embedded without full page chrome */
  onClose?: () => void;
};

export function ActivityEditor(props: ActivityEditorProps) {
  const router = useRouter();
  const todayStr = useMemo(() => clientToday(), []);

  const [title, setTitle] = useState(props.initialTitle ?? "");
  const [emoji, setEmoji] = useState(props.initialEmoji ?? "📋");
  /** null until the user picks a chip — lets the saved category win on load. */
  const [categoryKey, setCategoryKey] = useState<string | null>(
    props.initialCategoryKey ?? null,
  );
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
  const [steps, setSteps] = useState(() =>
    normalizeEditorSteps(props.initialSteps),
  );
  const [stepDraft, setStepDraft] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>(
    props.initialCategories ?? [],
  );
  const [tz, setTz] = useState(
    props.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [revision, setRevision] = useState(props.initialRevision);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const scheduleIdempotencyKey = useRef<string | null>(null);
  const [estimateRatio, setEstimateRatio] = useState<number | null>(null);
  const [repeat, setRepeat] = useState<RepeatKind>("none");
  const [repeatN, setRepeatN] = useState(2);
  /** Preserved verbatim when the existing rule doesn't fit the chip row. */
  const [customRrule, setCustomRrule] = useState<string | null>(null);

  /* ---- Edit scope (ADR-001) ---------------------------------------------
   * `saved` is the series as the server has it. It answers two questions the
   * prompt needs: does this activity repeat (so ask at all), and which of the
   * fields the user just changed live on the whole series rather than on the
   * single day.
   */
  const [saved, setSaved] = useState<{
    rrule: string | null;
    emoji: string;
    categoryId: string | null;
    priority: string;
    notes: string;
  } | null>(null);
  const [occurrenceKey, setOccurrenceKey] = useState<string | null>(
    props.initialOccurrenceKey ?? null,
  );
  const [seriesRepeats, setSeriesRepeats] = useState(
    props.initialRepeats ?? false,
  );
  const [scopeAsk, setScopeAsk] = useState<"save" | "delete" | null>(null);
  const [scope, setScope] = useState<EditScope | null>("this");
  /** Server truth must not overwrite anything the user already touched. */
  const timeTouched = useRef(false);
  const textTouched = useRef(false);
  const [serverCategoryId, setServerCategoryId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The estimate uses a fixed 14-day window server-side, so the 30-day
    // entry (already warm from Today) returns the identical ratio.
    getStatsCached(30)
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
      // The load lands after first paint, so anything already typed wins —
      // otherwise a fast typist watches their title get wiped.
      if (!textTouched.current) {
        setTitle(a.title ?? "");
        setNotes(a.notes ?? "");
      }
      setEmoji(a.emoji ?? "📋");
      setDurationMin(a.durationMin ?? 45);
      setEnergy(a.energy ?? null);
      setPriority(a.priority ?? "none");
      setRevision(a.revision);
      const zone: string = a.tz ?? tz;
      setTz(zone);
      const parsed = parseRrule(a.rrule);
      setRepeat(parsed.kind);
      setRepeatN(parsed.n);
      setCustomRrule(parsed.kind === "custom" ? a.rrule : null);
      if (Array.isArray(a.checklistTemplate)) {
        setSteps(normalizeEditorSteps(a.checklistTemplate));
      }
      setSaved({
        rrule: a.rrule ?? null,
        emoji: a.emoji ?? "📋",
        categoryId: a.categoryId ?? null,
        priority: a.priority ?? "none",
        notes: a.notes ?? "",
      });
      setSeriesRepeats(Boolean(a.rrule));
      if (a.categoryId) setServerCategoryId(a.categoryId as string);

      /* Which day is open?
       *
       * The URL carries it when the caller knows (Today, Week). When it
       * doesn't — a bare /app/editor?id= — resolve it from the day the user
       * came from rather than guessing: the series' own dtstartLocal is the
       * FIRST day, so a "just this time" edit would land on the wrong one.
       */
      let key = props.initialOccurrenceKey ?? null;
      let startsAt: Date | null = null;
      if (a.rrule && !key && props.initialDate) {
        const day = await fetch(
          `/api/v1/day/${props.initialDate}`,
        ).catch(() => null);
        if (day?.ok) {
          const body = await day.json().catch(() => null);
          const match = (body?.activities as { id: string; occurrenceKey: string; dtstartLocal: string }[] | undefined)
            ?.find((row) => row.id === props.activityId);
          if (match) {
            key = match.occurrenceKey;
            startsAt = new Date(match.dtstartLocal);
          }
        }
      }
      if (cancelled) return;
      if (key) setOccurrenceKey(key);

      // Show the day and time this occurrence actually sits at. Without this
      // the editor opened every activity at its default 09:00 and saving
      // moved it there.
      if (!timeTouched.current && props.initialStartMin == null) {
        const anchor =
          startsAt ??
          (key ? new Date(key) : null) ??
          (a.dtstartLocal ? new Date(a.dtstartLocal) : null);
        if (anchor && !Number.isNaN(anchor.getTime())) {
          setDate(instantToLocalDateStr(anchor, zone));
          setStartMin(dateToMinutesFromMidnight(anchor, zone));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    props.mode,
    props.activityId,
    props.initialTitle,
    props.initialDate,
    props.initialStartMin,
    props.initialOccurrenceKey,
    tz,
  ]);

  /* The chips are keyed by name while the series stores an id, and the owned
   * category list arrives from its own request. Derived rather than mirrored,
   * so the saved category shows up the moment both halves land — before this,
   * every edit save quietly reassigned the activity to the default chip. */
  const selectedCategoryKey =
    categoryKey ??
    categories.find((c) => c.id === serverCategoryId)?.key ??
    "sky";

  const categoryId = useMemo(() => {
    const row = categories.find((c) => c.key === selectedCategoryKey);
    if (row) return row.id;
    return selectedCategoryKey === props.initialCategoryKey
      ? props.initialCategoryId
      : undefined;
  }, [
    categories,
    selectedCategoryKey,
    props.initialCategoryId,
    props.initialCategoryKey,
  ]);

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

  /**
   * Write the form. `editScope` is ignored when creating (a new activity has
   * exactly one day and nothing to choose between) and is the ADR-001 scope
   * the user picked when editing.
   */
  const commit = useCallback(async (editScope: EditScope) => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give this activity a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dtstartLocal = localMinutesToInstant(date, startMin, tz);
      const checklistTemplate = buildChecklistTemplate(steps);
      const rrule =
        repeat === "custom" ? customRrule : buildRrule(repeat, date, repeatN);

      if (props.mode === "create") {
        if (props.sourceTaskId) {
          if (!navigator.onLine) {
            setError("Task scheduling needs a connection — reconnect and try again.");
            setSaving(false);
            return;
          }
          const key = scheduleIdempotencyKey.current ?? crypto.randomUUID();
          scheduleIdempotencyKey.current = key;
          const res = await fetch(`/api/v1/tasks/${props.sourceTaskId}/schedule`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key,
            },
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
              notes,
              checklistTemplate,
              source: "manual",
            }),
          });
          if (!res.ok) {
            scheduleIdempotencyKey.current = null;
            const body = await res.json().catch(() => null);
            setError(
              res.status === 404
                ? "This task was already moved or deleted. Return to Inbox and choose another."
                : body?.error?.message ?? "Couldn't schedule it — try again",
            );
            setSaving(false);
            return;
          }
        } else {
          const delivery = await sendReplaySafeCreate({
            path: "/api/v1/activities",
            body: {
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
            },
          });
          if (delivery.state === "queued") {
            toast("Saved on this device — it’ll appear when you’re back");
            router.push(`/app/today?date=${date}`);
            return;
          }
          if (delivery.state === "unavailable") {
            setError(
              "You’re offline and this device couldn’t save it. Keep this open and reconnect.",
            );
            setSaving(false);
            return;
          }
          const res = delivery.response;
          if (res.status === 401) {
            setError("Sign in to save activities.");
            setSaving(false);
            return;
          }
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            setError(body?.error?.message ?? "Couldn't create it — try again");
            setSaving(false);
            return;
          }
        }
      } else {
        if (!props.activityId || revision == null) {
          setError("Lost track of this one — refresh and try again?");
          setSaving(false);
          return;
        }
        if (editScope !== "all" && !occurrenceKey) {
          setError("We lost track of which day this is — reopen it from the day view.");
          setSaving(false);
          return;
        }
        /* "Just this time" writes an occurrence override, and an override can
         * only carry the fields that belong to a single day (ADR-001). The
         * rest — icon, category, priority, notes, the repeat rule — live on
         * the series; the chooser says so before the user commits. */
        const body =
          editScope === "this"
            ? {
                editScope,
                occurrenceKey,
                title: trimmed,
                startAt: dtstartLocal,
                durationMin,
                energy,
                checklistOverride: checklistTemplate,
              }
            : {
                editScope,
                ...(editScope === "this_and_future" ? { occurrenceKey } : {}),
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
              };
        const res = await fetch(`/api/v1/activities/${props.activityId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(revision),
          },
          body: JSON.stringify(body),
        });
        if (res.status === 409) {
          setError("Someone else changed this — refresh and try again.");
          setSaving(false);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error?.message ?? "Couldn't save it — try again");
          setSaving(false);
          return;
        }
      }

      setScopeAsk(null);
      router.push(`/app/today?date=${date}`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server — try again?");
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
    props.sourceTaskId,
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
    occurrenceKey,
  ]);

  const commitDelete = useCallback(
    async (editScope: EditScope) => {
      if (props.mode !== "edit" || !props.activityId || revision == null) return;
      if (editScope !== "all" && !occurrenceKey) {
        setError("We lost track of which day this is — reopen it from the day view.");
        return;
      }
      setSaving(true);
      setError(null);
      const query =
        editScope === "all"
          ? "editScope=all"
          : `editScope=${editScope}&occurrenceKey=${encodeURIComponent(occurrenceKey!)}`;
      const res = await fetch(
        `/api/v1/activities/${props.activityId}?${query}`,
        { method: "DELETE", headers: { "If-Match": String(revision) } },
      );
      if (!res.ok && res.status !== 204) {
        setError("Couldn't delete it — try again");
        setSaving(false);
        return;
      }
      setScopeAsk(null);
      router.push(`/app/today?date=${date}`);
      router.refresh();
    },
    [props.mode, props.activityId, revision, router, date, occurrenceKey],
  );

  /* The prompt only exists for activities that actually repeat — a one-off has
   * a single day, so asking would be noise (ADR-001: one-offs are a series with
   * no RRULE and one occurrence). */
  const asksScope = props.mode === "edit" && seriesRepeats;
  /** Without a day identity, only the whole-series answer can be honored. */
  const scopedDisabled = !occurrenceKey;

  const openScopePrompt = useCallback(
    (intent: "save" | "delete") => {
      // Never preselect "the whole series": the widest blast radius must be a
      // deliberate answer, not the one Enter picks for you.
      setScope(occurrenceKey ? "this" : null);
      setScopeAsk(intent);
    },
    [occurrenceKey],
  );

  const save = useCallback(() => {
    if (!title.trim()) {
      setError("Give this activity a title.");
      return;
    }
    if (asksScope) {
      openScopePrompt("save");
      return;
    }
    void commit("all");
  }, [asksScope, commit, openScopePrompt, title]);

  const remove = useCallback(() => {
    if (props.mode !== "edit" || !props.activityId || revision == null) return;
    if (asksScope) {
      openScopePrompt("delete");
      return;
    }
    if (!confirm("Delete this activity?")) return;
    void commitDelete("all");
  }, [
    asksScope,
    commitDelete,
    openScopePrompt,
    props.mode,
    props.activityId,
    revision,
  ]);

  /**
   * Fields the user changed that belong to the whole series, so "Just this
   * time" can say plainly what it won't carry across.
   */
  const sharedFields = useMemo(() => {
    if (!saved) return [];
    const changed: string[] = [];
    if (emoji !== saved.emoji) changed.push("the icon");
    if ((categoryId ?? null) !== saved.categoryId) changed.push("the category");
    if (priority !== saved.priority) changed.push("the priority");
    if ((notes || "") !== saved.notes) changed.push("the notes");
    const nextRrule =
      repeat === "custom" ? customRrule : buildRrule(repeat, date, repeatN);
    if ((nextRrule ?? null) !== saved.rrule) changed.push("how often it repeats");
    return changed;
  }, [saved, emoji, categoryId, priority, notes, repeat, customRrule, date, repeatN]);

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
                      aria-label={`Use ${e} as the icon`}
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
              aria-label="Activity title"
              value={title}
              onChange={(e) => {
                textTouched.current = true;
                setTitle(e.target.value);
              }}
              placeholder="What are you doing?"
              className="w-full rounded-2xl border border-border bg-surface-raised px-4 py-3.5 text-[17px] font-semibold outline-none focus:ring-2 focus:ring-iris"
              autoFocus
            />
          </div>

          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_UI.map((c) => {
                const selected = c.key === selectedCategoryKey;
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
                aria-label="Date"
                value={date}
                onChange={(e) => {
                  timeTouched.current = true;
                  setDate(e.target.value);
                }}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-[14px] font-semibold text-ink"
              />
              <input
                type="time"
                aria-label="Start time"
                value={minutesToTimeInput(startMin)}
                onChange={(e) => {
                  timeTouched.current = true;
                  setStartMin(timeInputToMinutes(e.target.value));
                }}
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
                      setDate(clientToday(tz));
                      const nowM = nowMinutesInZone(tz);
                      setStartMin(Math.min(1425, Math.ceil(nowM / 15) * 15));
                    },
                  },
                  {
                    label: "+30 min",
                    apply: () => {
                      setDate(clientToday(tz));
                      const nowM = nowMinutesInZone(tz) + 30;
                      setStartMin(Math.min(1425, Math.ceil(nowM / 15) * 15));
                    },
                  },
                  { label: "Tonight 20:00", apply: () => setStartMin(20 * 60) },
                ] as { label: string; apply: () => void }[]
              ).map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    timeTouched.current = true;
                    c.apply();
                  }}
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
            {asksScope && (
              <p className="mt-1.5 text-[12px] text-ink-faint">
                When you save, we’ll ask which days to change.
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

          <Field label="Steps" htmlFor="activity-step-draft">
            <div className="space-y-1.5">
              {steps.map((step, i) => (
                <div
                  key={`${step.label}-${i}`}
                  className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-2"
                >
                  <button
                    type="button"
                    aria-label={`${step.done ? "Mark incomplete" : "Mark complete"}: ${step.label}`}
                    aria-pressed={step.done}
                    onClick={() =>
                      setSteps((previous) =>
                        previous.map((candidate, index) =>
                          index === i
                            ? { ...candidate, done: !candidate.done }
                            : candidate,
                        ),
                      )
                    }
                    className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                      step.done
                        ? "border-iris bg-iris text-ink-inverse"
                        : "border-border-strong"
                    }`}
                  >
                    {step.done && <Check size={12} strokeWidth={3} />}
                  </button>
                  <span
                    className={`flex-1 text-[14px] font-medium ${
                      step.done ? "text-ink-soft line-through" : ""
                    }`}
                  >
                    {step.label}
                  </span>
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
                  id="activity-step-draft"
                  value={stepDraft}
                  onChange={(e) => setStepDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && stepDraft.trim()) {
                      e.preventDefault();
                      setSteps((prev) => [
                        ...prev,
                        { label: stepDraft.trim(), done: false },
                      ]);
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
                    setSteps((prev) => [
                      ...prev,
                      { label: stepDraft.trim(), done: false },
                    ]);
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
                        setSteps((prev) => [
                          ...prev,
                          ...next
                            .filter(Boolean)
                            .map((label) => ({ label, done: false })),
                        ]);
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

          <Field label="Notes" htmlFor="activity-notes">
            <textarea
              id="activity-notes"
              rows={2}
              value={notes}
              onChange={(e) => {
                textTouched.current = true;
                setNotes(e.target.value);
              }}
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

      {scopeAsk && (
        <EditScopeChooser
          intent={scopeAsk}
          value={scope}
          onChange={setScope}
          onCancel={() => setScopeAsk(null)}
          onConfirm={() => {
            if (!scope) return;
            if (scopeAsk === "delete") void commitDelete(scope);
            else void commit(scope);
          }}
          busy={saving}
          scopedDisabled={scopedDisabled}
          sharedFields={sharedFields}
        />
      )}
    </div>
  );
}
