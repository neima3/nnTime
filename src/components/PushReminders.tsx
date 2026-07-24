"use client";

/**
 * Push Reminders (F1) — opt in to real Web Push nudges that arrive even when
 * the tab is closed (unlike the in-app "Transition warnings"). Subscribes the
 * browser via the service worker + VAPID, stores the subscription server-side,
 * and offers a one-tap test so you can feel it work.
 */

import { useEffect, useState } from "react";
import { toast } from "./Toast";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushReminders() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    /* eslint-disable react-hooks/set-state-in-effect */
    setSupported(ok);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast("Allow notifications in your browser to get reminders");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/v1/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setSubscribed(true);
      toast("Reminders on — sending you a test…");
      await fetch("/api/v1/push/test", { method: "POST" });
    } catch {
      toast("Couldn't turn on reminders — try again");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/v1/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast("Reminders off");
    } catch {
      toast("Couldn't turn off reminders");
    }
    setBusy(false);
  }

  if (!supported) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink">Push reminders</p>
        <p className="text-[12.5px] text-ink-soft">
          Real nudges before each block — even when Kairo is closed
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {subscribed && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void fetch("/api/v1/push/test", { method: "POST" }).then(() => toast("Test sent"))}
            className="rounded-xl border border-border px-3 py-1.5 text-[12px] font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
          >
            Test
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => (subscribed ? void disable() : void enable())}
          className={`rounded-xl px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-50 ${
            subscribed
              ? "bg-surface-sunken text-ink"
              : "bg-iris text-ink-inverse hover:bg-iris-deep"
          }`}
        >
          {busy ? "…" : subscribed ? "On" : "Turn on"}
        </button>
      </div>
    </div>
  );
}
