"use client";

import { useState, useEffect } from "react";
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
import {
  adaptProblems,
  describeProblemsEmptyState,
} from "@/lib/pipeline-contracts";
import { CitationBadge } from "@/components/pipeline/CitationBadge";
import { EvidencePanel } from "@/components/pipeline/EvidencePanel";
import type { ProblemViewModel as Problem } from "@/lib/pipeline-contracts";
import type { PipelineInput } from "@/lib/pipeline-types";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { useOrphanedPipeline } from "@/lib/use-orphaned-pipeline";
import { OrphanedPipelineModal } from "@/components/ui/orphaned-pipeline-modal";
import { ConversationPanel } from "@/components/ui/conversation-panel";
import { useSessionStore } from "@/lib/store/session-store";

// ─── Impact badge ─────────────────────────────────────────────────────────────

const IMPACT_STYLES: Record<
  Problem["impact"],
  { bg: string; color: string }
> = {
  High: { bg: "#FEF2F2", color: "#EF4444" },
  Medium: { bg: "#FFF7ED", color: "#F59E0B" },
  Low: { bg: "#F0FDF4", color: "#22C55E" },
};

function ImpactBadge({ impact }: { impact: Problem["impact"] }) {
  const s = IMPACT_STYLES[impact];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: s.bg,
        color: s.color,
        flexShrink: 0,
      }}
    >
      {impact}
    </span>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#6B6B6B",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

// ─── Problems Page ────────────────────────────────────────────────────────────

