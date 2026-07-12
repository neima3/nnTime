import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  Repeat,
  Settings,
  Sparkles,
  Timer,
} from "lucide-react";

const nav = [
  { href: "/app/today", label: "Today", icon: CalendarDays },
  { href: "/app/week", label: "Week", icon: CalendarRange },
  { href: "/app/focus", label: "Focus", icon: Timer },
  { href: "/app/routines", label: "Routines", icon: Repeat },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full bg-canvas">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-iris text-lg text-ink-inverse shadow-card">
            ◔
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Kairo
          </span>
        </Link>

        <nav className="mt-8 flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const isActive = label.toLowerCase() === active;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
                  isActive
                    ? "bg-iris-soft text-iris"
                    : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
                }`}
              >
                <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-border bg-iris-ghost p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-iris">
            <Sparkles size={16} />
            AI co-planner
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-ink-soft">
            Break down any task into gentle, doable steps.
          </p>
          <button className="mt-3 w-full rounded-xl bg-iris py-2 text-[13px] font-semibold text-ink-inverse transition-colors hover:bg-iris-deep">
            Plan my day
          </button>
        </div>
      </aside>

      {/* main */}
      <main className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>

      {/* mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {nav.map(({ href, label, icon: Icon }) => {
          const isActive = label.toLowerCase() === active;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 pb-2 pt-2.5 text-[11px] font-medium ${
                isActive ? "text-iris" : "text-ink-faint"
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
