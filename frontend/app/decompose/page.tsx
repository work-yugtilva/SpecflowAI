"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { PipelineStepper } from "@/components/pipeline/PipelineStepper";
import { QualityBadge } from "@/components/pipeline/QualityBadge";
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
import { useOrphanedPipeline } from "@/lib/use-orphaned-pipeline";
import { OrphanedPipelineModal } from "@/components/ui/orphaned-pipeline-modal";
import { adaptDecomposition } from "@/lib/pipeline-contracts";
import type {
  DecompositionViewModel as Decomposition,
  DataEntityViewModel as DataEntity,
  UIComponentViewModel as UIComponent,
  WorkflowStepViewModel as WorkflowStep,
} from "@/lib/pipeline-contracts";
import type { PipelineInput } from "@/lib/pipeline-types";
import dynamic from "next/dynamic";
const TextShimmer = dynamic(
  () => import("@/components/ui/text-shimmer").then((m) => m.TextShimmer)
);

// ─── Badge helpers ────────────────────────────────────────────────────────────

const UI_TYPE_COLORS: Record<
  UIComponent["type"],
  { bg: string; color: string }
> = {
  Screen: { bg: "#EFF6FF", color: "#3B82F6" },
  Modal: { bg: "#F5F3FF", color: "#7C3AED" },
  Component: { bg: "#F0FDF4", color: "#16A34A" },
  Form: { bg: "#FFF7ED", color: "#D97706" },
  Navigation: { bg: "#F8F4EF", color: "#9E9E9E" },
};

const ACTOR_COLORS: Record<
  WorkflowStep["actor"],
  { bg: string; color: string }
> = {
  User: { bg: "#EFF6FF", color: "#3B82F6" },
  System: { bg: "#F0FDF4", color: "#16A34A" },
  API: { bg: "#FFF7ED", color: "#D97706" },
  Background: { bg: "#F5F3FF", color: "#7C3AED" },
};

