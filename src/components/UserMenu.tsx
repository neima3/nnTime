"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { LogIn, LogOut } from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";
import { forgetUser, purgeUserCache } from "@/lib/offline-queue";

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Session-aware footer control for the app shell. Shows the signed-in user and
 * a sign-out action, or a sign-in link when browsing the design preview
 * logged-out. Client component (reads the session cookie via Better Auth).
 */
export function UserMenu() {
  const router = useRouter();
  const { data, isPending } = useSession();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  // Offline, the session fetch can fail or never resolve — that is not
  // evidence the user signed out, and "Sign in" is a dead end without a
  // network anyway. Hold the neutral placeholder instead.
  if (isPending || (!data?.user && !online)) {
    return <div className="h-11 animate-pulse rounded-xl bg-surface-sunken" aria-hidden />;
  }

  if (!data?.user) {
    return (
      <Link
        href="/sign-in"
        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-iris transition-colors hover:bg-iris-soft"
      >
        <LogIn size={18} />
        Sign in
      </Link>
    );
  }

  const label = data.user.name || data.user.email;
  const initial = (label ?? "?").trim().charAt(0).toUpperCase();
  const userId = data.user.id;

  async function handleSignOut() {
    // ADR-002: offline caches are personal data — purge them with the session.
    await purgeUserCache(userId).catch(() => {});
    forgetUser();
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-iris-soft text-[13px] font-bold text-iris">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight">{data.user.name || "You"}</p>
        <p className="truncate text-[11.5px] text-ink-faint">{data.user.email}</p>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        aria-label="Sign out"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
