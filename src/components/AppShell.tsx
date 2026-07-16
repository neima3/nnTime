"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  Inbox,
  LayoutGrid,
  Repeat,
  Settings,
  Sparkles,
  Timer,
} from "lucide-react";
import { UserMenu } from "./UserMenu";
import { OfflineShell } from "./OfflineShell";

const sidebarNav = [
  { href: "/app/today", label: "Today", key: "today", icon: CalendarDays },
  { href: "/app/inbox", label: "Inbox", key: "inbox", icon: Inbox },
  { href: "/app/week", label: "Week", key: "week", icon: CalendarRange },
  { href: "/app/focus", label: "Focus", key: "focus", icon: Timer },
  { href: "/app/routines", label: "Routines", key: "routines", icon: Repeat },
  { href: "/app/stats", label: "Stats", key: "stats", icon: BarChart3 },
  { href: "/app/settings", label: "Settings", key: "settings", icon: Settings },
];

/* Mobile keeps 5 tabs; More collects Routines/Templates/Stats/Settings. */
const mobileNav = [
  { href: "/app/today", label: "Today", key: "today", icon: CalendarDays },
  { href: "/app/inbox", label: "Inbox", key: "inbox", icon: Inbox },
  { href: "/app/week", label: "Week", key: "week", icon: CalendarRange },
  { href: "/app/focus", label: "Focus", key: "focus", icon: Timer },
  { href: "/app/more", label: "More", key: "more", icon: LayoutGrid },
];

const moreKeys = new Set(["routines", "stats", "settings", "templates", "more"]);

export function AppShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  // Keyboard shortcuts: n=new, t=today, i=inbox, w=week, f=focus, s=settings
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || target.tagName === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const routes: Record<string, string> = { n: "/app/editor", t: "/app/today", i: "/app/inbox", w: "/app/week", f: "/app/focus", s: "/app/settings" };
      const route = routes[e.key.toLowerCase()];
      if (route) { e.preventDefault(); window.location.href = route; }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex min-h-dvh w-full bg-canvas">
      {/* Skip to content — keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-iris focus:px-4 focus:py-2 focus:text-ink-inverse focus:shadow-float"
      >
        Skip to content
      </a>
      {/* desktop sidebar */}
      <aside
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex"
        role="navigation"
        aria-label="Main navigation"
      >
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-iris text-lg text-ink-inverse shadow-card">
            ◔
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Kairo
          </span>
        </Link>

        <nav className="mt-8 flex flex-col gap-1">
          {sidebarNav.map(({ href, label, key, icon: Icon }) => {
            const isActive = key === active;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
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
          <Link
            href="/app/planner"
            className="mt-3 block w-full rounded-xl bg-iris py-2 text-center text-[13px] font-semibold text-ink-inverse transition-colors hover:bg-iris-deep"
          >
            Plan my day
          </Link>
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <UserMenu />
        </div>
      </aside>

      {/* main */}
      <main id="main-content" className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>
      <OfflineShell />

      {/* mobile bottom bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Mobile navigation"
      >
        {mobileNav.map(({ href, label, key, icon: Icon }) => {
          const isActive =
            key === active || (key === "more" && moreKeys.has(active));
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center gap-1 px-3 pb-2 pt-2.5 text-[11px] font-medium focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none ${
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
