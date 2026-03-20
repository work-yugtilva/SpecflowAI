import type { PipelineInput } from "@/lib/api/pipeline";
import { runSession } from "@/lib/api/session";
import { getActiveSessionId } from "@/lib/pipeline-input";
import type { PipelineStepId } from "@/lib/pipeline-session";

/** Shown when Generate is clicked without an active session, and in empty-state hints. */
export const PIPELINE_REQUIRES_SESSION_MESSAGE =
  "Select a session on the Sessions page. Runs use that session’s context, research, and ingest (including pending input from a session run).";

export class NoActiveSessionError extends Error {
  override readonly name = "NoActiveSessionError";
  constructor(message: string = PIPELINE_REQUIRES_SESSION_MESSAGE) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function runPipelineStepOrFull(
  step: PipelineStepId,
  inputData: PipelineInput,
  /** When set, overrides localStorage active session. Must be a non-empty session id to run. */
  explicitSessionId?: string | null
): Promise<{
  data: Record<string, unknown>;
  mode: "session";
  /** Persisted snapshot `{ last_completed_step, outputs }` — use `outputs.problems` if `data.problems` is missing. */
  sessionState: Record<string, unknown> | null;
}> {
  const sessionId =
    explicitSessionId !== undefined ? explicitSessionId : getActiveSessionId();
  if (!sessionId?.trim()) {
    throw new NoActiveSessionError();
  }
  const res = await runSession(
    sessionId,
    inputData as unknown as Record<string, unknown>,
    step
  );
  return {
    data: res.data as Record<string, unknown>,
    mode: "session",
    sessionState: (res.session_state ?? null) as Record<string, unknown> | null,
  };
}
