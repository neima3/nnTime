"use client";

import { useEffect } from "react";
import { initPendingSignOutFlush } from "@/lib/pending-sign-out";

/**
 * Root-layout listener so a deferred offline sign-out still expires the
 * HttpOnly session cookie after reconnect — including after a full
 * navigation that destroyed UserMenu's in-memory retry.
 */
export function PendingSignOutFlush() {
  useEffect(() => initPendingSignOutFlush(), []);
  return null;
}
