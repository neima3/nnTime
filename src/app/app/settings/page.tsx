import {
  Accessibility,
  Bell,
  CalendarSync,
  ChevronRight,
  Moon,
  Palette,
  User,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

function Toggle({ on }: { on?: boolean }) {
  return (
    <span
      role="switch"
      aria-checked={!!on}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${
        on ? "bg-iris" : "bg-border-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 size-6 rounded-full bg-surface-raised shadow-card transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </span>
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

export default function SettingsPage() {
  return (
    <AppShell active="settings">
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 md:px-8">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Settings
          </h1>
        </header>

        <Section icon={User} title="Account">
          <Row
            label="Neima"
            hint="neima@nakhaee.us · synced across devices"
            right={<ChevronRight size={18} className="text-ink-faint" />}
          />
        </Section>

        <Section icon={Palette} title="Appearance">
          <Row
            label="Theme"
            hint="Light, dark, or follow system"
            right={
              <span className="flex items-center gap-1.5 rounded-xl bg-surface-sunken px-3 py-1.5 text-[13px] font-semibold text-ink-soft">
                <Moon size={14} /> System
              </span>
            }
          />
          <Row
            label="Reduced stimulation"
            hint="Mute colors and hide non-essential detail"
            right={<Toggle />}
          />
          <Row label="Show weekends dimmed" right={<Toggle on />} />
        </Section>

        <Section icon={Bell} title="Notifications">
          <Row
            label="Activity start"
            hint="Gentle chime when something begins"
            right={<Toggle on />}
          />
          <Row
            label="Halfway nudge"
            hint="A soft heads-up midway through"
            right={<Toggle />}
          />
          <Row label="Wrap-up warning" hint="5 minutes before the end" right={<Toggle on />} />
        </Section>

        <Section icon={CalendarSync} title="Calendars">
          <Row
            label="Google Calendar"
            hint="neima@nakhaee.us · importing 2 calendars"
            right={
              <span className="rounded-full bg-success-soft px-2.5 py-1 text-[12px] font-bold text-success">
                Connected
              </span>
            }
          />
          <Row
            label="Apple Calendar"
            right={
              <button className="rounded-xl bg-iris-soft px-3 py-1.5 text-[13px] font-semibold text-iris">
                Connect
              </button>
            }
          />
        </Section>

        <Section icon={Accessibility} title="Accessibility">
          <Row label="Dyslexia-friendly font" right={<Toggle />} />
          <Row
            label="Reduce motion"
            hint="Currently following your system setting"
            right={<Toggle />}
          />
          <Row label="Larger text" right={<Toggle />} />
        </Section>
      </div>
    </AppShell>
  );
}
