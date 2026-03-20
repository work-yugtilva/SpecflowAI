// Building PipelineInput from localStorage (context, research, optional pending ingest)

import type { PipelineInput } from "@/lib/api/pipeline";

export const LS_ACTIVE_SESSION = "specflow_active_session_id";
export const LS_CONTEXT = "specflow_context";
export const LS_RESEARCH = "specflow_research_entries";
export const LS_PENDING = "specflow_pending_input";

export function getContextObject(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
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
export function getResearchPayload(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_RESEARCH);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Default input for standalone pipeline pages: saved context + research + ingest
 * from `specflow_pending_input` when set (e.g. after “Run all” from Sessions).
 */
export function buildPipelineInputFromStorage(): PipelineInput {
  const pendingRaw =
    typeof window !== "undefined"
      ? localStorage.getItem(LS_PENDING)
      : null;
  if (pendingRaw) {
    try {
      const p = JSON.parse(pendingRaw) as Partial<PipelineInput>;
      return {
        context:
          (p.context as Record<string, unknown>) ?? getContextObject(),
        research:
          Array.isArray(p.research) && p.research.length > 0
            ? p.research
            : getResearchPayload(),
        ingest: Array.isArray(p.ingest) ? p.ingest : [],
      };
    } catch {
      /* fall through */
    }
  }
  return {
    context: getContextObject(),
    research: getResearchPayload(),
    ingest: [],
  };
}

export function setActiveSessionId(sessionId: string | null): void {
  if (typeof window === "undefined") return;
  if (!sessionId) {
    localStorage.removeItem(LS_ACTIVE_SESSION);
    return;
  }
  localStorage.setItem(LS_ACTIVE_SESSION, sessionId);
}

export function getActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_ACTIVE_SESSION);
}

export function hasContextSaved(): boolean {
  const c = getContextObject();
  return Object.keys(c).length > 0;
}
