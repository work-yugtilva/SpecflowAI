"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { PipelineStepper } from "@/components/pipeline/PipelineStepper";
import { QualityBadge } from "@/components/pipeline/QualityBadge";
import { PipelineTrace } from "@/components/pipeline/PipelineTrace";
import { getSession } from "@/lib/api/session";
import type { SessionDetail } from "@/lib/api/session";
import {
  buildPipelineInputFromStorage,
  clearAutorunFlag,
  isAutorunPending,
} from "@/lib/pipeline-input";
import { useActiveSession } from "@/lib/active-session-context";
import { computeStepStatuses } from "@/lib/pipeline-session";
import { runPipelineStepOrFull } from "@/lib/run-pipeline-client";
import { useSessionStore } from "@/lib/store/session-store";
import { adaptUISpecs } from "@/lib/pipeline-contracts";
import type { UISpecItem, ScreenChange, DataModelChange, WorkflowChange } from "@/lib/pipeline-contracts";
import type { PipelineInput } from "@/lib/pipeline-types";
import dynamic from "next/dynamic";
const TextShimmer = dynamic(
  () => import("@/components/ui/text-shimmer").then((m) => m.TextShimmer)
);

const CHANGE_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  add: { bg: "#F0FDF4", color: "#16A34A" },
  modify: { bg: "#FFF7ED", color: "#D97706" },
  remove: { bg: "#FEF2F2", color: "#DC2626" },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#9E9E9E",
        marginBottom: 6,
        marginTop: 10,
      }}
    >
      {children}
    </div>
  );
}

function Badge({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: bg,
        color,
        letterSpacing: "0.01em",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function ScreenChangeCard({ sc }: { sc: ScreenChange }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4DDD4",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 8,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#0D0D0D", marginBottom: 4 }}>
        {sc.screen || "Unknown Screen"}
      </div>
      {sc.current_state && (
        <div style={{ fontSize: 11.5, color: "#9E9E9E", marginBottom: 4 }}>
          <span style={{ fontWeight: 500, color: "#6B6B6B" }}>Before: </span>
          {sc.current_state}
        </div>
      )}
      {sc.proposed_change && (
        <div style={{ fontSize: 11.5, color: "#0D0D0D", marginBottom: 4 }}>
          <span style={{ fontWeight: 500, color: "#E8561B" }}>After: </span>
          {sc.proposed_change}
        </div>
      )}
      {sc.reason && (
        <div style={{ fontSize: 11, color: "#9E9E9E", fontStyle: "italic" }}>
          {sc.reason}
        </div>
      )}
    </div>
  );
}

