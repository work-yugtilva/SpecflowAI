import type { PipelineInput } from "@/lib/pipeline-types";
import { startSessionRunAsync, subscribeToRunStream } from "@/lib/api/session";
import type { RunStreamEvent } from "@/lib/api/session";
import { getActiveSessionId } from "@/lib/pipeline-input";
import type { PipelineStepId } from "@/lib/pipeline-session";
import type { PipelineOutputs } from "@/lib/pipeline-contracts";

/** Shown when Generate is clicked without an active session, and in empty-state hints. */
export const PIPELINE_REQUIRES_SESSION_MESSAGE =
  "This run is unsaved. Create a session to persist this pipeline?";

export class NoActiveSessionError extends Error {
  override readonly name = "NoActiveSessionError";
  constructor(message: string = PIPELINE_REQUIRES_SESSION_MESSAGE) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type PipelineRunMode = "session" | "orphaned";

export interface PipelineRunResult {
  data: PipelineOutputs;
  mode: PipelineRunMode;
  sessionState: {
    last_completed_step?: string;
    outputs?: Partial<PipelineOutputs>;
    regeneration_counts?: Partial<Record<string, number>>;
  } | null;
  /** When mode is "orphaned", the pipeline output is stored here for later attachment. */
  orphanedOutput?: PipelineOutputs;
}

const PIPELINE_URL =
  process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";

/** Lost in-memory job / reload / proxy drop — safe to start a fresh async job once. */
function isRetryableStreamFailure(message: string): boolean {
  const m = message.toLowerCase();
  if (
    m.includes("incomplete_context") ||
    m.includes("regeneration limit") ||
    m.includes("already completed") ||
    m.includes("internal server error")
  ) {
    return false;
  }
  return (
    m.includes("job not found") ||
    (m.includes("stream connect failed") && m.includes("404")) ||
    m.includes("interrupted") ||
    m.includes("server closed the connection") ||
    m.includes("job expired") ||
    m.includes("network error —") ||
    m.includes("ensure next.js and the pipeline")
  );
}

export async function runPipelineStepOrFull(
  step: PipelineStepId,
  inputData: PipelineInput,
  /** When set, overrides localStorage active session. */
  explicitSessionId?: string | null,
  /** Optional callback fired for each SSE event (phase, step_complete, etc.). */
  onProgress?: (event: RunStreamEvent) => void
): Promise<PipelineRunResult> {
  const sessionId =
    explicitSessionId !== undefined ? explicitSessionId : getActiveSessionId();

  // If no session — run as orphaned (legacy /run endpoint, no session tracking)
  if (!sessionId?.trim()) {
    const res = await fetch(`${PIPELINE_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input_data: inputData as unknown as Record<string, unknown>,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Pipeline API ${res.status}: ${text}`);
    }
    const body = (await res.json()) as { success: boolean; data: PipelineOutputs };
    return {
      data: body.data,
      mode: "orphaned",
      sessionState: null,
      orphanedOutput: body.data,
    };
  }

  // Session mode: start background job and subscribe to SSE stream.
  // This prevents 504 timeouts on long pipeline runs because the connection
  // receives heartbeat events before any proxy timeout window elapses.
  //
  // If the pipeline process restarted (jobs are in-memory) or the SSE proxy
  // dropped once, retry once with a new job so the user does not have to click Retry.
  const inputRecord = inputData as unknown as Record<string, unknown>;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 450));
    }

    const { job_id } = await startSessionRunAsync(sessionId, inputRecord, step);

    try {
      for await (const event of subscribeToRunStream(sessionId, job_id)) {
        onProgress?.(event);
        if (event.type === "complete") {
          return {
            data: event.data,
            mode: "session",
            sessionState: event.session_state ?? null,
          };
        }
        if (event.type === "error") {
          throw new Error(event.message ?? "Pipeline run failed");
        }
      }
      throw new Error("Stream ended without a completion event");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === 0 && isRetryableStreamFailure(msg)) {
        continue;
      }
      throw e instanceof Error ? e : new Error(msg);
    }
  }

  throw new Error("Pipeline run failed after retry");
}
