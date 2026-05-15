// lib/api/session.ts — Client for the session system API routes (proxied via Next.js)

import type { PipelineOutputs } from "@/lib/pipeline-contracts";
import { iterateSseJsonLines } from "@/lib/sse-parse";
import { NO_EVIDENCE_CODE } from "@/lib/pipeline-evidence";

const API_BASE = "/api/sessions";

/** Same-origin session routes need cookies (Supabase SSR); avoid cached API responses. */
const SESSION_FETCH_DEFAULTS: RequestInit = {
  credentials: "same-origin",
  cache: "no-store",
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let text = res.statusText;
    let code: string | undefined;
    try {
      const body = await res.json();
      // FastAPI uses `detail` for HTTPException; custom errors use `error`
      code = typeof body.code === "string" ? body.code : undefined;
      text = body.error ?? body.detail ?? body.message ?? text;
    } catch {}
    const error = new Error(code === NO_EVIDENCE_CODE ? `${code}: ${text}` : text) as Error & {
      code?: string;
      status?: number;
    };
    error.code = code;
    error.status = res.status;
    throw error;
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionCreated {
  session_id: string;
  session_name: string;
  status: string;
  created_at: string | null;
}

export interface SessionRunResponse {
  success: boolean;
  data: PipelineOutputs;
  session_state: {
    last_completed_step?: string;
    outputs?: Partial<PipelineOutputs>;
    regeneration_counts?: Partial<Record<string, number>>;
  } | null;
}

export interface SessionEvent {
  id: string;
  session_id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface SessionStateSnapshot {
  id?: string;
  session_id: string;
  state: {
    last_completed_step?: string;
    outputs?: Partial<PipelineOutputs>;
    regeneration_counts?: Partial<Record<string, number>>;
  };
  step: string | null;
}

export interface SessionDetail {
  session: {
    id: string;
    session_name: string;
    status: string;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  state: SessionStateSnapshot | null;
  events: SessionEvent[];
}

export interface SessionSummary {
  id: string;
  session_name: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export interface PipelineRunSummary {
  id: string;
  session_id: string | null;
  status: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  current_step: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ─── Session Mode (always "remote" — local fallback removed) ──────────────────

/** Always returns "remote". Local fallback has been removed. */
export function getLastSessionMode(): "remote" | "local" {
  return "remote";
}

// ─── Session API Functions ────────────────────────────────────────────────────

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${API_BASE}`, SESSION_FETCH_DEFAULTS);
  const body = await handleResponse<{ sessions: SessionSummary[] }>(res);
  return body.sessions;
}

export async function createSession(
  sessionName: string,
  metadata?: Record<string, unknown>
): Promise<SessionCreated> {
  const res = await fetch(`${API_BASE}`, {
    ...SESSION_FETCH_DEFAULTS,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_name: sessionName, metadata: metadata ?? {} }),
  });
  return handleResponse<SessionCreated>(res);
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  const res = await fetch(`${API_BASE}/${sessionId}`, SESSION_FETCH_DEFAULTS);
  return handleResponse<SessionDetail>(res);
}

export async function runSession(
  sessionId: string,
  inputData: Record<string, unknown>,
  step?: string
): Promise<SessionRunResponse> {
  const body: Record<string, unknown> = { input_data: inputData };
  if (step) body.step = step;
  const res = await fetch(`${API_BASE}/${sessionId}/run`, {
    ...SESSION_FETCH_DEFAULTS,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<SessionRunResponse>(res);
}

// ─── Async pipeline run + SSE stream ─────────────────────────────────────────

export interface AsyncRunStarted {
  job_id: string;
  status: string;
}

export type RunStreamEvent =
  | { type: "connected" }
  | { type: "heartbeat" }
  | { type: "phase"; phase: string; progress?: number }
  | { type: "step_complete"; step: string }
  | { type: "complete"; data: PipelineOutputs; session_state: SessionRunResponse["session_state"] }
  | { type: "error"; message: string; status_code?: number };

/** Start a background pipeline run. Returns the job_id immediately (202). */
export async function startSessionRunAsync(
  sessionId: string,
  inputData: Record<string, unknown>,
  step?: string
): Promise<AsyncRunStarted> {
  const body: Record<string, unknown> = { input_data: inputData };
  if (step) body.step = step;
  const res = await fetch(`${API_BASE}/${sessionId}/run/async`, {
    ...SESSION_FETCH_DEFAULTS,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<AsyncRunStarted>(res);
}

function mapStreamConnectFailure(err: unknown): Error {
  const m = err instanceof Error ? err.message : String(err);
  if (
    /failed to fetch|load failed|networkerror|network request failed|aborted|econnreset|socket/i.test(
      m
    )
  ) {
    return new Error(
      "Network error — the connection to the server dropped. Ensure Next.js and the pipeline (port 8001) are running, then retry."
    );
  }
  return err instanceof Error ? err : new Error(m);
}

/** Subscribe to SSE events for a background pipeline job. Async generator. */
export async function* subscribeToRunStream(
  sessionId: string,
  jobId: string
): AsyncGenerator<RunStreamEvent> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${sessionId}/run/stream/${jobId}`, {
      ...SESSION_FETCH_DEFAULTS,
      method: "GET",
      headers: {
        Accept: "text/event-stream",
      },
    });
  } catch (e) {
    throw mapStreamConnectFailure(e);
  }

  if (!res.ok) {
    let detail = `Stream connect failed (${res.status})`;
    try {
      const text = await res.text();
      if (text) {
        try {
          const j = JSON.parse(text) as { error?: string; detail?: string };
          detail = j.error ?? j.detail ?? text.slice(0, 280);
        } catch {
          detail = text.slice(0, 280);
        }
      }
    } catch {
      /* keep detail */
    }
    throw new Error(detail);
  }

  if (!res.body) {
    throw new Error("Stream connect failed: empty response body");
  }

  try {
    for await (const event of iterateSseJsonLines<RunStreamEvent>(res.body)) {
      yield event;
    }
  } catch (e) {
    throw mapStreamConnectFailure(e);
  }
}

// Note: listOrphanedPipelines, attachPipelineToSession, listSessionPipelines are
// intentionally omitted — pipeline management UI is out of scope. No
// ─── Agent Handoff Types ──────────────────────────────────────────────────────

export interface HandoffTask {
  id: string;
  title: string;
  layer: string;
  implementation_prompt: string;
  acceptance_criteria: string;
  dependencies: string[];
  needs_clarification: boolean;
  clarification_reason: string;
}

export interface AgentHandoff {
  project_brief: string;
  execution_order: string[];
  tasks: HandoffTask[];
  needs_clarification_count: number;
  /** Present when the model returned a numeric estimate; otherwise null. */
  estimated_sessions: number | null;
  architecture_notes: string;
}

export interface HandoffResponse {
  success: boolean;
  handoff: AgentHandoff;
}

/**
 * Normalize `tasks` from API / LLM output: plain arrays, `{ data: [...] }`, or `{ items: [...] }`
 * (matches backend export logic in main.py).
 */
export function normalizeHandoffTasks(raw: unknown): HandoffTask[] {
  let t: unknown = raw;
  for (let i = 0; i < 3; i++) {
    if (
      t &&
      typeof t === "object" &&
      !Array.isArray(t) &&
      Object.keys(t as object).length === 1 &&
      "data" in (t as object)
    ) {
      t = (t as { data: unknown }).data;
    } else {
      break;
    }
  }
  if (Array.isArray(t)) return t as HandoffTask[];
  if (t && typeof t === "object" && !Array.isArray(t)) {
    const o = t as Record<string, unknown>;
    const nested = o.items ?? o.tasks;
    if (Array.isArray(nested)) return nested as HandoffTask[];
  }
  return [];
}

/** Build a consistent AgentHandoff object from arbitrary API / persisted JSON. */
export function coerceAgentHandoff(raw: unknown): AgentHandoff | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tasks = normalizeHandoffTasks(o.tasks);
  const est = o.estimated_sessions;
  let estimated_sessions: number | null = null;
  if (typeof est === "number" && !Number.isNaN(est)) {
    estimated_sessions = est;
  } else if (est != null && est !== "") {
    const n = Number(est);
    if (!Number.isNaN(n)) estimated_sessions = n;
  }
  const ncc = o.needs_clarification_count;
  const needs_clarification_count =
    typeof ncc === "number" && !Number.isNaN(ncc)
      ? ncc
      : ncc != null && ncc !== ""
        ? Number(ncc) || 0
        : 0;

  return {
    project_brief: typeof o.project_brief === "string" ? o.project_brief : "",
    execution_order: Array.isArray(o.execution_order)
      ? (o.execution_order as string[])
      : [],
    tasks,
    needs_clarification_count,
    estimated_sessions,
    architecture_notes:
      typeof o.architecture_notes === "string" ? o.architecture_notes : "",
  };
}

function parseHandoffApiBody(body: unknown): HandoffResponse {
  const b = body as Record<string, unknown>;
  const handoff = coerceAgentHandoff(b.handoff);
  if (!handoff) {
    throw new Error("Invalid handoff payload");
  }
  return {
    success: typeof b.success === "boolean" ? b.success : true,
    handoff,
  };
}

// ─── Agent Handoff ────────────────────────────────────────────────────────────

export async function generateHandoff(sessionId: string): Promise<HandoffResponse> {
  const res = await fetch(`${API_BASE}/${sessionId}/handoff`, {
    ...SESSION_FETCH_DEFAULTS,
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await handleResponse<Record<string, unknown>>(res);
  return parseHandoffApiBody(body);
}

export async function getHandoff(sessionId: string): Promise<HandoffResponse> {
  const res = await fetch(`${API_BASE}/${sessionId}/handoff`, SESSION_FETCH_DEFAULTS);
  const body = await handleResponse<Record<string, unknown>>(res);
  return parseHandoffApiBody(body);
}

export async function exportHandoff(
  sessionId: string,
  format: "claude_md" | "cursor_rules" | "task_list"
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/${sessionId}/handoff/export?format=${format}`,
    SESSION_FETCH_DEFAULTS
  );
  if (!res.ok) throw new Error("Export failed");
  const text = await res.text();

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const nameMatch = disposition.match(/filename="([^"]+)"/);
  const filename =
    nameMatch?.[1] ??
    (format === "claude_md"
      ? "CLAUDE.md"
      : format === "cursor_rules"
      ? ".cursorrules"
      : `tasks-${sessionId.slice(0, 8)}.txt`);

  const mimeType = format === "task_list" ? "text/plain" : "text/markdown";
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Next.js proxy routes exist for /api/pipelines/* in this plan.
