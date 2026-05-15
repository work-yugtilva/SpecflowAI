// Shared pipeline step metadata + session status helpers (used by Sessions + step pages)

import type { SessionDetail } from "@/lib/api/session";

export const PIPELINE_STEPS = [
  { id: "problems", label: "Problems", description: "Surface pain points" },
  { id: "features", label: "Features", description: "Define capabilities" },
  { id: "decompose", label: "Decompose", description: "Break into components" },
  { id: "ui_spec", label: "UI Specs", description: "Screen/data/workflow changes" },
  { id: "tasks", label: "Tasks", description: "Generate action items" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

export type StepStatus = "pending" | "completed" | "failed" | "running";

export function computeStepStatuses(
  detail: SessionDetail | null
): Record<PipelineStepId, StepStatus> {
  const result = {} as Record<PipelineStepId, StepStatus>;
  PIPELINE_STEPS.forEach((s) => {
    result[s.id] = "pending";
  });
  if (!detail) return result;

  const { session, state } = detail;
  const lastCompleted = state?.state?.last_completed_step ?? null;

  if (session.status === "completed") {
    PIPELINE_STEPS.forEach((s) => {
      result[s.id] = "completed";
    });
    return result;
  }

  if (lastCompleted) {
    for (const step of PIPELINE_STEPS) {
      result[step.id] = "completed";
      if (step.id === lastCompleted) break;
    }
  }

  if (session.status === "failed") {
    const lastIdx = lastCompleted
      ? PIPELINE_STEPS.findIndex((s) => s.id === lastCompleted)
      : -1;
    const failedIdx = lastIdx + 1;
    if (failedIdx >= 0 && failedIdx < PIPELINE_STEPS.length) {
      result[PIPELINE_STEPS[failedIdx].id] = "failed";
    }
  }

  return result;
}

export function getNextStep(
  statuses: Record<PipelineStepId, StepStatus>
): PipelineStepId | null {
  for (const step of PIPELINE_STEPS) {
    if (statuses[step.id] === "pending") return step.id;
  }
  return null;
}
