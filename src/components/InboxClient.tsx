"use client";

/**
 * Inbox write path — create / promote / delete (10× Phase 5).
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarPlus,
  Flag,
  Plus,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import { catClasses, type CategoryId } from "@/lib/mock";
import { clientToday } from "@/lib/client-date";
import { toast } from "./Toast";

export type InboxItem = {
  id: string;
  title: string;
  emoji: string;
  category: CategoryId;
  tags: string[];
  priority: "none" | "low" | "high";
  revision: number;
};

function PriorityFlag({ level }: { level: "none" | "low" | "high" }) {
  if (level === "none") return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-bold ${
        level === "high"
          ? "bg-cat-peach text-cat-peach-ink"
          : "bg-surface-sunken text-ink-soft"
      }`}
    >
      <Flag size={11} fill="currentColor" />
      {level === "high" ? "High" : "Low"}
    </span>
  );
}

export function InboxClient({
  initialItems,
  authed,
}: {
  initialItems: InboxItem[];
  authed: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupMsg, setGroupMsg] = useState<string | null>(null);

  const groupByPriority = useCallback(async () => {
    if (!authed) {
      toast("Sign in to use AI grouping");
      return;
    }
    setBusy("group");
    setGroupMsg(null);
    try {
      const res = await fetch("/api/v1/ai/group-priority", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setGroupMsg(data?.error?.message ?? "AI grouping unavailable");
        setBusy(null);
        return;
      }
      if (data.message) {
        setGroupMsg(data.message);
        setBusy(null);
        return;
      }
      const priorityOf = new Map<string, "high" | "low" | "none">();
      for (const g of data.groups ?? []) {
        const p = (g.priority === "high" || g.priority === "low" ? g.priority : "none") as
          | "high"
          | "low"
          | "none";
        for (const id of g.taskIds ?? []) priorityOf.set(id, p);
      }
      setItems((prev) => {
        const next = prev.map((it) => ({
          ...it,
          priority: priorityOf.get(it.id) ?? it.priority,
        }));
        const rank = { high: 0, low: 1, none: 2 };
        return next.sort((a, b) => rank[a.priority] - rank[b.priority]);
      });
      toast("Grouped by priority (suggestion — save via edit later)");
    } catch {
      setGroupMsg("Network error");
    }
    setBusy(null);
  }, [authed]);

  const create = useCallback(async () => {
    const title = draft.trim();
    if (!title) return;
    if (!authed) {
      setError("Sign in to save inbox items.");
      return;
    }
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/v1/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "inbox",
          title,
          emoji: "📋",
          priority: "none",
        }),
      });
      if (!res.ok) {
        setError("Could not add item.");
        setBusy(null);
        return;
      }
      const task = await res.json();
      setItems((prev) => [
        {
          id: task.id,
          title: task.title,
          emoji: task.emoji ?? "📋",
          category: "sky",
          tags: [],
          priority: task.priority ?? "none",
          revision: task.revision ?? 1,
        },
        ...prev,
      ]);
      setDraft("");
      router.refresh();
    } catch {
      setError("Network error.");
    }
    setBusy(null);
  }, [draft, authed, router]);

  const remove = useCallback(
    async (item: InboxItem) => {
      if (!authed) return;
      setBusy(item.id);
      const res = await fetch(`/api/v1/tasks/${item.id}`, {
        method: "DELETE",
        headers: { "If-Match": String(item.revision) },
      });
      if (res.ok || res.status === 204) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        router.refresh();
        toast(`Deleted “${item.title}”`, {
          durationMs: 8000,
          actionLabel: "Undo",
          onAction: () => {
            void (async () => {
              const recreate = await fetch("/api/v1/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  bucket: "inbox",
                  title: item.title,
                  emoji: item.emoji,
                  priority: item.priority,
                }),
              });
              if (!recreate.ok) {
                toast("Could not restore item");
                return;
              }
              const task = await recreate.json();
              setItems((prev) => [
                {
                  ...item,
                  id: task.id,
                  revision: task.revision ?? 1,
                },
                ...prev,
              ]);
              router.refresh();
            })();
          },
        });
      } else {
        setError("Could not delete.");
      }
      setBusy(null);
    },
    [authed, router],
  );

  const promoteAnytime = useCallback(
    async (item: InboxItem) => {
      if (!authed) return;
      setBusy(item.id);
      const today = clientToday();
      const res = await fetch(`/api/v1/tasks/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(item.revision),
        },
        body: JSON.stringify({
          bucket: "anytime",
          date: today,
        }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        router.refresh();
      } else {
        // bucket may not be in PATCH schema — fall back: create anytime + delete inbox
        const createRes = await fetch("/api/v1/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket: "anytime",
            title: item.title,
            emoji: item.emoji,
            date: today,
            priority: item.priority,
          }),
        });
        if (createRes.ok) {
          await fetch(`/api/v1/tasks/${item.id}`, {
            method: "DELETE",
            headers: { "If-Match": String(item.revision) },
          });
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          router.refresh();
        } else {
          setError("Could not move to Anytime.");
        }
      }
      setBusy(null);
    },
    [authed, router],
  );

  const scheduleToday = useCallback(
    (item: InboxItem) => {
      const params = new URLSearchParams({
        title: item.title,
        date: clientToday(),
        start: String(10 * 60),
      });
      router.push(`/app/editor?${params}`);
    },
    [router],
  );

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          disabled={!authed || busy === "group" || items.length === 0}
          onClick={() => void groupByPriority()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-iris transition-colors hover:bg-iris-ghost disabled:opacity-50"
        >
          <Sparkles size={14} />
          {busy === "group" ? "Grouping…" : "Group by priority"}
        </button>
      </div>
      {groupMsg && (
        <p className="mb-2 text-[13px] font-medium text-ink-soft">{groupMsg}</p>
      )}
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-card focus-within:ring-2 focus-within:ring-iris">
        <Plus size={18} className="shrink-0 text-ink-faint" />
        <input
          className="w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-ink-faint"
          placeholder="Get it out of your head…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void create();
            }
          }}
          disabled={busy === "create"}
        />
        <button
          type="button"
          onClick={() => void create()}
          disabled={!draft.trim() || busy === "create"}
          className="shrink-0 rounded-lg bg-iris px-2.5 py-1 text-[12px] font-bold text-ink-inverse disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {items.map((item) => {
          const cat = catClasses[item.category] ?? catClasses.sky;
          return (
            <li
              key={item.id}
              className="group flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-card"
            >
              <span
                className={`grid size-10 place-items-center rounded-xl text-lg ${cat.fill}`}
                aria-hidden
              >
                {item.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{item.title}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <PriorityFlag level={item.priority} />
                </div>
              </div>
              {authed && (
                <div className="flex flex-wrap items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button
                    type="button"
                    title="Move to Anytime"
                    aria-label={`Move ${item.title} to Anytime`}
                    disabled={busy === item.id}
                    onClick={() => void promoteAnytime(item)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-ink-soft hover:bg-surface-sunken hover:text-ink"
                  >
                    <Sun size={14} />
                    Anytime
                  </button>
                  <button
                    type="button"
                    title="Schedule today"
                    aria-label={`Schedule ${item.title} today`}
                    onClick={() => scheduleToday(item)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-iris hover:bg-iris-ghost"
                  >
                    <CalendarPlus size={14} />
                    Schedule
                    <ArrowRight size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${item.title}`}
                    disabled={busy === item.id}
                    onClick={() => void remove(item)}
                    className="grid size-8 place-items-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[14px] text-ink-soft">
            Inbox is empty. Dump a thought above.
          </li>
        )}
      </ul>
    </>
  );
}
