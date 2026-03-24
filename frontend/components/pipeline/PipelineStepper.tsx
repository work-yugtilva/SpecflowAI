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

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "completed")
    return <span style={{ color: "#15803D", marginRight: 4 }}>✓</span>;
  if (status === "running")
    return (
      <span
        style={{
          color: "#E8561B",
          marginRight: 4,
          display: "inline-block",
          animation: "pipelineStepSpin 1s linear infinite",
        }}
      >
        ⟳
      </span>
    );
  if (status === "failed")
    return <span style={{ color: "#B91C1C", marginRight: 4 }}>✕</span>;
  return null;
}

interface PipelineStepperProps {
  currentStepId: PipelineStepId;
  stepStatuses?: Record<PipelineStepId, StepStatus> | null;
  sessionIdShort?: string | null;
  generating?: boolean;
  generatingStep?: PipelineStepId;
}

export function PipelineStepper({
  currentStepId,
  stepStatuses,
  sessionIdShort,
  generating,
  generatingStep,
}: PipelineStepperProps) {
  const statuses: Record<PipelineStepId, StepStatus> = {} as Record<
    PipelineStepId,
    StepStatus
  >;
  for (const step of PIPELINE_STEPS) {
    statuses[step.id] = stepStatuses?.[step.id] ?? "pending";
  }
  if (generating && generatingStep) {
    statuses[generatingStep] = "running";
  }

  const completedCount = PIPELINE_STEPS.filter(
    (s) => statuses[s.id] === "completed"
  ).length;
  const progressPct = Math.round((completedCount / PIPELINE_STEPS.length) * 100);

  return (
    <>
      <style>{`
        @keyframes pipelineStepSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          borderBottom: "1px solid #E4DDD4",
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 3, background: "#E4DDD4" }}>
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: "#E8561B",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Steps row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            padding: "10px 14px",
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
              title="Pipeline runs and saved outputs are scoped to this session. Switch sessions from the Sessions page."
            >
              Active session · {sessionIdShort}
            </span>
          )}
          <div
            style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
          >
            {PIPELINE_STEPS.map((step, i) => {
              const isCurrent = step.id === currentStepId;
              const st = statuses[step.id];
              const c = STEP_STYLE[st];
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
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <StepIcon status={st} />
                    {step.label}
                  </Link>
                </div>
              );
            })}
          </div>
          {!sessionIdShort && (
            <span style={{ fontSize: 11, color: "#9B9189", marginLeft: "auto" }}>
              No active session — pick one in{" "}
              <strong style={{ color: "#6B6B6B" }}>Sessions</strong>.
            </span>
          )}
        </div>
      </div>
    </>
  );
}
