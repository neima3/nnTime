"use client";

/**
 * Settings personalization — PATCH /api/v1/settings (10× Phase 11).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Accessibility,
  Bell,
  ChevronRight,
  Moon,
  Palette,
  User,
} from "lucide-react";

type Settings = {
  timezone: string;
  theme: "system" | "light" | "dark";
  reducedStimulation: boolean;
  hourCycle: "h12" | "h24";
  weekStart: number;
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
}

export function SettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/settings")
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
      const next = await res.json();
      const s: Settings = {
        timezone: next.timezone,
        theme: next.theme,
        reducedStimulation: next.reducedStimulation,
        hourCycle: next.hourCycle,
        weekStart: next.weekStart,
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

  if (!authed) {
    return (
      <p className="rounded-2xl border border-border bg-surface px-5 py-8 text-center text-[14px] text-ink-soft">
        <a href="/sign-in" className="font-semibold text-iris">
          Sign in
        </a>{" "}
        to sync personalization across devices.
      </p>
    );
  }

  if (!settings) {
    return (
      <p className="text-[14px] text-ink-soft">Loading settings…</p>
    );
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
          label="Push reminders"
          hint="Configure sounds after Web Push is enabled on this device"
          right={<ChevronRight size={18} className="text-ink-faint" />}
        />
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
      </Section>
    </div>
  );
}
