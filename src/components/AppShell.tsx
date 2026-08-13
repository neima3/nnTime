"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  Gamepad2,
  Inbox,
  LayoutGrid,
  Repeat,
  Settings,
  Sparkles,
  Timer,
} from "lucide-react";
import { UserMenu } from "./UserMenu";
import { OfflineShell } from "./OfflineShell";
import { NowCard, NowProvider, NowStrip } from "./NowBar";
import { CelebrationHost } from "./Celebration";
import { QuickCapture } from "./QuickCapture";
import { OneThing } from "./OneThing";
import { CommandPalette } from "./CommandPalette";
import { ToastHost } from "./Toast";
import { useAppSession } from "./AppSessionBoundary";

const sidebarNav = [
  { href: "/app/today", label: "Today", key: "today", icon: CalendarDays },
  { href: "/app/inbox", label: "Inbox", key: "inbox", icon: Inbox },
  { href: "/app/week", label: "Week", key: "week", icon: CalendarRange },
  { href: "/app/focus", label: "Focus", key: "focus", icon: Timer },
  { href: "/app/routines", label: "Routines", key: "routines", icon: Repeat },
  { href: "/app/play", label: "Play", key: "play", icon: Gamepad2 },
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

const moreKeys = new Set(["routines", "stats", "settings", "templates", "more", "play"]);

export function AppShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const { signedIn } = useAppSession();
  const skipRef = useRef<HTMLAnchorElement>(null);

  // The timeline's now-line calls scrollIntoView on load, and Chrome moves the
  // sequential-focus starting point to whatever was scrolled to — so the very
  // first Tab would land mid-page and jump straight over "Skip to content".
  // Claim that first Tab for the skip link; once the user has pointed at
  // something, their click owns the starting point and we stay out of the way.
  useEffect(() => {
    let interacted = false;
    const onPointerDown = () => {
      interacted = true;
    };
    function handler(e: KeyboardEvent) {
      if (e.key !== "Tab" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (interacted) return;
      interacted = true;
      const focused = document.activeElement;
      if (focused && focused !== document.body && focused !== document.documentElement)
        return;
      if (!skipRef.current) return;
      e.preventDefault();
      skipRef.current.focus();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  // Keyboard shortcuts: n=new, t=today, i=inbox, w=week, f=focus, s=settings
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || target.tagName === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const routes: Record<string, string> = { n: "/app/editor", t: "/app/today", i: "/app/inbox", w: "/app/week", f: "/app/focus", s: "/app/settings", g: "/app/play" };
      const route = routes[e.key.toLowerCase()];
      if (route) { e.preventDefault(); window.location.href = route; }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <NowProvider enabled={signedIn}>
    <div className="flex min-h-dvh w-full bg-canvas">
      {/* Skip to content — keyboard accessibility */}
      <a
        ref={skipRef}
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-iris focus:px-4 focus:py-2 focus:text-ink-inverse focus:shadow-float"
      >
        Skip to content
      </a>
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

        <nav aria-label="Main navigation" className="mt-8 flex flex-col gap-1">
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

        <NowCard active={active} />

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
        <ShortcutsHint />
      </aside>

      {/* main */}
      {/* tabIndex -1 so "Skip to content" actually lands focus here. */}
      {/* Mobile bottom chrome is two layers, not one: the tab bar (~60px) and the
          floating now-bar above it (NowBar sits at bottom-[3.75rem]). pb-24 only
          cleared the tab bar, so the last row of More and the Apply control on
          Templates rendered underneath the now-bar. */}
      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 pb-32 outline-none md:pb-0"
      >
        {children}
      </main>
      {signedIn && <OfflineShell />}
      {signedIn && <NowStrip active={active} />}
      <CelebrationHost />
      {signedIn && <QuickCapture />}
      {signedIn && <OneThing />}
      {signedIn && <CommandPalette />}
      <ToastHost />

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
    </NowProvider>
  );
}

export function ShortcutsHint() {
  return (
    <div className="rounded-2xl border border-border bg-surface-sunken p-3 text-[11px] text-ink-soft">
      <p className="font-semibold uppercase tracking-wide">Shortcuts</p>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span><kbd className="rounded bg-surface px-1 font-mono">N</kbd> New</span>
        <span><kbd className="rounded bg-surface px-1 font-mono">C</kbd> Capture</span>
        <span><kbd className="rounded bg-surface px-1 font-mono">T</kbd> Today</span>
        <span><kbd className="rounded bg-surface px-1 font-mono">I</kbd> Inbox</span>
        <span><kbd className="rounded bg-surface px-1 font-mono">W</kbd> Week</span>
        <span><kbd className="rounded bg-surface px-1 font-mono">F</kbd> Focus</span>
        <span><kbd className="rounded bg-surface px-1 font-mono">O</kbd> One thing</span>
        <span><kbd className="rounded bg-surface px-1 font-mono">S</kbd> Settings</span>
      </div>
    </div>
  );
}
