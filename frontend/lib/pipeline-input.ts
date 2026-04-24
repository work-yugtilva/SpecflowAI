// Building PipelineInput from local context storage + server-backed research + optional pending ingest

import type { PipelineInput } from "@/lib/pipeline-types";
import { fetchResearchEntries } from "@/lib/api/research";
import {
  listSourceEvidence,
  type PipelineSourceEvidence,
} from "@/lib/api/sources";
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

export async function getSourceEvidencePayload(
  sessionId?: string | null
): Promise<PipelineSourceEvidence[]> {
  if (typeof window === "undefined") return [];
  try {
    return await listSourceEvidence(
      sessionId ? "session" : "global",
      sessionId ?? undefined
    );
  } catch {
    return [];
  }
}

function buildSourceAnalyticsContext(
  evidence: PipelineSourceEvidence[]
): string | undefined {
  const lines: string[] = [];
  for (const item of evidence) {
    if (item.type !== "metric" && item.type !== "observation") continue;
    const metadata = item.metadata ?? {};
    const metricName =
      stringValue(metadata.metric_name) ||
      stringValue(metadata.metricName) ||
      item.title;
    lines.push(`SOURCE: ${item.source_title}`);
    lines.push(`METRIC: ${metricName}`);
    const metricValue =
      metadata.metric_value ?? metadata.metricValue ?? metadata.average;
    if (metricValue !== undefined && metricValue !== null) {
      lines.push(`  Current: ${String(metricValue)}`);
    }
    if (item.content) {
      lines.push(`  Observation: ${item.content}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() || undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
    const sourceEvidence = await getSourceEvidencePayload(sessionId);
    const sourceAnalyticsContext = buildSourceAnalyticsContext(sourceEvidence);
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
        const pendingIngest = Array.isArray(p.ingest) ? p.ingest : [];
        return {
          context:
            (p.context as Record<string, unknown>) ??
            getContextObject(sessionId),
          research,
          ingest: [...pendingIngest, ...sourceEvidence],
          ...(sourceAnalyticsContext
            ? { analytics_context: sourceAnalyticsContext }
            : {}),
        };
      } catch {
        /* fall through */
      }
    }
    return {
      context: getContextObject(sessionId),
      research,
      ingest: sourceEvidence,
      ...(sourceAnalyticsContext
        ? { analytics_context: sourceAnalyticsContext }
        : {}),
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
