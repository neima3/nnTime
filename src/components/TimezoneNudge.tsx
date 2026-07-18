"use client";

/**
 * One-time banner for accounts whose planning timezone is still the UTC
 * default while the browser reports a real zone — the whole timeline (now-line,
 * day boundaries) runs in the wrong zone until it's fixed. One tap applies the
 * browser zone; "Keep UTC" dismisses forever (localStorage).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2 } from "lucide-react";
import { detectTimezone } from "@/lib/timezone";

const DISMISS_KEY = "kairo-tz-nudge-dismissed";

export function TimezoneNudge({ zone }: { zone: string }) {
  const router = useRouter();
  const [browserZone, setBrowserZone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (zone !== "UTC") return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {}
    const tz = detectTimezone();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (tz !== "UTC") setBrowserZone(tz);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [zone]);

  if (zone !== "UTC" || !browserZone || hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const apply = async () => {
    setPending(true);
    try {
      const current = await fetch("/api/v1/settings").then((r) =>
        r.ok ? r.json() : null,
      );
      if (!current) {
        setPending(false);
        return;
      }
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(current.revision),
        },
        body: JSON.stringify({ timezone: browserZone }),
      });
      if (res.ok) {
        setHidden(true);
        router.refresh();
        return;
      }
    } catch {}
    setPending(false);
  };

  const cityLabel = browserZone.split("/").pop()?.replace(/_/g, " ") ?? browserZone;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-iris/30 bg-iris-ghost px-4 py-3">
      <Globe size={18} className="shrink-0 text-iris" aria-hidden />
      <p className="min-w-0 flex-1 text-[13.5px] font-medium text-ink">
        Your planner is set to UTC, but you seem to be in{" "}
        <span className="font-bold">{cityLabel}</span>. Switch so the timeline
        matches your clock?
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void apply()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-iris px-3.5 py-1.5 text-[13px] font-semibold text-ink-inverse transition-colors hover:bg-iris-deep disabled:opacity-70"
        >
          {pending && <Loader2 size={13} className="animate-spin" />}
          Use {cityLabel}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-sunken"
        >
          Keep UTC
        </button>
      </div>
    </div>
  );
}
