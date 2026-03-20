import { runPipeline, type PipelineInput } from "@/lib/api/pipeline";
import { runSession } from "@/lib/api/session";
import { getActiveSessionId } from "@/lib/pipeline-input";
import type { PipelineStepId } from "@/lib/pipeline-session";

export async function runPipelineStepOrFull(
  step: PipelineStepId,
  inputData: PipelineInput
): Promise<{
  data: Record<string, unknown>;
  mode: "session" | "full";
}> {
  const sessionId = getActiveSessionId();
  if (sessionId) {
    const res = await runSession(
      sessionId,
      inputData as unknown as Record<string, unknown>,
      step
    );
    return {
      data: res.data as Record<string, unknown>,
      mode: "session",
    };
  }
  const res = await runPipeline(inputData);
  return { data: res.data, mode: "full" };
}
