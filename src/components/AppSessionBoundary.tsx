"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

type AppSessionUser = { id: string; name: string | null; email: string };

type AppSessionState = {
  signedIn: boolean;
  user: AppSessionUser | null;
};

const AppSessionContext = createContext<AppSessionState>({
  signedIn: false,
  user: null,
});

export function AppSessionProvider({
  signedIn,
  user = null,
  children,
}: {
  signedIn: boolean;
  user?: AppSessionUser | null;
  children?: ReactNode;
}) {
  return (
    <AppSessionContext.Provider value={{ signedIn, user }}>
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
