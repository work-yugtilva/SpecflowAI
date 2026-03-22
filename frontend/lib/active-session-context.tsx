"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ACTIVE_SESSION_CHANGE_EVENT,
  LS_ACTIVE_SESSION,
  getActiveSessionId,
  setActiveSessionId as persistActiveSessionId,
} from "@/lib/pipeline-input";
import { useSessionStore } from "@/lib/store/session-store";

type ActiveSessionContextValue = {
  activeSessionId: string | null;
  /** Persist id and notify listeners (same tab + storage for other tabs). */
  selectSession: (sessionId: string | null) => void;
};

const ActiveSessionContext = createContext<ActiveSessionContextValue | null>(
  null
);

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  // Always null on first render (server + client) so SSR HTML matches hydration.
  // Read localStorage only after mount — avoids React #418 hydration errors.
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const storeSelectSession = useSessionStore((s) => s.selectSession);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);

  useEffect(() => {
    setActiveSessionIdState(getActiveSessionId());
    // Hydrate Zustand store from backend on mount
    fetchSessions();

    const onStorage = (e: StorageEvent) => {
      if (e.key !== LS_ACTIVE_SESSION) return;
      setActiveSessionIdState(getActiveSessionId());
    };
    const onCustom = () => {
      setActiveSessionIdState(getActiveSessionId());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(ACTIVE_SESSION_CHANGE_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ACTIVE_SESSION_CHANGE_EVENT, onCustom);
    };
  }, [fetchSessions]);

  const selectSession = useCallback((sessionId: string | null) => {
    persistActiveSessionId(sessionId);
    setActiveSessionIdState(sessionId);
    // Sync to Zustand store
    storeSelectSession(sessionId);
  }, [storeSelectSession]);

  const value = useMemo(
    () => ({ activeSessionId, selectSession }),
    [activeSessionId, selectSession]
  );

  return (
    <ActiveSessionContext.Provider value={value}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession(): ActiveSessionContextValue {
  const ctx = useContext(ActiveSessionContext);
  if (!ctx) {
    throw new Error("useActiveSession must be used within ActiveSessionProvider");
  }
  return ctx;
}

/** Safe for components that may render outside the provider (e.g. tests). */
export function useActiveSessionOptional(): ActiveSessionContextValue | null {
  return useContext(ActiveSessionContext);
}
