// lib/api/session.ts — Client for the session system API routes (proxied via Next.js)

import type { PipelineOutputs } from "@/lib/pipeline-contracts";

const API_BASE = "/api/sessions";

/** Same-origin session routes need cookies (Supabase SSR); avoid cached API responses. */
const SESSION_FETCH_DEFAULTS: RequestInit = {
  credentials: "same-origin",
  cache: "no-store",
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let text = res.statusText;
    try {
      const body = await res.json();
      // FastAPI uses `detail` for HTTPException; custom errors use `error`
      text = body.error ?? body.detail ?? text;
    } catch {}
    throw new Error(text);
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

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (e) {
        throw mapStreamConnectFailure(e);
      }
      const { done, value } = chunk;
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6)) as RunStreamEvent;
          } catch {
            // skip malformed SSE line
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Note: listOrphanedPipelines, attachPipelineToSession, listSessionPipelines are
// intentionally omitted — pipeline management UI is out of scope. No
// Next.js proxy routes exist for /api/pipelines/* in this plan.
