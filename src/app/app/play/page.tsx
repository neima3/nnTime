import { AppShell } from "@/components/AppShell";
import { PlayClient } from "@/components/PlayClient";

export const metadata = {
  title: "Brain breaks · Kairo",
};

export default function PlayPage() {
  return (
    <AppShell active="play">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Brain breaks
        </h1>
        <p className="mt-1.5 max-w-md text-[14.5px] text-ink-soft">
          Two minutes of play counts as rest. No streaks, no scores that
          matter — just your own bests and a softer landing between things.
        </p>
        <div className="mt-8">
          <PlayClient />
        </div>
        <p className="mt-8 text-[12px] leading-relaxed text-ink-faint">
          Honesty corner: these are breaks, not brain training — the science
          on games &ldquo;fixing&rdquo; attention is thin, and we won&apos;t
          pretend otherwise. They&apos;re here because fun is allowed.
        </p>
      </div>
    </AppShell>
  );
}
