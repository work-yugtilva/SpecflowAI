// Building PipelineInput from localStorage (context, research, optional pending ingest)

import type { PipelineInput } from "@/lib/api/pipeline";
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
export const LS_RESEARCH = "specflow_research_entries";
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
  const readKey = (key: string) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") as Record<
        string,
        unknown
      >;
    } catch {
      return {};
    }
  };
  if (sessionId) {
    migrateGlobalToScopedOnce(sessionId, "context", LS_CONTEXT);
    return readKey(scopedStorageKey(sessionId, "context"));
  }
  try {
    return JSON.parse(localStorage.getItem(LS_CONTEXT) || "{}") as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

/** Research entries saved from the Research page — passed through to the API as `research`. */
export function getResearchPayload(sessionId?: string | null): unknown[] {
  if (typeof window === "undefined") return [];
  const parseArr = (raw: string | null) => {
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw) as unknown;
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };
  if (sessionId) {
    migrateGlobalToScopedOnce(sessionId, "research", LS_RESEARCH);
    return parseArr(readScopedRaw(sessionId, "research"));
  }
  return parseArr(localStorage.getItem(LS_RESEARCH));
}

/**
 * Default input for standalone pipeline pages: saved context + research + ingest
 * from pending input when set (e.g. after “Run all” from Sessions).
 */
export function buildPipelineInputFromStorage(
  sessionId?: string | null
): PipelineInput {
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
        research:
          Array.isArray(p.research) && p.research.length > 0
            ? p.research
            : getResearchPayload(sessionId),
        ingest: Array.isArray(p.ingest) ? p.ingest : [],
      };
    } catch {
      /* fall through */
    }
  }
  return {
    context: getContextObject(sessionId),
    research: getResearchPayload(sessionId),
    ingest: [],
  };
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
