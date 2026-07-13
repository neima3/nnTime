import { Check, Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";

/* Design addendum as a living screen: timeline edge cases (Phases 2C/5A/5B).
   Executors copy these exact treatments. */

function Label({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <header className="mb-4 mt-12 first:mt-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
        Addendum {n}
      </p>
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-lg text-[14px] leading-relaxed text-ink-soft">{sub}</p>
    </header>
  );
}

function Gutter({ times }: { times: string[] }) {
  return (
    <div className="flex w-12 shrink-0 flex-col justify-between py-1 text-right">
      {times.map((t) => (
        <span key={t} className="tnum text-[12px] font-medium text-ink-faint">
          {t}
        </span>
      ))}
    </div>
  );
}

export default function TimelineStatesPage() {
  return (
    <AppShell active="today">
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Timeline states
        </h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          Binding reference for edge-case rendering. Copy, don&apos;t improvise.
        </p>

        {/* 1 — Overlaps */}
        <Label
          n="1"
          title="Overlapping activities"
          sub="Overlaps share the width in side-by-side lanes (equal split, 6px gap, max 3 lanes; 4+ collapses into a '+n more' stack). Cards go compact; lane order = start time, then duration."
        />
        <div className="flex gap-3 rounded-3xl border border-border bg-surface p-5 shadow-card">
          <Gutter times={["14:00", "15:00", "16:00"]} />
          <div className="relative h-52 flex-1">
            <div className="absolute inset-x-0 top-0 h-px bg-border" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
            {/* lane 1 */}
            <div className="absolute left-0 top-2 flex h-[45%] w-[calc(50%-3px)] items-start gap-2 rounded-2xl bg-cat-sky px-3 py-2">
              <span className="grid size-7 place-items-center rounded-full bg-surface-raised/80 text-sm">💊</span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-cat-sky-ink">Shift prep</p>
                <p className="tnum text-[11px] font-medium text-cat-sky-ink opacity-70">14:00 – 15:00</p>
              </div>
            </div>
            {/* lane 2 */}
            <div className="absolute right-0 top-[18%] flex h-[52%] w-[calc(50%-3px)] items-start gap-2 rounded-2xl bg-cat-rose px-3 py-2">
              <span className="grid size-7 place-items-center rounded-full bg-surface-raised/80 text-sm">📞</span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-cat-rose-ink">Call Sahar</p>
                <p className="tnum text-[11px] font-medium text-cat-rose-ink opacity-70">14:20 – 15:25</p>
              </div>
            </div>
            {/* full width after overlap */}
            <div className="absolute inset-x-0 bottom-1 flex h-[22%] items-center gap-2 rounded-2xl bg-cat-mint px-3 py-1.5">
              <span className="grid size-7 place-items-center rounded-full bg-surface-raised/80 text-sm">🚶</span>
              <p className="truncate text-[13px] font-semibold text-cat-mint-ink">
                Walk <span className="tnum font-medium opacity-70">15:30 – 16:00</span>
              </p>
            </div>
          </div>
        </div>

        {/* 2 — Overnight split */}
        <Label
          n="2"
          title="Overnight activities"
          sub="A block crossing midnight renders on both days, split at 0:00. The cut edge is flattened and labeled; both halves open the same occurrence."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { day: "Saturday", time: "22:30 – 0:00", cap: "continues after midnight ↓", flat: "rounded-b-none border-b-2 border-dashed border-cat-lilac-ink/40" },
            { day: "Sunday", time: "0:00 – 0:30", cap: "↑ started yesterday 22:30", flat: "rounded-t-none border-t-2 border-dashed border-cat-lilac-ink/40" },
          ].map((half) => (
            <div key={half.day} className="rounded-3xl border border-border bg-surface p-5 shadow-card">
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-soft">
                {half.day}
              </p>
              <div className={`flex items-center gap-3 rounded-2xl bg-cat-lilac px-3.5 py-3 ${half.flat}`}>
                <span className="grid size-9 place-items-center rounded-full bg-surface-raised/80 text-base">🎬</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-cat-lilac-ink">Movie night</p>
                  <p className="tnum text-[11.5px] font-medium text-cat-lilac-ink opacity-70">{half.time}</p>
                </div>
              </div>
              <p className="mt-1.5 text-center text-[11.5px] font-semibold text-ink-faint">
                {half.cap}
              </p>
            </div>
          ))}
        </div>

        {/* 3 — Imported locked blocks */}
        <Label
          n="3"
          title="Imported calendar events"
          sub="Read-only: surface fill (no category pastel), 1.5px solid ink-faint border, lock badge, source caption. No drag handles, no complete button — tapping shows details with 'Open in Google Calendar'."
        />
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-ink-faint/50 bg-surface-raised px-3.5 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-surface-sunken text-base">📅</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-ink">
                Pharmacy staff meeting
              </p>
              <p className="tnum text-[11.5px] font-medium text-ink-soft">
                16:00 – 16:45 · Google · Work calendar
              </p>
            </div>
            <span className="grid size-7 place-items-center rounded-full bg-surface-sunken text-ink-faint" aria-label="Read-only">
              <Lock size={13} />
            </span>
          </div>
        </div>

        {/* 4 — Reduced stimulation */}
        <Label
          n="4"
          title="Reduced-stimulation mode"
          sub="Global toggle (Settings → Appearance): pastel fills become thin category-ink outlines on surface, emoji hidden, chips hidden, meta condensed. Same geometry — only the volume drops."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-soft">Standard</p>
            <div className="flex items-center gap-3 rounded-2xl bg-cat-sky px-3.5 py-3">
              <span className="grid size-9 place-items-center rounded-full bg-surface-raised/80 text-base">💊</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-cat-sky-ink">Pharmacy shift prep</p>
                <p className="tnum text-[11.5px] font-medium text-cat-sky-ink opacity-70">13:30 – 14:30 · 1 h</p>
              </div>
              <span className="size-6 rounded-full border-2 border-current opacity-40 text-cat-sky-ink" />
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-soft">Reduced</p>
            <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-cat-sky-ink/50 bg-surface px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">Pharmacy shift prep</p>
                <p className="tnum text-[11.5px] font-medium text-ink-soft">13:30 · 1 h</p>
              </div>
              <span className="grid size-6 place-items-center rounded-full border-2 border-border-strong">
                <Check size={12} className="text-transparent" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
