"use client";

/**
 * Plan my day — AI proposes schedule chips; user accepts into editor (SEC-05).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { clientToday } from "@/lib/client-date";
import { useLowBattery } from "./LowBattery";
import { toast } from "./Toast";

type Proposal = {
  taskId: string;
  scheduledStart?: string;
  reason?: string;
  title?: string;
};

export function PlanDayClient() {
  const router = useRouter();
  const [energyChoice, setEnergyChoice] = useState<"low" | "medium" | "high">("medium");
  const [energyTouched, setEnergyTouched] = useState(false);
  const lowBattery = useLowBattery(clientToday());
  const [loading, setLoading] = useState(false);

  // On a low-battery day, plan gently by default — unless they've said otherwise.
  // Derived (no effect) so it can't cascade renders.
  const energy: "low" | "medium" | "high" =
    !energyTouched && lowBattery ? "low" : energyChoice;
  const [items, setItems] = useState<Proposal[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/ai/plan-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ energy }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setError("Sign in to plan your day with AI.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not plan day.");
        setLoading(false);
        return;
      }
      setItems(data.items ?? []);
      setMessage(data.message ?? null);
      if (!(data.items ?? []).length && !data.message) {
        setMessage("No suggestions — try adding inbox tasks first.");
      }
    } catch {
      setError("Couldn't reach the server. Please try again.");
    }
    setLoading(false);
  }

  function accept(item: Proposal) {
    const start = item.scheduledStart ?? "10:00";
    const [h, m] = start.split(":").map(Number);
    const mins = (h ?? 10) * 60 + (m ?? 0);
    const params = new URLSearchParams({
      title: item.title ?? "Planned task",
      date: clientToday(),
      start: String(mins),
    });
    toast("Opening editor — confirm to save");
    router.push(`/app/editor?${params}`);
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-card">
      <div className="flex items-center gap-2 text-iris">
        <Sparkles size={18} />
        <h2 className="font-display text-xl font-bold text-ink">Plan my day</h2>
      </div>
      <p className="mt-1.5 text-[14px] text-ink-soft">
        AI proposes times for your inbox/anytime tasks. Nothing lands until you
        accept each chip.
      </p>

      {lowBattery && (
        <p className="mt-3 rounded-2xl border border-iris/25 bg-iris-ghost px-3.5 py-2.5 text-[12.5px] font-medium text-ink-soft">
          🔋 Low-battery day — planning gently. Heavier tasks sit this one out.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">
          Energy
        </span>
        {(["low", "medium", "high"] as const).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => {
              setEnergyChoice(e);
              setEnergyTouched(true);
            }}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold capitalize ${
              energy === e
                ? "bg-iris text-ink-inverse"
                : "border border-border text-ink-soft"
            }`}
          >
            {e}
          </button>
        ))}
        <button
          type="button"
          disabled={loading}
          onClick={() => void run()}
          className="ml-auto rounded-xl bg-iris px-4 py-2 text-[13px] font-semibold text-ink-inverse disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Suggest plan"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 text-[13px] text-ink-soft">{message}</p>
      )}

      <ul className="mt-5 space-y-2">
        {items.map((item, i) => (
          <li
            key={`${item.taskId}-${i}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface-raised px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">
                {item.title ?? item.taskId.slice(0, 8)}
              </p>
              <p className="tnum text-[12px] text-ink-soft">
                {item.scheduledStart ?? "flex"}
                {item.reason ? ` · ${item.reason}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => accept(item)}
              className="inline-flex items-center gap-1 rounded-xl bg-iris-soft px-3 py-1.5 text-[12px] font-semibold text-iris-deep"
            >
              Accept
              <ArrowRight size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
