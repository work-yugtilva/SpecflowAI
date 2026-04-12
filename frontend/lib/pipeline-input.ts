// Building PipelineInput from local context storage + server-backed research + optional pending ingest

import type { PipelineInput } from "@/lib/pipeline-types";
import { fetchResearchEntries } from "@/lib/api/research";
import {
  migrateGlobalToScopedOnce,
  readScopedRaw,
  removeScopedRaw,
  scopedStorageKey,
  writeScopedRaw,
  type SessionScopedSuffix,
} from "@/lib/session-scoped-storage";

export const LS_ACTIVE_SESSION = "specflow_active_session_id";
export const LS_CONTEXT = "specflow_context";
export const LS_PENDING = "specflow_pending_input";
export const LS_AUTORUN_GLOBAL = "specflow_autorun";

/** Dispatched on same tab after active session id changes (localStorage updated). */
export const ACTIVE_SESSION_CHANGE_EVENT = "specflow:active-session";

function dispatchActiveSessionChange(sessionId: string | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ACTIVE_SESSION_CHANGE_EVENT, {
      detail: { sessionId },
    })
  );
}

function pendingSuffix(): SessionScopedSuffix {
  return "pending_input";
}

function migratePending(sessionId: string): void {
  migrateGlobalToScopedOnce(sessionId, pendingSuffix(), LS_PENDING);
}

export function getContextObject(
  sessionId?: string | null
): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const readKey = (key: string): Record<string, unknown> => {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") as Record<
        string,
        unknown
      >;
    } catch {
      return {};
    }
  };
  const globalContext = readKey(LS_CONTEXT);
  if (sessionId) {
    const sessionContext = readKey(scopedStorageKey(sessionId, "context"));
    return { ...globalContext, ...sessionContext };
  }
  return globalContext;
}

/** Server-backed research payload for pipeline execution. */
export async function getResearchPayload(
  sessionId?: string | null
): Promise<unknown[]> {
  if (typeof window === "undefined") return [];
  try {
    return await fetchResearchEntries(
      sessionId ? "session" : "global",
      sessionId ?? undefined
    );
  } catch {
    return [];
  }
}

/**
 * Default input for standalone pipeline pages: saved context + research + ingest
 * from pending input when set (e.g. after “Run all” from Sessions).
 */
export function buildPipelineInputFromStorage(
  sessionId?: string | null
): Promise<PipelineInput> {
  const build = async (): Promise<PipelineInput> => {
    const research = await getResearchPayload(sessionId);
    const pendingRaw =
      typeof window !== "undefined"
        ? sessionId
          ? (migratePending(sessionId),
            readScopedRaw(sessionId, pendingSuffix()))
          : localStorage.getItem(LS_PENDING)
        : null;
    if (pendingRaw) {
      try {
        const p = JSON.parse(pendingRaw) as Partial<PipelineInput>;
        return {
          context:
            (p.context as Record<string, unknown>) ??
            getContextObject(sessionId),
          research,
          ingest: Array.isArray(p.ingest) ? p.ingest : [],
        };
      } catch {
        /* fall through */
      }
    }
    return {
      context: getContextObject(sessionId),
      research,
      ingest: [],
    };
  };
  return build();
}

export function setActiveSessionId(sessionId: string | null): void {
  if (typeof window === "undefined") return;
  if (!sessionId) {
    localStorage.removeItem(LS_ACTIVE_SESSION);
  } else {
    localStorage.setItem(LS_ACTIVE_SESSION, sessionId);
  }
  dispatchActiveSessionChange(sessionId);
}

export function getActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_ACTIVE_SESSION);
}

export function hasContextSaved(sessionId?: string | null): boolean {
  const c = getContextObject(sessionId);
  return Object.keys(c).length > 0;
}

/** Whether autorun flag is set for the given session (or global legacy when session is null). */
export function isAutorunPending(sessionId?: string | null): boolean {
  if (typeof window === "undefined") return false;
  if (sessionId) {
    migrateGlobalToScopedOnce(sessionId, "autorun", LS_AUTORUN_GLOBAL);
    return readScopedRaw(sessionId, "autorun") === "1";
  }
  return localStorage.getItem(LS_AUTORUN_GLOBAL) === "1";
}

export function clearAutorunFlag(sessionId?: string | null): void {
  if (typeof window === "undefined") return;
  if (sessionId) {
    removeScopedRaw(sessionId, "autorun");
  }
  localStorage.removeItem(LS_AUTORUN_GLOBAL);
}

export function setAutorunFlag(sessionId: string): void {
  if (typeof window === "undefined") return;
  writeScopedRaw(sessionId, "autorun", "1");
  localStorage.removeItem(LS_AUTORUN_GLOBAL);
}
