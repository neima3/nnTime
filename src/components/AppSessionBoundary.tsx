"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

type AppSessionState = {
  signedIn: boolean;
};

const AppSessionContext = createContext<AppSessionState>({ signedIn: false });

export function AppSessionProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children?: ReactNode;
}) {
  return (
    <AppSessionContext.Provider value={{ signedIn }}>
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession(): AppSessionState {
  return useContext(AppSessionContext);
}

export function SignedInOnly({
  children,
  fallback = null,
}: {
  children?: ReactNode;
  fallback?: ReactNode;
}) {
  const { signedIn } = useAppSession();
  return signedIn ? children : fallback;
}
