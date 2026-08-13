"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Flame, RefreshCw } from "lucide-react";
import { toast } from "./Toast";
import { SignedOutCard, SkeletonCards } from "./EmptyState";
import { clientRecentDays } from "@/lib/client-date";
import { getSettingsCached } from "@/lib/settings-cache";
import { formatHourLabel } from "@/lib/time-format";
import { useHourCycle } from "@/lib/use-hour-cycle";
import { RewardGarden } from "./RewardGarden";
import { WeeklyReflection } from "./WeeklyReflection";
import { sendReplaySafeCreate } from "@/lib/offline-mutation";

type EstimateCalibration = {
  sessions: number;
  avgTargetMin: number;
  avgActualMin: number;
  ratio: number;
};

type FocusHours = {
  hours: number[];
  peakHour: number;
};

type EnergyPattern = {
  byHour: number[];
  sampled: number;
  window: { start: number; end: number } | null;
};

type Stats = {
  byDate: Record<string, { completed: number; focusMin: number; mood: string | null }>;
  streak: { current: number; best: number };
  totalCompleted: number;
  totalFocusMin: number;
  days: number;
  estimate: EstimateCalibration | null;
  focusHours: FocusHours | null;
  energyPattern?: EnergyPattern | null;
};

const MOODS = [
  { id: "low", label: "Low", emoji: "🌧️" },
  { id: "okay", label: "Okay", emoji: "⛅" },
  { id: "good", label: "Good", emoji: "🌤️" },
  { id: "great", label: "Great", emoji: "☀️" },
] as const;

