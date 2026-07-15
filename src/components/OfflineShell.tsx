"use client";

import { useSession } from "@/lib/auth-client";
import { OfflineIndicator } from "./OfflineIndicator";

/** Mounts offline queue for the signed-in user (AppShell footer). */
export function OfflineShell() {
  const { data } = useSession();
  const userId = data?.user?.id ?? null;
  return <OfflineIndicator userId={userId} />;
}
