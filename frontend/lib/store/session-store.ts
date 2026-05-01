import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createSession as apiCreateSession,
  getSession as apiGetSession,
  listSessions as apiListSessions,
  type SessionSummary,
  type SessionDetail,
} from "@/lib/api/session";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionStoreState {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeSessionDetail: SessionDetail | null;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncError: string | null;
}

export interface SessionStoreActions {
  /** Fetch sessions from backend and merge into local state. */
  fetchSessions: () => Promise<void>;
  /** Create a session (optimistic local insert + async backend write). */
  createSession: (name: string, metadata?: Record<string, unknown>) => Promise<SessionSummary>;
  /** Switch the active session and hydrate its detail. */
  selectSession: (sessionId: string | null) => void;
  /** Load full detail for a session from the backend. */
  hydrateSession: (sessionId: string) => Promise<SessionDetail | null>;
  /** Replace the active session detail with a detail already fetched elsewhere. */
  setActiveSessionDetail: (detail: SessionDetail | null) => void;
  /** Remove a session from local state only. */
  removeLocal: (sessionId: string) => void;
  /** Update a session in local state (e.g., after status change). */
  updateLocal: (sessionId: string, patch: Partial<SessionSummary>) => void;
}

type SessionStore = SessionStoreState & SessionStoreActions;

// ─── Write-Behind Queue ───────────────────────────────────────────────────────

let syncTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DELAY_MS = 2000;

function scheduleSyncToBackend(store: SessionStore) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    syncTimer = null;
    try {
      store.fetchSessions();
    } catch {
      // silent — next mutation will retry
    }
  }, SYNC_DELAY_MS);
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      // State
      sessions: [],
      activeSessionId: null,
      activeSessionDetail: null,
      isLoading: false,
      isSyncing: false,
      lastSyncError: null,

      // Actions
      fetchSessions: async () => {
        set({ isSyncing: true, lastSyncError: null });
        try {
          const remote = await apiListSessions();
          set({ sessions: remote, isSyncing: false });
        } catch (e) {
          set({ isSyncing: false, lastSyncError: String(e) });
        }
      },

      createSession: async (name, metadata) => {
        // Optimistic: add a placeholder immediately
        const tempId = `temp-${Date.now()}`;
        const optimistic: SessionSummary = {
          id: tempId,
          session_name: name,
          status: "active",
          metadata: metadata ?? {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((s) => ({ sessions: [optimistic, ...s.sessions] }));

        try {
          const result = await apiCreateSession(name, metadata);
          const real: SessionSummary = {
            id: result.session_id,
            session_name: result.session_name,
            status: result.status,
            metadata: metadata ?? {},
            created_at: result.created_at,
            updated_at: result.created_at,
          };
          // Replace optimistic with real
          set((s) => ({
            sessions: s.sessions.map((sess) =>
              sess.id === tempId ? real : sess
            ),
            activeSessionId: real.id,
          }));
          return real;
        } catch (e) {
          // Rollback optimistic
          set((s) => ({
            sessions: s.sessions.filter((sess) => sess.id !== tempId),
          }));
          throw e;
        }
      },

      selectSession: (sessionId) => {
        set({ activeSessionId: sessionId, activeSessionDetail: null });
        if (sessionId) {
          get().hydrateSession(sessionId);
        }
      },

      hydrateSession: async (sessionId) => {
        set({ isLoading: true });
        try {
          const detail = await apiGetSession(sessionId);
          set({ activeSessionDetail: detail, isLoading: false });

          // Also update local session list with latest status
          set((s) => ({
            sessions: s.sessions.map((sess) =>
              sess.id === sessionId
                ? {
                    ...sess,
                    status: detail.session.status,
                    updated_at: detail.session.updated_at,
                  }
                : sess
            ),
          }));

          return detail;
        } catch {
          set({ isLoading: false, activeSessionDetail: null });
          return null;
        }
      },

      setActiveSessionDetail: (detail) => {
        set((s) => ({
          activeSessionDetail: detail,
          sessions:
            detail == null
              ? s.sessions
              : s.sessions.map((sess) =>
                  sess.id === detail.session.id
                    ? {
                        ...sess,
                        status: detail.session.status,
                        updated_at: detail.session.updated_at,
                      }
                    : sess
                ),
        }));
      },

      removeLocal: (sessionId) => {
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.id !== sessionId),
          activeSessionId:
            s.activeSessionId === sessionId ? null : s.activeSessionId,
          activeSessionDetail:
            s.activeSessionDetail?.session.id === sessionId
              ? null
              : s.activeSessionDetail,
        }));
      },

      updateLocal: (sessionId, patch) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, ...patch } : sess
          ),
        }));
        scheduleSyncToBackend(get());
      },
    }),
    {
      name: "specflow_session_store",
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);
