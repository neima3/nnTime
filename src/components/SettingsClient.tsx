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
import { SignedOutCard, SkeletonRows } from "./EmptyState";

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
        document.documentElement.classList.toggle(
          "reduced-stimulation",
          s.reducedStimulation,
        );
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
        setStatus("Could not save settings.");
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
      if (partial.reducedStimulation !== undefined) {
        document.documentElement.classList.toggle(
          "reduced-stimulation",
          s.reducedStimulation,
        );
      }
      setStatus("Saved");
      setTimeout(() => setStatus(null), 1500);
    },
    [settings],
  );

  const exportData = useCallback(async () => {
    const res = await fetch("/api/v1/privacy/export");
    if (!res.ok) {
      setStatus("Export failed — sign in?");
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
        setStatus(data?.error?.message ?? "ICS import failed");
        setIcsBusy(false);
        return;
      }
      setStatus(`Imported ${data.imported ?? 0} events to your planner`);
      setIcsUrl("");
    } catch {
      setStatus("Network error importing calendar");
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
      setStatus("Could not delete account");
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
              on={settings.reducedStimulation}
              onChange={(v) => void patch({ reducedStimulation: v })}
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
          label="Reduced stimulation"
          hint="Same as Appearance — kept here for discoverability"
          right={
            <Toggle
              label="Reduced stimulation (access)"
              on={settings.reducedStimulation}
              onChange={(v) => void patch({ reducedStimulation: v })}
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
