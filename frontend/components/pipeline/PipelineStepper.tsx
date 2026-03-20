"use client";

import Link from "next/link";
import {
  PIPELINE_STEPS,
  type PipelineStepId,
  type StepStatus,
} from "@/lib/pipeline-session";

const STEP_STYLE: Record<
  StepStatus,
  { bg: string; border: string; text: string }
> = {
  pending: { bg: "#F8F4EF", border: "#E4DDD4", text: "#9B9189" },
  completed: { bg: "#F0FDF4", border: "#86EFAC", text: "#15803D" },
  failed: { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
  running: { bg: "rgba(232,86,27,0.08)", border: "#E8561B", text: "#E8561B" },
};

interface PipelineStepperProps {
  currentStepId: PipelineStepId;
  stepStatuses?: Record<PipelineStepId, StepStatus> | null;
  sessionIdShort?: string | null;
}

export function PipelineStepper({
  currentStepId,
  stepStatuses,
  sessionIdShort,
}: PipelineStepperProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px 14px",
        background: "#FFFFFF",
        borderBottom: "1px solid #E4DDD4",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#9B9189",
          marginRight: 4,
        }}
      >
        Pipeline
      </span>
      {sessionIdShort && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 20,
            background: "rgba(232,86,27,0.10)",
            color: "#E8561B",
            letterSpacing: "0.03em",
            marginRight: 8,
          }}
          title="Runs use this session (step-by-step). Clear session in Sessions to run the full pipeline instead."
        >
          Session {sessionIdShort}
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {PIPELINE_STEPS.map((step, i) => {
          const isCurrent = step.id === currentStepId;
          const st =
            stepStatuses?.[step.id] ??
            (isCurrent ? ("pending" as const) : ("pending" as const));
          const c = STEP_STYLE[st === "running" ? "running" : st];
          return (
            <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && (
                <span style={{ color: "#C8C0B8", fontSize: 12, margin: "0 2px" }}>
                  →
                </span>
              )}
              <Link
                href={`/${step.id}`}
                style={{
                  fontSize: 12,
                  fontWeight: isCurrent ? 600 : 500,
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: `1px solid ${c.border}`,
                  background: isCurrent ? "rgba(232,86,27,0.08)" : c.bg,
                  color: isCurrent ? "#0D0D0D" : c.text,
                  textDecoration: "none",
                  transition: "background 0.15s ease",
                }}
              >
                {step.label}
              </Link>
            </div>
          );
        })}
      </div>
      {!sessionIdShort && (
        <span style={{ fontSize: 11, color: "#9B9189", marginLeft: "auto" }}>
          No active session — generate runs the{" "}
          <strong style={{ color: "#6B6B6B" }}>full pipeline</strong> (all steps)
        </span>
      )}
    </div>
  );
}
