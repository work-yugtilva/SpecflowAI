import type { PipelineInput } from "@/lib/pipeline-types";
import { runSession } from "@/lib/api/session";
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
  } | null;
  /** When mode is "orphaned", the pipeline output is stored here for later attachment. */
  orphanedOutput?: PipelineOutputs;
}

const PIPELINE_URL =
  process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8001";

export async function runPipelineStepOrFull(
  step: PipelineStepId,
  inputData: PipelineInput,
  /** When set, overrides localStorage active session. */
  explicitSessionId?: string | null
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

  const res = await runSession(
    sessionId,
    inputData as unknown as Record<string, unknown>,
    step
  );
  return {
    data: res.data,
    mode: "session",
    sessionState: res.session_state ?? null,
  };
}
