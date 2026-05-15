// FIX: source scoping fallback added — May 2026
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
import {
  NO_EVIDENCE_ERROR_MESSAGE,
  NoEvidenceError,
} from "@/lib/pipeline-evidence";

export const LS_ACTIVE_SESSION = "specflow_active_session_id";
export const LS_CONTEXT = "specflow_context";
export const LS_PENDING = "specflow_pending_input";
export const LS_AUTORUN_GLOBAL = "specflow_autorun";
export {
  NO_EVIDENCE_BANNER_MESSAGE,
  NO_EVIDENCE_CODE,
  NO_EVIDENCE_ERROR_MESSAGE,
  NO_EVIDENCE_HTTP_MESSAGE,
  isNoEvidenceError,
} from "@/lib/pipeline-evidence";
export const NO_SOURCE_EVIDENCE_ERROR =
  NO_EVIDENCE_ERROR_MESSAGE;

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
    if (sessionId) {
      const sessionEvidence = await listSourceEvidence("session", sessionId);
      if (sessionEvidence.length > 0) return sessionEvidence;
      return await listSourceEvidence("global");
    }
    return await listSourceEvidence("global");
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

function pipelineItemKey(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const id = stringValue(record.id);
  if (id) return `id:${id}`;
  const sourceId = stringValue(record.source_id);
  const title = stringValue(record.title);
  if (sourceId && title) return `source:${sourceId}:${title}`;
  return null;
}

function dedupePipelineItems<T>(items: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    const key = pipelineItemKey(item);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    deduped.push(item);
  }
  return deduped;
}

/**
 * Default input for standalone pipeline pages: saved context + research + ingest
 * from pending input when set (e.g. after “Run all” from Sessions).
 */
export function buildPipelineInputFromStorage(
  sessionId?: string | null,
  options: { requireEvidence?: boolean } = {}
): Promise<PipelineInput> {
  const build = async (): Promise<PipelineInput> => {
    const requireEvidence = options.requireEvidence ?? true;
    const research = await getResearchPayload(sessionId);
    const sourceEvidence = await getSourceEvidencePayload(sessionId);
    // Map research entries into ingest format so pipeline agents can read them.
    // Agents read ctx["ingest"], not ctx["research"] — without this, research
    // entries never reach the pipeline and it 422s with INCOMPLETE_CONTEXT.
    const researchAsIngest = (research as Array<{
      id?: string;
      type?: string;
      content?: string;
      summary?: string;
      title?: string;
    }>).map((r) => ({
      id: r.id ?? `research-${Math.random().toString(36).slice(2)}`,
      type: r.type ?? "interview",
      content: r.content ?? r.summary ?? "",
      metadata: { source: r.title ?? "research" },
    })).filter((r) => r.content.trim().length > 0);
    const sourceAnalyticsContext = buildSourceAnalyticsContext(sourceEvidence);
    const pendingRaw =
      typeof window !== "undefined"
        ? sessionId
          ? (migratePending(sessionId),
            readScopedRaw(sessionId, pendingSuffix()))
          : localStorage.getItem(LS_PENDING)
        : null;
    let input: PipelineInput | null = null;
    if (pendingRaw) {
      try {
        const p = JSON.parse(pendingRaw) as Partial<PipelineInput>;
        const pendingIngest = Array.isArray(p.ingest) ? p.ingest : [];
        input = {
          context:
            (p.context as Record<string, unknown>) ??
            getContextObject(sessionId),
          research,
          ingest: dedupePipelineItems([
            ...pendingIngest,
            ...researchAsIngest,
            ...sourceEvidence,
          ]),
          ...(sourceAnalyticsContext
            ? { analytics_context: sourceAnalyticsContext }
            : {}),
        };
      } catch {
        /* fall through */
      }
    }
    if (!input) {
      input = {
        context: getContextObject(sessionId),
        research,
        ingest: dedupePipelineItems([...researchAsIngest, ...sourceEvidence]),
        ...(sourceAnalyticsContext
          ? { analytics_context: sourceAnalyticsContext }
          : {}),
      };
    }
    const ingest = Array.isArray(input.ingest) ? input.ingest : [];
    const researchEvidence = Array.isArray(input.research) ? input.research : [];
    const totalEvidence =
      (ingest?.length ?? 0) + (researchEvidence?.length ?? 0);

    if (requireEvidence && totalEvidence === 0) {
      throw new NoEvidenceError();
    }
    return input;
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