export default function ProblemsPage() {
  const router = useRouter();
  const { activeSessionId } = useActiveSession();
  const setActiveSessionDetail = useSessionStore((s) => s.setActiveSessionDetail);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const selectedProblem = problems.find((p) => p.id === selectedId) ?? null;
  const stepStatuses = computeStepStatuses(sessionDetail);
  const regenCount = sessionDetail?.state?.state?.regeneration_counts?.["problems"] ?? 0;
  const regenLimitReached = regenCount >= 3;
  const regenLeft = Math.max(0, 3 - regenCount);

  useEffect(() => {
    setProblems([]);
    setSelectedId(null);
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
        const out = d.state?.state?.outputs as
          | Record<string, unknown>
          | undefined;
        // Only hydrate non-empty lists so a stale in-flight GET cannot overwrite
        // a successful run with an empty `problems: []` snapshot.
        if (out && out.problems != null) {
          const adapted = adaptProblems(out);
          if (adapted.length > 0) {
            setFromSession(true);
            const _pq = out?.problems_quality as {score: number; passed: boolean} | undefined;
            if (_pq) setQualityScore(_pq);
            setProblems(adapted);
            setSelectedId(adapted[0].id);
          }
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
    setSelectedId(null);
    setError(null);
    setFromSession(false);
    setProblems([]);
    const isAutorun = isAutorunPending(activeSessionId ?? undefined);
    try {
      const inputData: PipelineInput = await buildPipelineInputFromStorage(
        activeSessionId ?? undefined
      );
      const result = await runPipelineStepOrFull(
        "problems",
        inputData,
        activeSessionId
      );
      const { data, mode, sessionState } = result;
      setFromSession(mode === "session");
      if (data.problems_quality) setQualityScore(data.problems_quality as any);
      // If orphaned, trigger save prompt after processing results
      if (mode === "orphaned" && result.orphanedOutput) {
        triggerOrphanedPrompt(result.orphanedOutput);
      }
      const adapted = adaptProblems(data, sessionState);
      setProblems(adapted);
      if (adapted.length > 0) {
        setSelectedId(adapted[0].id);
      } else {
        setError(describeProblemsEmptyState(data, sessionState));
      }
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
      className="flex h-screen overflow-hidden"
      style={{
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .problems-two-col { flex-direction: column; }
          .problems-list-panel { width: 100% !important; min-height: 240px; max-height: 40vh; border-right: none !important; border-bottom: 1px solid #E4DDD4; }
        }
      `}</style>
      <Sidebar />

      {/* Main area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PipelineStepper
          currentStepId="problems"
          stepStatuses={stepStatuses}
          sessionIdShort={activeSessionId ? activeSessionId.slice(0, 8).toUpperCase() : null}
          generating={generating}
          generatingStep="problems"
        />
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 flex-shrink-0"
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 text-[13px]"
              style={{ color: "#6B6B6B" }}
            >
              <span>Signals</span>
              <span style={{ color: "#C0B8B0" }}>/</span>
              <span className="font-medium" style={{ color: "#0D0D0D" }}>
                Problems
              </span>
            </div>
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
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !activeSessionId || regenLimitReached}
            title={regenLimitReached ? "Limit reached. Use the editor." : undefined}
            className="btn-dark"
            style={{
              fontSize: 13,
              padding: "0.45rem 1rem",
              opacity: generating || !activeSessionId || regenLimitReached ? 0.6 : 1,
              cursor: generating || !activeSessionId || regenLimitReached ? "not-allowed" : "pointer",
            }}
          >
            {generating
              ? <TextShimmer duration={1.2}>Running…</TextShimmer>
              : !activeSessionId
                ? "Select a session in Sessions"
                : "Run Problems (this step)"}
          </button>
        </header>

        {/* Content area */}
        {problems.length === 0 ? (
          /* ── Empty state ── */
          <div
            className="flex-1 flex flex-col items-center justify-center"
            style={{ padding: "2rem" }}
          >
            {generating ? (
              <div className="flex flex-col items-center gap-3">
                <TextShimmer duration={1.2} className="text-sm">Running pipeline…</TextShimmer>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-4 text-center"
                style={{ maxWidth: 360 }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: error ? "rgba(239,68,68,0.08)" : "rgba(232,86,27,0.08)",
                    border: error ? "1px solid rgba(239,68,68,0.15)" : "1px solid rgba(232,86,27,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {error ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  ) : (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#E8561B"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  )}
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "1rem",
                      fontWeight: 500,
                      color: error ? "#EF4444" : "#0D0D0D",
                      marginBottom: 6,
                    }}
                  >
                    {error ? "Pipeline error" : "No problems generated yet."}
                  </p>
                  {error ? (
                    <p style={{ fontSize: 13.5, color: "#6B6B6B", lineHeight: 1.6 }}>
                      {error}
                    </p>
                  ) : (
                    <p style={{ fontSize: 13.5, color: "#6B6B6B", lineHeight: 1.6 }}>
                      Run the pipeline from your session to generate problems.{" "}
                      <a
                        href="/sessions"
                        style={{ color: "#E8561B", textDecoration: "underline", fontWeight: 500 }}
                      >
                        Go to Sessions
                      </a>
                    </p>
                  )}
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!error && !activeSessionId}
                  className="btn-dark"
                  style={{
                    fontSize: 14,
                    padding: "0.65rem 1.5rem",
                    opacity: !error && !activeSessionId ? 0.6 : 1,
                    cursor: !error && !activeSessionId ? "not-allowed" : "pointer",
                  }}
                >
                  {error
                    ? "Retry"
                    : !activeSessionId
                      ? "Select a session in Sessions"
                      : "Run Problems (this step)"}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Two-column layout ── */
          <div className="flex-1 flex min-h-0 problems-two-col">
            {/* Left: Problems list */}
            <div
              className="flex-shrink-0 flex flex-col overflow-y-auto problems-list-panel"
              style={{
                width: 320,
                borderRight: "1px solid #E4DDD4",
                background: "#FFFFFF",
              }}
            >
              {/* List header */}
              <div
                style={{
                  padding: "14px 16px 10px",
                  borderBottom: "1px solid #F0EDE9",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#6B6B6B",
                  }}
                >
                  Problems ({problems.length})
                </span>
              </div>

              {/* Problem cards */}
              <div className="flex flex-col">
                {problems.map((p) => {
                  const active = selectedId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        borderBottom: "1px solid #F0EDE9",
                        borderLeft: active
                          ? "3px solid #E8561B"
                          : "3px solid transparent",
                        background: active
                          ? "rgba(232,86,27,0.04)"
                          : "transparent",
                        cursor: "pointer",
                        transition: "background 120ms ease, border-color 120ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background =
                            "rgba(0,0,0,0.02)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      {/* Row 1: impact + tags + signals */}
                      <div
                        className="flex items-center gap-1.5 flex-wrap"
                        style={{ marginBottom: 7 }}
                      >
                        <ImpactBadge impact={p.impact} />
                        {/* Row 2.5: citation badges */}
                        {p.researchEvidence && p.researchEvidence.length > 0 && (
                          <div style={{ marginBottom: 6 }}>
                            <CitationBadge researchEvidence={p.researchEvidence} />
                          </div>
                        )}
                        {p.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: 11,
                              padding: "2px 6px",
                              borderRadius: 6,
                              background: "#F3F4F6",
                              color: "#6B6B6B",
                              fontWeight: 400,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 11,
                            color: "#9E9E9E",
                          }}
                        >
                          {p.signals} signals
                        </span>
                      </div>

                      {/* Row 2: title */}
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: active ? 500 : 400,
                          color: "#0D0D0D",
                          lineHeight: 1.4,
                          marginBottom: 8,
                        }}
                      >
                        {p.title}
                      </div>

                      {/* Row 3: confidence bar */}
                      <div className="flex items-center gap-2">
                        {p.confidence != null ? (
                          <>
                            <span style={{ fontSize: 11.5, color: "#6B6B6B" }}>
                              {p.confidence}% confidence
                            </span>
                            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#F0EDE9", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${p.confidence}%`, background: "#E8561B", borderRadius: 2 }} />
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 11.5, color: "#C8C2BB" }}>— confidence</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Detail panel */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ background: "#F8F4EF" }}
            >
              {selectedProblem ? (
                <div style={{ padding: "24px 28px", maxWidth: 680 }}>
                  {/* Detail header */}
                  <div
                    className="flex items-start justify-between gap-4"
                    style={{ marginBottom: 16 }}
                  >
                    <h1
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 600,
                        color: "#0D0D0D",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.3,
                      }}
                    >
                      {selectedProblem.title}
                    </h1>
                    <button
                      style={{
                        flexShrink: 0,
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "#6B6B6B",
                        background: "transparent",
                        border: "1px solid #E4DDD4",
                        borderRadius: 8,
                        padding: "5px 12px",
                        cursor: "pointer",
                        transition: "border-color 150ms ease, color 150ms ease",
                        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#0D0D0D";
                        e.currentTarget.style.color = "#0D0D0D";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E4DDD4";
                        e.currentTarget.style.color = "#6B6B6B";
                      }}
                    >
                      Edit Problem
                    </button>
                  </div>

                  {/* Summary */}
                  <p
                    style={{
                      fontSize: 14,
                      color: "#3D3D3D",
                      lineHeight: 1.7,
                      marginBottom: 24,
                    }}
                  >
                    {selectedProblem.summary}
                  </p>

                  <div className="mb-6">
                    <SectionLabel>Evidence Trace</SectionLabel>
                    <EvidencePanel evidence={selectedProblem.researchEvidence ?? []} />
                  </div>

                  {/* Evidence */}
                  <div
                    style={{
                      paddingTop: 18,
                      borderTop: "1px solid #E4DDD4",
                      marginBottom: 20,
                    }}
                  >
                    <SectionLabel>Evidence</SectionLabel>
                    <div className="flex flex-col gap-2.5">
                      {selectedProblem.evidence.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 13.5,
                            color: "#3D3D3D",
                            lineHeight: 1.6,
                            borderLeft: "2px solid #E4DDD4",
                            paddingLeft: 12,
                          }}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Root Cause */}
                  <div
                    style={{
                      paddingTop: 18,
                      borderTop: "1px solid #E4DDD4",
                      marginBottom: 20,
                    }}
                  >
                    <SectionLabel>Root Cause</SectionLabel>
                    <div className="flex flex-col gap-3">
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#9E9E9E",
                            fontWeight: 500,
                            marginBottom: 4,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Primary
                        </div>
                        <p
                          style={{
                            fontSize: 13.5,
                            color: "#0D0D0D",
                            lineHeight: 1.6,
                          }}
                        >
                          {selectedProblem.rootCause.primary}
                        </p>
                      </div>
                      {selectedProblem.rootCause.secondary && (
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#9E9E9E",
                              fontWeight: 500,
                              marginBottom: 4,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            Secondary
                          </div>
                          <p
                            style={{
                              fontSize: 13.5,
                              color: "#0D0D0D",
                              lineHeight: 1.6,
                            }}
                          >
                            {selectedProblem.rootCause.secondary}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div
                    style={{
                      paddingTop: 18,
                      borderTop: "1px solid #E4DDD4",
                      marginBottom: 28,
                    }}
                  >
                    <SectionLabel>Metrics</SectionLabel>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 12,
                      }}
                    >
                      {/* Impact */}
                      <div
                        style={{
                          padding: "14px 16px",
                          background: "#FFFFFF",
                          border: "1px solid #E4DDD4",
                          borderRadius: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            color: "#9E9E9E",
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: 6,
                          }}
                        >
                          Impact
                        </div>
                        <ImpactBadge impact={selectedProblem.impact} />
                      </div>
                      {/* Frequency */}
                      <div
                        style={{
                          padding: "14px 16px",
                          background: "#FFFFFF",
                          border: "1px solid #E4DDD4",
                          borderRadius: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            color: "#9E9E9E",
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: 6,
                          }}
                        >
                          Frequency
                        </div>
                        <div
                          style={{
                            fontSize: "1.25rem",
                            fontWeight: 600,
                            color: "#0D0D0D",
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {selectedProblem.frequency}%
                        </div>
                      </div>
                      {/* Confidence */}
                      <div
                        style={{
                          padding: "14px 16px",
                          background: "#FFFFFF",
                          border: "1px solid #E4DDD4",
                          borderRadius: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            color: "#9E9E9E",
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: 6,
                          }}
                        >
                          Confidence
                        </div>
                        <div
                          style={{
                            fontSize: "1.25rem",
                            fontWeight: 600,
                            color: "#0D0D0D",
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {selectedProblem.confidence != null ? `${selectedProblem.confidence}%` : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <PipelineTrace stepKey="problems" />

                  {/* CTA */}
                  <button
                    onClick={() => router.push("/features")}
                    className="btn-dark w-full"
                    style={{
                      fontSize: "0.9375rem",
                      padding: "0.75rem 1.5rem",
                      borderRadius: 10,
                    }}
                  >
                    Generate Features →
                  </button>
                </div>
              ) : (
                /* No selection yet */
                <div
                  className="flex-1 flex items-center justify-center h-full"
                  style={{ color: "#9E9E9E", fontSize: 13.5 }}
                >
                  Select a problem to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <OrphanedPipelineModal
        open={showOrphanedModal}
        onClose={closeOrphanedModal}
        pipelineOutput={orphanedOutput}
      />
      <ConversationPanel
        sessionId={activeSessionId}
        contextKeys={["problems"]}
        mode="float"
      />
    </div>
  );
}
