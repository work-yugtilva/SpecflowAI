// lib/api/pipeline.ts — Client for the Python FastAPI pipeline server

const PIPELINE_URL =
  process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";

export interface PipelineInput {
  context: Record<string, unknown>;
  research: unknown[];
  ingest: unknown[];
}

export interface PipelineResponse {
  success: boolean;
  data: Record<string, unknown>;
}

export async function runPipeline(
  inputData: PipelineInput,
  projectId?: string
): Promise<PipelineResponse> {
  const res = await fetch(`${PIPELINE_URL}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input_data: inputData,
      project_id: projectId ?? null,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Pipeline error ${res.status}: ${text}`);
  }

  return res.json();
}
