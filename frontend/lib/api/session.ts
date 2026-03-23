// lib/api/session.ts — Client for the session system API routes

import {
  createLocalSession,
  getLocalSession,
  runLocalSession,
} from "@/lib/local-session-pipeline";

const PIPELINE_URL =
  process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8001";
const FALLBACK_PIPELINE_URLS = [
  PIPELINE_URL,
  "http://localhost:8001",
  "http://localhost:8000",
].filter((url, index, arr) => arr.indexOf(url) === index);

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Session API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function fetchWithFallback(
  path: string,
  init: RequestInit,
  retryable: boolean
): Promise<Response> {
  let lastError: unknown = null;

  for (const baseUrl of FALLBACK_PIPELINE_URLS) {
    try {
      const res = await fetch(`${baseUrl}${path}`, init);
      return res;
    } catch (error) {
      lastError = error;
      if (!retryable) break;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to reach the pipeline service.");
}

// ─── Session mode tracking ─────────────────────────────────────────────────
type SessionMode = "remote" | "local";
let _sessionMode: SessionMode = "local";

/** Returns whether the last session API call used the remote backend or local fallback. */
export function getLastSessionMode(): SessionMode {
  return _sessionMode;
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
  data: Record<string, unknown>;
  session_state: Record<string, unknown> | null;
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
    outputs?: Record<string, unknown>;
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

// ─── API Functions ─────────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  session_name: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${PIPELINE_URL}/sessions`);
  const body = await handleResponse<{ sessions: SessionSummary[] }>(res);
  return body.sessions;
}

export async function createSession(
  sessionName: string,
  metadata?: Record<string, unknown>
): Promise<SessionCreated> {
  try {
    const res = await fetchWithFallback("/session/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_name: sessionName,
        metadata: metadata ?? {},
      }),
    }, true);
    const result = await handleResponse<SessionCreated>(res);
    _sessionMode = "remote";
    return result;
  } catch {
    _sessionMode = "local";
    return createLocalSession(sessionName, metadata);
  }
}

export async function runSession(
  sessionId: string,
  inputData: Record<string, unknown>,
  step?: string
): Promise<SessionRunResponse> {
  const body: Record<string, unknown> = { input_data: inputData };
  if (step) body.step = step;

  try {
    const res = await fetchWithFallback(`/session/${sessionId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, true);
    const result = await handleResponse<SessionRunResponse>(res);
    _sessionMode = "remote";
    return result;
  } catch {
    _sessionMode = "local";
    return runLocalSession(sessionId, inputData, step);
  }
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  try {
    const res = await fetchWithFallback(`/session/${sessionId}`, {}, true);
    const result = await handleResponse<SessionDetail>(res);
    _sessionMode = "remote";
    return result;
  } catch {
    _sessionMode = "local";
    return getLocalSession(sessionId);
  }
}

// ─── Pipeline Run API ─────────────────────────────────────────────────────────

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

export async function listOrphanedPipelines(): Promise<PipelineRunSummary[]> {
  const res = await fetch(`${PIPELINE_URL}/pipelines/orphaned`);
  const body = await handleResponse<{ pipelines: PipelineRunSummary[] }>(res);
  return body.pipelines;
}

export async function attachPipelineToSession(
  pipelineId: string,
  sessionId: string
): Promise<void> {
  const res = await fetch(`${PIPELINE_URL}/pipelines/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pipeline_id: pipelineId, session_id: sessionId }),
  });
  await handleResponse<{ success: boolean }>(res);
}

export async function listSessionPipelines(
  sessionId: string
): Promise<PipelineRunSummary[]> {
  const res = await fetch(`${PIPELINE_URL}/pipelines/${sessionId}`);
  const body = await handleResponse<{ pipelines: PipelineRunSummary[] }>(res);
  return body.pipelines;
}
