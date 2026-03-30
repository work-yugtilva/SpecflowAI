// lib/api/session.ts — Client for the session system API routes (proxied via Next.js)

import type { PipelineOutputs } from "@/lib/pipeline-contracts";

const API_BASE = "/api/sessions";

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
  const res = await fetch(`${API_BASE}`);
  const body = await handleResponse<{ sessions: SessionSummary[] }>(res);
  return body.sessions;
}

export async function createSession(
  sessionName: string,
  metadata?: Record<string, unknown>
): Promise<SessionCreated> {
  const res = await fetch(`${API_BASE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_name: sessionName, metadata: metadata ?? {} }),
  });
  return handleResponse<SessionCreated>(res);
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  const res = await fetch(`${API_BASE}/${sessionId}`);
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<SessionRunResponse>(res);
}

// Note: listOrphanedPipelines, attachPipelineToSession, listSessionPipelines are
// intentionally omitted — pipeline management UI is out of scope. No
// Next.js proxy routes exist for /api/pipelines/* in this plan.