function DataModelCard({ dmc }: { dmc: DataModelChange }) {
  const ct = dmc.change_type || "modify";
  const ctColor = CHANGE_TYPE_COLORS[ct] ?? CHANGE_TYPE_COLORS.modify;
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4DDD4",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "#0D0D0D" }}>
          {dmc.entity || "Unknown Entity"}
        </span>
        <Badge label={ct} bg={ctColor.bg} color={ctColor.color} />
      </div>
      {dmc.fields && dmc.fields.length > 0 && (
        <div
          style={{
            background: "#F8F4EF",
            borderRadius: 4,
            padding: "6px 8px",
          }}
        >
          {dmc.fields.map((f, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "#3D3D3D",
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: f.required ? "#E8561B" : "#6B6B6B" }}>
                {f.name}
              </span>
              <span style={{ color: "#9E9E9E" }}>: </span>
              <span style={{ color: "#0D0D0D" }}>{f.type}</span>
              {f.required && (
                <span style={{ color: "#E8561B", marginLeft: 2 }}>*</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({ wc }: { wc: WorkflowChange }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4DDD4",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <Badge
          label={wc.actor || "User"}
          bg="#EFF6FF"
          color="#3B82F6"
        />
      </div>
      {wc.before && (
        <div style={{ fontSize: 11.5, color: "#9E9E9E", marginBottom: 4 }}>
          <span style={{ fontWeight: 500, color: "#6B6B6B" }}>Before: </span>
          {wc.before}
        </div>
      )}
      {wc.after && (
        <div style={{ fontSize: 11.5, color: "#0D0D0D", marginBottom: 4 }}>
          <span style={{ fontWeight: 500, color: "#E8561B" }}>After: </span>
          {wc.after}
        </div>
      )}
      {wc.reason && (
        <div style={{ fontSize: 11, color: "#9E9E9E", fontStyle: "italic" }}>
          {wc.reason}
        </div>
      )}
    </div>
  );
}

function UISpecCard({ spec }: { spec: UISpecItem }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4DDD4",
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "1px solid #F0EBE5",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0D0D0D" }}>
          {spec.title}
        </span>
        {spec.feature_id && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              padding: "2px 6px",
              borderRadius: 4,
              background: "#F3F4F6",
              color: "#6B6B6B",
              fontFamily: "monospace",
            }}
          >
            {spec.feature_id}
          </span>
        )}
      </div>

      {/* Three columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
        }}
      >
        {/* Screen Changes */}
        <div>
          <SectionLabel>
            Screen Changes ({spec.screen_changes.length})
          </SectionLabel>
          {spec.screen_changes.length === 0 ? (
            <div style={{ fontSize: 11, color: "#C8C2BB", fontStyle: "italic" }}>
              None specified
            </div>
          ) : (
            spec.screen_changes.map((sc, i) => (
              <ScreenChangeCard key={i} sc={sc} />
            ))
          )}
        </div>

        {/* Data Model Changes */}
        <div>
          <SectionLabel>
            Data Model ({spec.data_model_changes.length})
          </SectionLabel>
          {spec.data_model_changes.length === 0 ? (
            <div style={{ fontSize: 11, color: "#C8C2BB", fontStyle: "italic" }}>
              None specified
            </div>
          ) : (
            spec.data_model_changes.map((dmc, i) => (
              <DataModelCard key={i} dmc={dmc} />
            ))
          )}
        </div>

        {/* Workflow Changes */}
        <div>
          <SectionLabel>
            Workflow ({spec.workflow_changes.length})
          </SectionLabel>
          {spec.workflow_changes.length === 0 ? (
            <div style={{ fontSize: 11, color: "#C8C2BB", fontStyle: "italic" }}>
              None specified
            </div>
          ) : (
            spec.workflow_changes.map((wc, i) => (
              <WorkflowCard key={i} wc={wc} />
            ))
          )}
        </div>
      </div>

      {/* Open Questions + Risk Notes */}
      {(spec.open_questions.length > 0 || spec.risk_notes.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid #F0EBE5",
          }}
        >
          {spec.open_questions.length > 0 && (
            <div>
              <SectionLabel>Open Questions</SectionLabel>
              {spec.open_questions.map((q, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11.5,
                    color: "#3D3D3D",
                    marginBottom: 4,
                    paddingLeft: 8,
                    borderLeft: "2px solid #E4DDD4",
                  }}
                >
                  {q}
                </div>
              ))}
            </div>
          )}
          {spec.risk_notes.length > 0 && (
            <div>
              <SectionLabel>Risk Notes</SectionLabel>
              {spec.risk_notes.map((r, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11.5,
                    color: "#B45309",
                    marginBottom: 4,
                    paddingLeft: 8,
                    borderLeft: "2px solid #FED7AA",
                  }}
                >
                  {r}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UISpecsPage() {
  const router = useRouter();
  const { activeSessionId } = useActiveSession();
  const setActiveSessionDetail = useSessionStore((s) => s.setActiveSessionDetail);
  const [specs, setSpecs] = useState<UISpecItem[]>([]);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromSession, setFromSession] = useState(false);
  const [qualityScore, setQualityScore] = useState<{ score: number; passed: boolean } | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);

  const stepStatuses = computeStepStatuses(sessionDetail);

  useEffect(() => {
    setSpecs([]);
    setQualityWarning(null);
    setError(null);
    setFromSession(false);
    setSessionDetail(null);
    setActiveSessionDetail(null);
    if (!activeSessionId) return;
    let cancelled = false;
    getSession(activeSessionId)
      .then((d) => {
        if (cancelled) return;
        setSessionDetail(d);
        setActiveSessionDetail(d);
        const out = d.state?.state?.outputs as Record<string, unknown> | undefined;
        if (out && out.ui_specs != null) {
          setFromSession(true);
          const _sq = out?.ui_specs_quality as { score: number; passed: boolean } | undefined;
          if (_sq) setQualityScore(_sq);
          const adapted = adaptUISpecs(out);
          setSpecs(adapted.ui_specs);
          if (adapted.quality_warning) setQualityWarning(adapted.quality_warning);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionDetail(null);
          setActiveSessionDetail(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, setActiveSessionDetail]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setFromSession(false);
    setQualityWarning(null);
    const isAutorun = isAutorunPending(activeSessionId ?? undefined);
    try {
      const inputData: PipelineInput = await buildPipelineInputFromStorage(
        activeSessionId ?? undefined,
        { requireEvidence: false }
      );
      const result = await runPipelineStepOrFull(
        "ui_spec",
        inputData,
        activeSessionId
      );
      const { data, mode, sessionState } = result;
      setFromSession(mode === "session");
      if (data.ui_specs_quality)
        setQualityScore(data.ui_specs_quality as { score: number; passed: boolean });
      const adapted = adaptUISpecs(data, sessionState);
      setSpecs(adapted.ui_specs);
      if (adapted.quality_warning) setQualityWarning(adapted.quality_warning);
      if (activeSessionId) {
        try {
          const d = await getSession(activeSessionId);
          setSessionDetail(d);
          setActiveSessionDetail(d);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (isAutorun) clearAutorunFlag(activeSessionId ?? undefined);
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (!activeSessionId || !isAutorunPending(activeSessionId)) return;
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PipelineStepper
          currentStepId="ui_spec"
          stepStatuses={stepStatuses}
          sessionIdShort={
            activeSessionId ? activeSessionId.slice(0, 8).toUpperCase() : null
          }
          generating={generating}
          generatingStep="ui_spec"
        />

        {/* Top bar */}
        <header
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            flexShrink: 0,
            gap: 12,
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
          >
            <span style={{ fontSize: 13, color: "#9E9E9E", fontWeight: 400, whiteSpace: "nowrap" }}>
              Signals
            </span>
            <span style={{ fontSize: 13, color: "#C8C2BB" }}>›</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#0D0D0D", whiteSpace: "nowrap" }}>
              UI Specs
            </span>
            {fromSession && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: "rgba(232,86,27,0.10)",
                  color: "#E8561B",
                  letterSpacing: "0.03em",
                }}
              >
                From Session
              </span>
            )}
            {qualityScore && (
              <QualityBadge score={qualityScore.score} passed={qualityScore.passed} />
            )}
            {specs.length > 0 && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 500,
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: "#F3F4F6",
                  color: "#6B6B6B",
                }}
              >
                {specs.length} spec{specs.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {specs.length > 0 && (
              <button
                onClick={() => router.push("/tasks")}
                className="btn-dark"
                style={{ fontSize: "0.8125rem", padding: "0.4rem 0.875rem" }}
              >
                Open Tasks →
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating || !activeSessionId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0.4rem 0.875rem",
                borderRadius: 8,
                fontSize: "0.8125rem",
                fontWeight: 500,
                background:
                  generating || !activeSessionId ? "#F8F4EF" : "#FFFFFF",
                border: "1.5px solid #E4DDD4",
                color:
                  generating || !activeSessionId ? "#9E9E9E" : "#0D0D0D",
                cursor: generating || !activeSessionId ? "not-allowed" : "pointer",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
            >
              {generating ? (
                <>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: "1.5px solid #E4DDD4",
                      borderTopColor: "#E8561B",
                      display: "inline-block",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  <TextShimmer duration={1.2}>Generating specs…</TextShimmer>
                </>
              ) : !activeSessionId ? (
                "Select a session in Sessions"
              ) : (
                "Run UI Specs (this step)"
              )}
            </button>
          </div>
        </header>

        {qualityWarning && (
          <div
            role="alert"
            style={{
              background: "rgba(251,191,36,0.08)",
              borderBottom: "1px solid rgba(251,191,36,0.25)",
              padding: "6px 20px",
              fontSize: 12.5,
              color: "#B45309",
              flexShrink: 0,
            }}
          >
            {qualityWarning}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              background: "rgba(239,68,68,0.07)",
              borderBottom: "1px solid rgba(239,68,68,0.15)",
              padding: "6px 20px",
              fontSize: 12.5,
              color: "#EF4444",
              flexShrink: 0,
            }}
          >
            {error}
          </div>
        )}

        {/* Content */}
        {specs.length === 0 && !generating ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#FFFFFF",
                border: "1.5px solid #E4DDD4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              ⬡
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#0D0D0D" }}>
              No UI specs yet
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#9E9E9E",
                textAlign: "center",
                maxWidth: 340,
              }}
            >
              Run UI Specs to generate screen, data model, and workflow change
              specifications from your decompositions.
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
            }}
          >
            {generating && specs.length === 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 40,
                  fontSize: 13,
                  color: "#9E9E9E",
                }}
              >
                <TextShimmer duration={1.5}>Generating UI specs…</TextShimmer>
              </div>
            )}
            {specs.map((spec) => (
              <UISpecCard key={spec.id || spec.title} spec={spec} />
            ))}
          </div>
        )}

        <PipelineTrace stepKey="ui_spec" />
      </div>
    </div>
  );
}