function TypeBadge({
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

// ─── Decompose Page ───────────────────────────────────────────────────────────

export default function DecomposePage() {
  const router = useRouter();
  const { activeSessionId } = useActiveSession();
  const [decomposition, setDecomposition] = useState<Decomposition | null>(
    null
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromSession, setFromSession] = useState(false);
  const [qualityScore, setQualityScore] = useState<{score: number; passed: boolean} | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const {
    showOrphanedModal,
    orphanedOutput,
    triggerOrphanedPrompt,
    closeOrphanedModal,
  } = useOrphanedPipeline();

  const stepStatuses = computeStepStatuses(sessionDetail);
  const regenCount = sessionDetail?.state?.state?.regeneration_counts?.["decompose"] ?? 0;
  const regenLimitReached = regenCount >= 3;
  const regenLeft = Math.max(0, 3 - regenCount);

  useEffect(() => {
    setDecomposition(null);
    setError(null);
    setFromSession(false);
    setSessionDetail(null);
    if (!activeSessionId) return;
    let cancelled = false;
    getSession(activeSessionId)
      .then((d) => {
        if (cancelled) return;
        setSessionDetail(d);
        const out = d.state?.state?.outputs as
          | Record<string, unknown>
          | undefined;
        if (out && out.decompositions != null) {
          setFromSession(true);
          const _dq = out?.decompositions_quality as {score: number; passed: boolean} | undefined;
          if (_dq) setQualityScore(_dq);
          setDecomposition(adaptDecomposition(out));
        }
      })
      .catch(() => {
        if (!cancelled) setSessionDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setFromSession(false);
    const isAutorun = isAutorunPending(activeSessionId ?? undefined);
    try {
      const inputData: PipelineInput = buildPipelineInputFromStorage(
        activeSessionId ?? undefined
      );
      const result = await runPipelineStepOrFull(
        "decompose",
        inputData,
        activeSessionId
      );
      const { data, mode, sessionState } = result;
      setFromSession(mode === "session");
      if (data.decompositions_quality) setQualityScore(data.decompositions_quality as any);
      if (mode === "orphaned" && result.orphanedOutput) {
        triggerOrphanedPrompt(result.orphanedOutput);
      }
      setDecomposition(adaptDecomposition(data, sessionState));
      if (activeSessionId) {
        try {
          setSessionDetail(await getSession(activeSessionId));
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

  const dm = decomposition;

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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <Sidebar />

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PipelineStepper
          currentStepId="decompose"
          stepStatuses={stepStatuses}
          sessionIdShort={activeSessionId ? activeSessionId.slice(0, 8).toUpperCase() : null}
          generating={generating}
          generatingStep="decompose"
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
          {/* Left: breadcrumb + feature chip */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span
              style={{
                fontSize: 13,
                color: "#9E9E9E",
                fontWeight: 400,
                whiteSpace: "nowrap",
              }}
            >
              Signals
            </span>
            <span style={{ fontSize: 13, color: "#C8C2BB" }}>›</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#0D0D0D",
                whiteSpace: "nowrap",
              }}
            >
              Decompose
            </span>
            {fromSession && (
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "rgba(232,86,27,0.10)", color: "#E8561B", letterSpacing: "0.03em" }}>
                From Session
              </span>
            )}
            {qualityScore && (
              <QualityBadge score={qualityScore.score} passed={qualityScore.passed} />
            )}
            {activeSessionId && regenCount > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "rgba(0,0,0,0.06)", color: regenLimitReached ? "#B91C1C" : "#6B6B6B", letterSpacing: "0.03em" }}>
                {regenLeft}/3 Regenerations Left
              </span>
            )}
            {dm && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  background: "#F3F4F6",
                  color: "#3D3D3D",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 300,
                }}
              >
                ↳ {dm.featureTitle}
              </span>
            )}
          </div>

          {/* Right: action buttons */}
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
          >
            {dm && (
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
              disabled={generating || !activeSessionId || regenLimitReached}
              title={regenLimitReached ? "Limit reached. Use the editor." : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0.4rem 0.875rem",
                borderRadius: 8,
                fontSize: "0.8125rem",
                fontWeight: 500,
                background: generating || !activeSessionId || regenLimitReached ? "#F8F4EF" : "#FFFFFF",
                border: "1.5px solid #E4DDD4",
                color: generating || !activeSessionId || regenLimitReached ? "#9E9E9E" : "#0D0D0D",
                cursor: generating || !activeSessionId || regenLimitReached ? "not-allowed" : "pointer",
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
                  <TextShimmer duration={1.2}>Decomposing…</TextShimmer>
                </>
              ) : !activeSessionId ? (
                "Select a session in Sessions"
              ) : (
                "Run Decompose (this step)"
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        {!dm && !generating ? (
          // Empty state
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
                width: 56,
                height: 56,
                borderRadius: 10,
                background: error ? "rgba(239,68,68,0.08)" : "rgba(232,86,27,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {error ? (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="10" stroke="#EF4444" strokeWidth="1.5" />
                  <path d="M14 9v6" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="14" cy="18.5" r="1" fill="#EF4444" />
                </svg>
              ) : (
                /* Layers / architecture icon */
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect x="4" y="5" width="20" height="5" rx="1.5" stroke="#E8561B" strokeWidth="1.5" />
                  <rect x="4" y="12" width="20" height="5" rx="1.5" stroke="#E8561B" strokeWidth="1.5" />
                  <rect x="4" y="19" width="20" height="5" rx="1.5" stroke="#E8561B" strokeWidth="1.5" />
                </svg>
              )}
            </div>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: error ? "#EF4444" : "#0D0D0D",
                  margin: 0,
                }}
              >
                {error ? "Pipeline error" : "No decomposition generated yet."}
              </p>
              {error ? (
                <p
                  style={{
                    fontSize: 12.5,
                    color: "#9E9E9E",
                    margin: "4px 0 0",
                    lineHeight: 1.5,
                    maxWidth: 320,
                  }}
                >
                  {error}
                </p>
              ) : null}
            </div>
            <button
              onClick={handleGenerate}
              disabled={!error && !activeSessionId}
              className="btn-dark"
              style={{
                fontSize: "0.8125rem",
                padding: "0.45rem 1rem",
                marginTop: 4,
                opacity: !error && !activeSessionId ? 0.6 : 1,
                cursor: !error && !activeSessionId ? "not-allowed" : "pointer",
              }}
            >
              {error
                ? "Retry"
                : !activeSessionId
                  ? "Select a session in Sessions"
                  : "Run Decompose (this step)"}
            </button>
          </div>
        ) : generating ? (
          // Generating state
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "2px solid #E4DDD4",
                borderTopColor: "#E8561B",
                display: "inline-block",
                animation: "spin 0.7s linear infinite",
              }}
            />
            <span style={{ fontSize: 13, color: "#9E9E9E" }}>
              <TextShimmer duration={1.2}>Decomposing feature…</TextShimmer>
            </span>
          </div>
        ) : (
          // Three-column layout
          <div
            style={{
              flex: 1,
              display: "flex",
              overflow: "hidden",
            }}
          >
            {/* Column 1 — UI Proposals */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderRight: "1px solid #E4DDD4",
                overflow: "hidden",
              }}
            >
              {/* Column header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #E4DDD4",
                  background: "#FFFFFF",
                  position: "sticky",
                  top: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#9E9E9E",
                  }}
                >
                  UI Proposals
                </span>
                <span style={{ fontSize: 11, color: "#6B6B6B" }}>
                  {dm!.uiComponents.length} components
                </span>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: "auto", background: "#F8F4EF" }}>
                {dm!.uiComponents.map((comp) => {
                  const badge = UI_TYPE_COLORS[comp.type];
                  return (
                    <div
                      key={comp.id}
                      style={{
                        margin: 12,
                        padding: 14,
                        border: "1px solid #E4DDD4",
                        borderRadius: 8,
                        background: "#FFFFFF",
                      }}
                    >
                      {/* Name + type badge */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <TypeBadge
                          label={comp.type}
                          bg={badge.bg}
                          color={badge.color}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#0D0D0D",
                          }}
                        >
                          {comp.name}
                        </span>
                      </div>

                      {/* Description */}
                      <p
                        style={{
                          fontSize: 12,
                          color: "#6B6B6B",
                          lineHeight: 1.5,
                          margin: 0,
                        }}
                      >
                        {comp.description}
                      </p>

                      {/* Elements */}
                      <SectionLabel>Elements</SectionLabel>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 16,
                          listStyle: "disc",
                        }}
                      >
                        {comp.elements.map((el, i) => (
                          <li
                            key={i}
                            style={{ fontSize: 12, color: "#3D3D3D", lineHeight: 1.6 }}
                          >
                            {el}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 2 — Data Model */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderRight: "1px solid #E4DDD4",
                overflow: "hidden",
              }}
            >
              {/* Column header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #E4DDD4",
                  background: "#FFFFFF",
                  position: "sticky",
                  top: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#9E9E9E",
                  }}
                >
                  Data Model
                </span>
                <span style={{ fontSize: 11, color: "#6B6B6B" }}>
                  {dm!.dataEntities.length} entities
                </span>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: "auto", background: "#F8F4EF" }}>
                {dm!.dataEntities.map((entity) => (
                  <div
                    key={entity.id}
                    style={{
                      margin: 12,
                      padding: 14,
                      border: "1px solid #E4DDD4",
                      borderRadius: 8,
                      background: "#FFFFFF",
                    }}
                  >
                    {/* Entity name */}
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0D0D0D",
                        marginBottom: 10,
                        paddingBottom: 8,
                        borderBottom: "1px solid #E4DDD4",
                      }}
                    >
                      {entity.name}
                    </div>

                    {/* Fields table */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {entity.fields.map((field, i) => (
                        <div
                          key={field.name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "4px 0",
                            borderBottom:
                              i < entity.fields.length - 1
                                ? "1px solid #F0EDE9"
                                : "none",
                          }}
                        >
                          {/* Field name */}
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: "#0D0D0D",
                              flex: "0 0 110px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {field.name}
                          </span>
                          {/* Type */}
                          <span
                            style={{
                              fontSize: 11.5,
                              fontFamily:
                                "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
                              color: "#6B6B6B",
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {field.type}
                          </span>
                          {/* Required dot */}
                          {field.required && (
                            <span
                              title="Required"
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "#E8561B",
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Legend */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 10,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#E8561B",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 10.5, color: "#9E9E9E" }}>
                        required
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 3 — Workflow */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Column header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #E4DDD4",
                  background: "#FFFFFF",
                  position: "sticky",
                  top: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#9E9E9E",
                  }}
                >
                  Workflow
                </span>
                <span style={{ fontSize: 11, color: "#6B6B6B" }}>
                  {dm!.workflowSteps.length} steps
                </span>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: "auto", background: "#F8F4EF" }}>
                {dm!.workflowSteps.map((step, i) => {
                  const actorBadge = ACTOR_COLORS[step.actor];
                  return (
                    <div key={step.step}>
                      <div
                        style={{
                          margin: 12,
                          padding: 14,
                          border: "1px solid #E4DDD4",
                          borderRadius: 8,
                          background: "#FFFFFF",
                        }}
                      >
                        {/* Step number + title + actor */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#C8C2BB",
                              flexShrink: 0,
                              minWidth: 20,
                            }}
                          >
                            {String(step.step).padStart(2, "0")}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#0D0D0D",
                              flex: 1,
                            }}
                          >
                            {step.title}
                          </span>
                          <TypeBadge
                            label={step.actor}
                            bg={actorBadge.bg}
                            color={actorBadge.color}
                          />
                        </div>

                        {/* Description */}
                        <p
                          style={{
                            fontSize: 12,
                            color: "#6B6B6B",
                            lineHeight: 1.5,
                            margin: 0,
                          }}
                        >
                          {step.description}
                        </p>

                        {/* Outputs */}
                        {step.outputs.length > 0 && (
                          <>
                            <SectionLabel>Outputs</SectionLabel>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                              }}
                            >
                              {step.outputs.map((out, j) => (
                                <div
                                  key={j}
                                  style={{
                                    fontSize: 12,
                                    color: "#3D3D3D",
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 6,
                                  }}
                                >
                                  <span style={{ color: "#E8561B", flexShrink: 0 }}>
                                    →
                                  </span>
                                  {out}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      <OrphanedPipelineModal
        open={showOrphanedModal}
        onClose={closeOrphanedModal}
        pipelineOutput={orphanedOutput}
      />
    </div>
  );
}