function Card({
  title,
  hint,
  children,
  wide,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={`rounded-3xl border border-border bg-surface p-5 shadow-card ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <h2 className="font-display text-base font-bold">{title}</h2>
      {hint && <p className="mt-0.5 text-[12.5px] text-ink-soft">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Load failed (not a session problem) — say so and offer the way back. */
function LoadErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section
      role="alert"
      className="mx-auto max-w-md rounded-3xl border border-border bg-surface px-6 py-10 text-center shadow-card"
    >
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
        <BarChart3 size={26} strokeWidth={2.2} />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold tracking-tight">
        Your numbers didn’t load
      </h2>
      <p className="mx-auto mt-1.5 max-w-xs text-[14px] leading-relaxed text-ink-soft">
        {message} Nothing is lost — it’s just this screen.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-iris px-5 py-2.5 text-[14px] font-semibold text-ink-inverse shadow-card transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
      >
        <RefreshCw size={16} />
        Try again
      </button>
    </section>
  );
}

export function StatsClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [authed, setAuthed] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [zone, setZone] = useState<string | undefined>(undefined);
  const [moodBusy, setMoodBusy] = useState(false);
  const hourCycle = useHourCycle();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/stats?days=14")
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) {
          setAuthed(false);
          return;
        }
        if (!r.ok) {
          setLoadError("Couldn’t load your numbers just now.");
          return;
        }
        const data = await r.json();
        if (cancelled) return;
        setStats(data);
        setLoadError(null);
      })
      .catch(() => {
        // A thrown fetch is the network, not the session — never sign the page
        // out from under someone who is already authorized.
        if (!cancelled) setLoadError("Couldn’t reach the server.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Chart days must be keyed in the planning zone the server buckets by.
  useEffect(() => {
    let cancelled = false;
    void getSettingsCached().then((s) => {
      if (!cancelled && s?.timezone) setZone(s.timezone);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = useCallback(() => {
    setLoadError(null);
    setReloadKey((k) => k + 1);
  }, []);

  async function sendMood(mood: string) {
    setMoodBusy(true);
    const delivery = await sendReplaySafeCreate({
      path: "/api/v1/mood",
      body: { mood },
    });
    setMoodBusy(false);
    if (delivery.state === "queued") {
      toast("Mood saved on this device — it’ll sync when you’re back");
      return;
    }
    if (delivery.state === "unavailable") {
      toast("You’re offline and this device couldn’t save that mood");
      return;
    }
    if (!delivery.response.ok) {
      toast("Couldn't save that — try again");
      return;
    }
    toast("Mood noted — thank you");
  }

  if (!authed) {
    return (
      <SignedOutCard
        icon={BarChart3}
        title="See your gentle numbers"
        body="Completions, focus time, soft streaks, and mood — described, never judged. Sign in to start collecting yours."
        returnTo="/app/stats"
      />
    );
  }

  if (!stats) {
    if (loadError) {
      return <LoadErrorCard message={loadError} onRetry={retry} />;
    }
    return <SkeletonCards count={4} />;
  }

  const last7 = clientRecentDays(7, zone).map((d) => ({
    ...d,
    completed: stats.byDate[d.key]?.completed ?? 0,
  }));
  const maxC = Math.max(1, ...last7.map((d) => d.completed));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <RewardGarden
        totalCompleted={stats.totalCompleted}
        totalFocusMin={stats.totalFocusMin}
        days={stats.days}
      />

      <WeeklyReflection
        byDate={stats.byDate}
        totalCompleted={stats.totalCompleted}
        totalFocusMin={stats.totalFocusMin}
        peakHour={stats.focusHours?.peakHour ?? null}
      />

      <Card title="This week" hint="Completions — no judgment, just shape">
        <div className="flex items-end justify-between gap-2">
          {last7.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="tnum text-[10.5px] font-semibold text-ink-faint">
                {d.completed > 0 ? d.completed : "·"}
              </span>
              <div className="flex h-24 w-full items-end rounded-lg bg-surface-sunken">
                <div
                  className="w-full rounded-lg bg-iris/70"
                  style={{
                    height: `${Math.max((d.completed / maxC) * 100, d.completed > 0 ? 10 : 0)}%`,
                  }}
                />
              </div>
              <span className="text-[11px] font-bold text-ink-soft">{d.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Soft streak" hint="1-day grace · never shaming">
        <div className="flex items-center gap-3">
          <Flame size={28} className="text-iris" />
          <div>
            <p className="tnum font-display text-3xl font-bold">
              {stats.streak.current}
            </p>
            <p className="text-[13px] text-ink-soft">
              current · best {stats.streak.best}
            </p>
          </div>
        </div>
      </Card>

      <Card title="Totals (14 days)">
        <dl className="space-y-2 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Completed</dt>
            <dd className="tnum font-bold">{stats.totalCompleted}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Focus minutes</dt>
            <dd className="tnum font-bold">{stats.totalFocusMin}</dd>
          </div>
        </dl>
      </Card>

      {stats.estimate && (
        <Card title="Time truth" hint="From your own focus sessions · last 14 days">
          <p className="text-[14px] leading-relaxed text-ink">
            {stats.estimate.ratio >= 1.15 ? (
              <>
                Your {stats.estimate.avgTargetMin}-min focus plans actually run
                about {stats.estimate.avgActualMin} min. That&apos;s normal —
                plan ×{stats.estimate.ratio} and you&apos;ll land on time.
              </>
            ) : (
              <>
                Your time estimates are landing — plans and reality match. Rare
                skill. Keep it.
              </>
            )}
          </p>
        </Card>
      )}

      {stats.focusHours && (
        <Card title="Your focus hours" hint="Focus sessions by time of day · last 30 days" wide>
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
            {stats.focusHours.hours.map((count, hour) => {
              const max = Math.max(1, ...stats.focusHours!.hours);
              const intensity = count > 0 ? 0.18 + (count / max) * 0.82 : 0.08;
              return (
                <div
                  key={hour}
                  className="h-5 rounded-sm bg-iris"
                  style={{ opacity: intensity }}
                  title={`${hour}:00 — ${count} session${count === 1 ? "" : "s"}`}
                />
              );
            })}
          </div>
          <div className="relative mt-1 h-3.5 text-[10px] font-semibold text-ink-faint">
            <span className="absolute left-1/4 -translate-x-1/2">6a</span>
            <span className="absolute left-1/2 -translate-x-1/2">12p</span>
            <span className="absolute left-3/4 -translate-x-1/2">6p</span>
          </div>
          <p className="mt-2 text-[13px] text-ink-soft">
            Focus lands most often around {formatHourLabel(stats.focusHours.peakHour, hourCycle)}.
          </p>
        </Card>
      )}

      {stats.energyPattern?.window && (
        <Card
          title="Your charged hours"
          hint="When heavy plans actually get done · last 60 days"
          wide
        >
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
            {stats.energyPattern.byHour.map((count, hour) => {
              const w = stats.energyPattern!.window!;
              const inWindow =
                w.start < w.end
                  ? hour >= w.start && hour < w.end
                  : hour >= w.start || hour < w.end;
              const max = Math.max(1, ...stats.energyPattern!.byHour);
              const intensity = count > 0 ? 0.25 + (count / max) * 0.75 : 0.08;
              return (
                <div
                  key={hour}
                  className={`h-5 rounded-sm bg-cat-mint-ink ${
                    inWindow ? "ring-1 ring-cat-mint-ink/60" : ""
                  }`}
                  style={{ opacity: inWindow ? Math.max(intensity, 0.35) : intensity }}
                  title={`${formatHourLabel(hour, hourCycle)} — ${count} heavy ${
                    count === 1 ? "thing" : "things"
                  } done`}
                />
              );
            })}
          </div>
          <div className="relative mt-1 h-3.5 text-[10px] font-semibold text-ink-faint">
            <span className="absolute left-1/4 -translate-x-1/2">6a</span>
            <span className="absolute left-1/2 -translate-x-1/2">12p</span>
            <span className="absolute left-3/4 -translate-x-1/2">6p</span>
          </div>
          <p className="mt-2 text-[13px] text-ink-soft">
            Your high-energy work tends to land{" "}
            {formatHourLabel(stats.energyPattern.window.start, hourCycle)}–
            {formatHourLabel(stats.energyPattern.window.end, hourCycle)}. When you
            plan something heavy, that&apos;s friendly ground — Plan my day knows
            it too.
          </p>
        </Card>
      )}

      <Card title="Mood check-in" hint="One tap · private">
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={moodBusy}
              onClick={() => void sendMood(m.id)}
              className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface-raised px-3 py-2 text-[12px] font-semibold hover:bg-iris-ghost focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none disabled:opacity-50"
            >
              <span className="text-xl" aria-hidden>
                {m.emoji}
              </span>
              {m.label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
