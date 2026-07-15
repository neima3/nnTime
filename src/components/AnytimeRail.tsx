"use client";

/**
 * Anytime sidebar — schedule into editor or dismiss (complete) a task.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check } from "lucide-react";
import { catClasses, type CategoryId } from "@/lib/mock";
import { toast } from "./Toast";

export type AnytimeItem = {
  id: string;
  title: string;
  emoji: string;
  category: CategoryId;
  revision: number;
};

export function AnytimeRail({
  items: initial,
  date,
  authed,
}: {
  items: AnytimeItem[];
  date: string;
  authed: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);

  const schedule = useCallback(
    (item: AnytimeItem) => {
      const params = new URLSearchParams({
        title: item.title,
        date,
        start: String(10 * 60),
      });
      router.push(`/app/editor?${params}`);
    },
    [date, router],
  );

  const dismiss = useCallback(
    async (item: AnytimeItem) => {
      if (!authed) {
        toast("Sign in to update Anytime");
        return;
      }
      const res = await fetch(`/api/v1/tasks/${item.id}`, {
        method: "DELETE",
        headers: { "If-Match": String(item.revision) },
      });
      if (!res.ok && res.status !== 204) {
        toast("Could not clear item");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      toast("Cleared from Anytime");
      router.refresh();
    },
    [authed, router],
  );

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Anytime</h2>
        <span className="rounded-full bg-iris-soft px-2 py-0.5 text-[12px] font-bold text-iris">
          {items.length}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-ink-soft">
        No time pressure — schedule one when you have space.
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((t) => {
          const cat = catClasses[t.category];
          return (
            <li
              key={t.id}
              className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 ${cat.fill}`}
            >
              <span className="text-base" aria-hidden>
                {t.emoji}
              </span>
              <span className={`min-w-0 flex-1 truncate text-[14px] font-semibold ${cat.ink}`}>
                {t.title}
              </span>
              {authed && (
                <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button
                    type="button"
                    aria-label={`Schedule ${t.title}`}
                    title="Schedule today"
                    onClick={() => schedule(t)}
                    className={`grid size-7 place-items-center rounded-lg ${cat.ink} hover:bg-surface-raised/50`}
                  >
                    <CalendarPlus size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Clear ${t.title}`}
                    title="Done / clear"
                    onClick={() => void dismiss(t)}
                    className={`grid size-7 place-items-center rounded-lg ${cat.ink} hover:bg-surface-raised/50`}
                  >
                    <Check size={14} strokeWidth={3} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="text-[13px] text-ink-faint">No anytime items.</li>
        )}
      </ul>
    </div>
  );
}
