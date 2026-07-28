"use client";

/**
 * Settings personalization — PATCH /api/v1/settings (10× Phase 11).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Accessibility,
  Bell,
  Calendar,
  Moon,
  Palette,
  User,
} from "lucide-react";
import { invalidateSettingsCache } from "@/lib/settings-cache";
import { publishHourCycle } from "@/lib/use-hour-cycle";
import { toHourCycle } from "@/lib/time-format";
import {
  A11Y_STORAGE_KEY,
  applyA11yPrefs,
  parseA11yPrefs,
  serializeA11yPrefs,
  writeA11yPrefs,
  type A11yPrefs,
} from "@/lib/a11y-prefs";
import {
  describeQuietHours,
  formatQuietHour,
  parseQuietHours,
  writeQuietHours,
} from "@/lib/quiet-hours";
import { SignedOutCard, SkeletonRows } from "./EmptyState";
import { PushReminders } from "./PushReminders";

type Settings = {
  timezone: string;
  theme: "system" | "light" | "dark";
  reducedStimulation: boolean;
  hourCycle: "h12" | "h24";
  weekStart: number;
  notificationPrefs: Record<string, unknown>;
  revision: number;
};

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
        on ? "bg-iris" : "bg-border-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 size-6 rounded-full bg-surface-raised shadow-card transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function Row({
  label,
  hint,
  right,
}: {
  label: string;
  hint?: string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="text-[15px] font-semibold">{label}</p>
        {hint && <p className="mt-0.5 text-[13px] text-ink-soft">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-soft">
        <Icon size={15} />
        {title}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
        {children}
      </div>
    </section>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const REMINDER_SELECT_CLASS =
  "min-h-11 rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold";

function reminderOffset(
  prefs: Record<string, unknown>,
  key: string,
): number {
  const value = prefs[key];
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

function ReminderTimingRows({
  prefs,
  onChange,
}: {
  prefs: Record<string, unknown>;
  onChange: (nextPrefs: Record<string, unknown>) => void;
}) {
  const timingRows = [
    {
      label: "Start reminder timing",
      hint: "Choose how much runway you want before a block begins",
      key: "startOffsetMin",
      options: [
        [-15, "15 min before"],
        [-10, "10 min before"],
        [-5, "5 min before"],
        [0, "At start"],
      ],
    },
    {
      label: "Halfway reminder timing",
      hint: "Move the gentle midpoint check-in earlier or later",
      key: "halfwayOffsetMin",
      options: [
        [-5, "5 min before"],
        [0, "At halfway"],
        [5, "5 min after"],
      ],
    },
    {
      label: "Wrap-up reminder timing",
      hint: "Default is five minutes before the planned end",
      key: "wrapUpOffsetMin",
      options: [
        [-5, "10 min before end"],
        [0, "5 min before end"],
        [5, "At end"],
      ],
    },
  ] as const;

  return timingRows.map((row) => (
    <Row
      key={row.key}
      label={row.label}
      hint={row.hint}
      right={
        <select
          aria-label={row.label}
          value={reminderOffset(prefs, row.key)}
          onChange={(event) =>
            onChange({
              ...prefs,
              [row.key]: Number(event.target.value),
            })
          }
          className={REMINDER_SELECT_CLASS}
        >
          {row.options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      }
    />
  ));
}

/**
 * Quiet hours (H7) — a nightly window where reminders hold off. Persisted in
 * notificationPrefs.quietHours, which is the same blob the server push delivery
 * and the iOS scheduler read, so setting it here quiets every surface.
 */
function QuietHoursRows({
  prefs,
  hourCycle,
  onChange,
}: {
  prefs: Record<string, unknown>;
  hourCycle: "h12" | "h24";
  onChange: (nextPrefs: Record<string, unknown>) => void;
}) {
  const quiet = parseQuietHours(prefs);

  return (
    <>
      <Row
        label="Quiet hours"
        hint={describeQuietHours(quiet, hourCycle)}
        right={
          <Toggle
            label="Quiet hours"
            on={quiet.enabled}
            onChange={(v) => onChange(writeQuietHours(prefs, { ...quiet, enabled: v }))}
          />
        }
      />
      {quiet.enabled ? (
        <Row
          label="Window"
          hint="Reminders inside this window are skipped, not stacked up"
          right={
            <div className="flex items-center gap-2">
              <select
                aria-label="Quiet hours start"
                value={quiet.start}
                onChange={(e) =>
                  onChange(
                    writeQuietHours(prefs, { ...quiet, start: Number(e.target.value) }),
                  )
                }
                className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {formatQuietHour(h, hourCycle)}
                  </option>
                ))}
              </select>
              <span aria-hidden className="text-[13px] text-ink-faint">
                to
              </span>
              <select
                aria-label="Quiet hours end"
                value={quiet.end}
                onChange={(e) =>
                  onChange(
                    writeQuietHours(prefs, { ...quiet, end: Number(e.target.value) }),
                  )
                }
                className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {formatQuietHour(h, hourCycle)}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      ) : null}
    </>
  );
}

