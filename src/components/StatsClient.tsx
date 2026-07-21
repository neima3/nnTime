"use client";

import { useEffect, useState } from "react";
import { BarChart3, Flame } from "lucide-react";
import { toast } from "./Toast";
import { SignedOutCard, SkeletonCards } from "./EmptyState";
import { RewardGarden } from "./RewardGarden";
import { WeeklyReflection } from "./WeeklyReflection";

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

type Stats = {
  byDate: Record<string, { completed: number; focusMin: number; mood: string | null }>;
  streak: { current: number; best: number };
  totalCompleted: number;
  totalFocusMin: number;
  days: number;
  estimate: EstimateCalibration | null;
  focusHours: FocusHours | null;
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

export function StatsClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [authed, setAuthed] = useState(true);
  const [moodBusy, setMoodBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/stats?days=14")
      .then(async (r) => {
        if (r.status === 401) {
          if (!cancelled) setAuthed(false);
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!cancelled && data) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendMood(mood: string) {
    setMoodBusy(true);
    const res = await fetch("/api/v1/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood }),
    });
    setMoodBusy(false);
    if (!res.ok) {
      toast("Could not save mood");
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
      />
    );
  }

  if (!stats) {
    return <SkeletonCards count={4} />;
  }

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
      completed: stats.byDate[key]?.completed ?? 0,
    };
  });
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
            Focus lands most often around {stats.focusHours.peakHour}:00.
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