/**
 * Apply the accessibility modes now (classes on <html>) and remember them for
 * the next first paint (localStorage, read by ThemeScript before hydration).
 */
function syncA11y(prefs: A11yPrefs) {
  applyA11yPrefs(prefs, document.documentElement.classList);
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, serializeA11yPrefs(prefs));
  } catch {}
}

function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else if (theme === "light") root.classList.remove("dark");
  else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  }
  root.dataset.theme = theme;
  try { localStorage.setItem("kairo-theme", theme); } catch {}
}

export function SettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const tz = typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined;
    fetch("/api/v1/settings", {
      headers: tz ? { "x-timezone": tz } : {},
    })
      .then(async (r) => {
        if (r.status === 401) {
          if (!cancelled) setAuthed(false);
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        const s: Settings = {
          timezone: data.timezone,
          theme: data.theme ?? "system",
          reducedStimulation: Boolean(data.reducedStimulation),
          hourCycle: data.hourCycle ?? "h12",
          weekStart: data.weekStart ?? 0,
          notificationPrefs:
            (data.notificationPrefs as Record<string, unknown>) ?? {},
          revision: data.revision,
        };
        setSettings(s);
        applyTheme(s.theme);
        syncA11y(parseA11yPrefs(s));
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = useCallback(
    async (partial: Partial<Settings>) => {
      if (!settings) return;
      setStatus(null);
      const body: Record<string, unknown> = {};
      if (partial.theme !== undefined) body.theme = partial.theme;
      if (partial.reducedStimulation !== undefined)
        body.reducedStimulation = partial.reducedStimulation;
      if (partial.hourCycle !== undefined) body.hourCycle = partial.hourCycle;
      if (partial.weekStart !== undefined) body.weekStart = partial.weekStart;
      if (partial.timezone !== undefined) body.timezone = partial.timezone;
      if (partial.notificationPrefs !== undefined)
        body.notificationPrefs = partial.notificationPrefs;

      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(settings.revision),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setStatus("Couldn't save your settings — try again");
        return;
      }
      invalidateSettingsCache();
      const next = await res.json();
      const s: Settings = {
        timezone: next.timezone,
        theme: next.theme,
        reducedStimulation: next.reducedStimulation,
        hourCycle: next.hourCycle,
        weekStart: next.weekStart,
        notificationPrefs:
          (next.notificationPrefs as Record<string, unknown>) ?? {},
        revision: next.revision,
      };
      setSettings(s);
      if (partial.theme !== undefined) applyTheme(s.theme);
      // Every time label reads this off <html>; republish so 12/24-hour takes
      // effect across the app immediately instead of on the next full load.
      if (partial.hourCycle !== undefined) publishHourCycle(toHourCycle(s.hourCycle));
      // Reconcile against what the server actually stored — cheap, and it keeps
      // the optimistic class from sticking around if a PATCH was rejected.
      syncA11y(parseA11yPrefs(s));
      setStatus("Saved");
      setTimeout(() => setStatus(null), 1500);
    },
    [settings],
  );

  /**
   * Toggle one accessibility mode. Applied to <html> optimistically so the
   * change is visible on the same tap, then reconciled by `patch`.
   * reducedStimulation is its own settings column; the other three ride in
   * notificationPrefs (the shape the personalization service reads).
   */
  const patchA11y = useCallback(
    (change: Partial<A11yPrefs>) => {
      if (!settings) return;
      const next = { ...parseA11yPrefs(settings), ...change };
      syncA11y(next);
      const body: Partial<Settings> = {};
      if (change.reducedStimulation !== undefined) {
        body.reducedStimulation = change.reducedStimulation;
      }
      if (
        change.highContrast !== undefined ||
        change.dyslexiaFont !== undefined ||
        change.largerText !== undefined
      ) {
        body.notificationPrefs = writeA11yPrefs(settings.notificationPrefs, next);
      }
      void patch(body);
    },
    [settings, patch],
  );

  const exportData = useCallback(async () => {
    const res = await fetch("/api/v1/privacy/export");
    if (!res.ok) {
      setStatus("Couldn't export — sign in?");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kairo-export.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Export downloaded");
  }, []);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [icsUrl, setIcsUrl] = useState("");
  const [icsBusy, setIcsBusy] = useState(false);

  const importIcs = useCallback(async () => {
    if (!icsUrl.trim()) {
      setStatus("Paste an ICS calendar URL first");
      return;
    }
    setIcsBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/v1/calendar/ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: icsUrl.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus(data?.error?.message ?? "Couldn't read that calendar — check the link?");
        setIcsBusy(false);
        return;
      }
      setStatus(`Imported ${data.imported ?? 0} events to your planner`);
      setIcsUrl("");
    } catch {
      setStatus("Couldn't reach the server — try again?");
    }
    setIcsBusy(false);
  }, [icsUrl]);

  const deleteAccount = useCallback(async () => {
    if (deleteConfirm !== "delete-my-account") {
      setStatus('Type delete-my-account to confirm');
      return;
    }
    setDeleteBusy(true);
    const res = await fetch("/api/v1/privacy/account", {
      method: "DELETE",
      headers: { Confirm: "delete-my-account" },
    });
    setDeleteBusy(false);
    if (!res.ok && res.status !== 204) {
      setStatus("Couldn't delete your account — try again or reach out");
      return;
    }
    window.location.href = "/";
  }, [deleteConfirm]);

  if (!authed) {
    return (
      <SignedOutCard
        icon={Palette}
        title="Make Kairo yours"
        body="Theme, quiet notifications, reduced stimulation, calendars — sign in to personalize and sync across your devices."
      />
    );
  }

  if (!settings) {
    return <SkeletonRows count={6} />;
  }

  // Derived during render rather than mirrored in state — settings is the source.
  const a11y = parseA11yPrefs(settings);

  return (
    <div className="space-y-8">
      {status && (
        <p role="status" className="text-[13px] font-semibold text-iris">
          {status}
        </p>
      )}

      <Section icon={Palette} title="Appearance">
        <Row
          label="Theme"
          hint="System follows your device"
          right={
            <select
              value={settings.theme}
              onChange={(e) =>
                void patch({
                  theme: e.target.value as Settings["theme"],
                })
              }
              className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          }
        />
        <Row
          label="Reduced stimulation"
          hint="Softer motion and calmer surfaces"
          right={
            <Toggle
              label="Reduced stimulation"
              on={a11y.reducedStimulation}
              onChange={(v) => patchA11y({ reducedStimulation: v })}
            />
          }
        />
      </Section>

      <Section icon={Moon} title="Time">
        <Row
          label="Hour cycle"
          right={
            <select
              value={settings.hourCycle}
              onChange={(e) =>
                void patch({
                  hourCycle: e.target.value as "h12" | "h24",
                })
              }
              className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold"
            >
              <option value="h12">12-hour</option>
              <option value="h24">24-hour</option>
            </select>
          }
        />
        <Row
          label="Week starts"
          right={
            <select
              value={settings.weekStart}
              onChange={(e) => void patch({ weekStart: Number(e.target.value) })}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-semibold"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
            </select>
          }
        />
        <Row
          label="Timezone"
          hint={settings.timezone}
          right={
            <span className="max-w-[140px] truncate text-[12px] font-medium text-ink-soft">
              {settings.timezone}
            </span>
          }
        />
      </Section>

      <Section icon={Accessibility} title="Access">
        <Row
          label="High contrast"
          hint="Stronger ink and visible edges on every surface"
          right={
            <Toggle
              label="High contrast"
              on={a11y.highContrast}
              onChange={(v) => patchA11y({ highContrast: v })}
            />
          }
        />
        <Row
          label="Dyslexia-friendly font"
          hint="Atkinson Hyperlegible — letters that don't mirror each other"
          right={
            <Toggle
              label="Dyslexia-friendly font"
              on={a11y.dyslexiaFont}
              onChange={(v) => patchA11y({ dyslexiaFont: v })}
            />
          }
        />
        <Row
          label="Larger text"
          hint="Everything one comfortable step up"
          right={
            <Toggle
              label="Larger text"
              on={a11y.largerText}
              onChange={(v) => patchA11y({ largerText: v })}
            />
          }
        />
        <Row
          label="Reduced stimulation"
          hint="Same switch as Appearance — kept here where you'd look for it"
          right={
            <Toggle
              label="Reduced stimulation (access)"
              on={a11y.reducedStimulation}
              onChange={(v) => patchA11y({ reducedStimulation: v })}
            />
          }
        />
      </Section>

      <Section icon={Bell} title="Notifications">
        <Row
          label="Transition warnings"
          hint="A gentle heads-up when an activity starts, and 5 min before it ends — only while Kairo is open"
          right={
            <Toggle
              label="Transition warnings"
              on={Boolean(settings.notificationPrefs.transitionWarnings)}
              onChange={(v) => {
                void (async () => {
                  if (
                    v &&
                    typeof Notification !== "undefined" &&
                    Notification.permission === "default"
                  ) {
                    // Ask only on opt-in, never on load. In-app nudges work
                    // regardless of the browser's answer.
                    try {
                      await Notification.requestPermission();
                    } catch {}
                  }
                  await patch({
                    notificationPrefs: {
                      ...settings.notificationPrefs,
                      transitionWarnings: v,
                    },
                  });
                  window.dispatchEvent(
                    new CustomEvent("kairo:transition-warnings", {
                      detail: { enabled: v },
                    }),
                  );
                })();
              }}
            />
          }
        />
        <Row
          label="Start-of-block reminders"
          hint="The push nudge when a scheduled activity begins — off silences just these, other nudges stay"
          right={
            <Toggle
              label="Start-of-block reminders"
              on={settings.notificationPrefs.startNudges !== false}
              onChange={(v) =>
                void patch({
                  notificationPrefs: {
                    ...settings.notificationPrefs,
                    startNudges: v,
                  },
                })
              }
            />
          }
        />
        <ReminderTimingRows
          prefs={settings.notificationPrefs}
          onChange={(nextPrefs) =>
            void patch({ notificationPrefs: nextPrefs })
          }
        />
        <Row
          label="Hide activity names on lock screen"
          hint="Use generic reminder text while still opening the right Kairo screen"
          right={
            <Toggle
              label="Hide activity names on lock screen"
              on={
                settings.notificationPrefs
                  .hideActivityTitlesOnLockScreen === true
              }
              onChange={(value) =>
                void patch({
                  notificationPrefs: {
                    ...settings.notificationPrefs,
                    hideActivityTitlesOnLockScreen: value,
                  },
                })
              }
            />
          }
        />
        <QuietHoursRows
          prefs={settings.notificationPrefs}
          hourCycle={settings.hourCycle}
          onChange={(nextPrefs) => void patch({ notificationPrefs: nextPrefs })}
        />
        <div className="px-5 py-4">
          <PushReminders />
        </div>
      </Section>

      <Section icon={Calendar} title="Calendars">
        <div className="space-y-3 px-5 py-4">
          <p className="text-[15px] font-semibold">Import ICS feed</p>
          <p className="text-[13px] text-ink-soft">
            Subscribe to a public ICS URL (Google/Apple calendar publish link).
            Events become read-only calendar blocks (SEC-04 SSRF-safe fetch).
          </p>
          <input
            type="url"
            value={icsUrl}
            onChange={(e) => setIcsUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            className="w-full rounded-xl border border-border bg-surface-sunken px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-iris"
          />
          <button
            type="button"
            disabled={icsBusy || !icsUrl.trim()}
            onClick={() => void importIcs()}
            className="rounded-xl bg-iris-soft px-3 py-2 text-[13px] font-semibold text-iris disabled:opacity-40"
          >
            {icsBusy ? "Importing…" : "Import now"}
          </button>
        </div>
      </Section>

      <Section icon={User} title="Privacy">
        <Row
          label="Download my data"
          hint="JSON export of your planner"
          right={
            <button
              type="button"
              onClick={() => void exportData()}
              className="rounded-xl bg-iris-soft px-3 py-1.5 text-[13px] font-semibold text-iris"
            >
              Export
            </button>
          }
        />
        <div className="space-y-3 px-5 py-4">
          <div>
            <p className="text-[15px] font-semibold text-danger">Delete account</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              Permanently removes your planner data (SEC-10). Type{" "}
              <code className="rounded bg-surface-sunken px-1 text-[12px]">
                delete-my-account
              </code>{" "}
              to confirm.
            </p>
          </div>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="delete-my-account"
            className="w-full rounded-xl border border-border bg-surface-sunken px-3 py-2 text-[13px] font-medium outline-none focus:ring-2 focus:ring-iris"
            aria-label="Type delete-my-account to confirm"
          />
          <button
            type="button"
            disabled={deleteBusy || deleteConfirm !== "delete-my-account"}
            onClick={() => void deleteAccount()}
            className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger disabled:opacity-40"
          >
            {deleteBusy ? "Deleting…" : "Delete my account forever"}
          </button>
        </div>
        <Row
          label="Onboarding"
          hint="Revisit the gentle setup flow"
          right={
            <a
              href="/onboarding"
              className="rounded-xl border border-border px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink"
            >
              Open
            </a>
          }
        />
      </Section>
    </div>
  );
}
