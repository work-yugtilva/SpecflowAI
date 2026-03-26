"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { PipelineStepper } from "@/components/pipeline/PipelineStepper";
import { getSession } from "@/lib/api/session";
import type { SessionDetail } from "@/lib/api/session";
import { useActiveSession } from "@/lib/active-session-context";
import { computeStepStatuses } from "@/lib/pipeline-session";
import dynamic from "next/dynamic";
const TextShimmer = dynamic(
  () => import("@/components/ui/text-shimmer").then((m) => m.TextShimmer)
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface QualityScore {
  score: number;
  critical_gaps: string[];
}

type PrdData = Record<string, unknown>;

// ─── Section metadata ─────────────────────────────────────────────────────────

const PRD_SECTIONS: { key: string; title: string }[] = [
  { key: "executive_summary", title: "Executive Summary" },
  { key: "problem_statement", title: "Problem Statement" },
  { key: "goals", title: "Goals" },
  { key: "features", title: "Features" },
  { key: "architecture", title: "Architecture" },
  { key: "implementation_plan", title: "Implementation Plan" },
  { key: "risks", title: "Risks" },
  { key: "success_metrics", title: "Success Metrics" },
];

// ─── Quality badge color ──────────────────────────────────────────────────────

function qualityColor(score: number): { bg: string; color: string } {
  if (score >= 80) return { bg: "rgba(232,86,27,0.12)", color: "#E8561B" };
  if (score >= 60) return { bg: "rgba(245,158,11,0.12)", color: "#D97706" };
  return { bg: "rgba(239,68,68,0.12)", color: "#DC2626" };
}

// ─── Specialized section renderers ────────────────────────────────────────────

function GoalsRenderer({ items }: { items: unknown[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item: any, i) => (
        <div key={i} style={{ background: "#F8F4EF", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontWeight: 600, color: "#0D0D0D", fontSize: 13, marginBottom: 6 }}>{item.goal}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 12, color: "#6B6B6B" }}>
            {item.metric && <span><strong>Metric:</strong> {item.metric}</span>}
            {item.target && <span><strong>Target:</strong> {item.target}</span>}
            {item.timeline && <span><strong>Timeline:</strong> {item.timeline}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function FeaturesRenderer({ items }: { items: unknown[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item: any, i) => (
        <div key={i} style={{ borderLeft: "2px solid #E4DDD4", paddingLeft: 12 }}>
          <div style={{ fontWeight: 600, color: "#0D0D0D", fontSize: 13 }}>{item.title}</div>
          {item.description && <div style={{ fontSize: 13, color: "#6B6B6B", marginTop: 4 }}>{item.description}</div>}
          {item.linked_problem && (
            <div style={{ fontSize: 11, color: "#E8561B", marginTop: 4 }}>Solves: {item.linked_problem}</div>
          )}
          {item.acceptance_criteria && (
            <div style={{
              marginTop: 8, background: "#F3F4F6", borderRadius: 6,
              padding: "8px 10px", fontSize: 12, color: "#374151",
              fontFamily: "var(--font-mono, 'Courier New', monospace)",
              whiteSpace: "pre-wrap",
            }}>
              {item.acceptance_criteria}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const LIKELIHOOD_STYLE: Record<string, { bg: string; color: string }> = {
  high:   { bg: "#FEF2F2", color: "#EF4444" },
  medium: { bg: "#FFF7ED", color: "#F59E0B" },
  low:    { bg: "#F0FDF4", color: "#22C55E" },
};

function RisksRenderer({ items }: { items: unknown[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item: any, i) => {
        const lk = (item.likelihood ?? "medium").toLowerCase();
        const style = LIKELIHOOD_STYLE[lk] ?? LIKELIHOOD_STYLE.medium;
        return (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, flexShrink: 0,
              background: style.bg, color: style.color, textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              {item.likelihood ?? "medium"}
            </span>
            <div>
              <div style={{ fontSize: 13, color: "#0D0D0D", fontWeight: 500 }}>{item.risk}</div>
              {item.mitigation && <div style={{ fontSize: 12, color: "#6B6B6B", marginTop: 3 }}>↳ {item.mitigation}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricsRenderer({ items }: { items: unknown[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item: any, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8,
          background: "#F8F4EF", borderRadius: 8, padding: "10px 12px", fontSize: 12,
        }}>
          <div>
            <div style={{ fontWeight: 600, color: "#0D0D0D", fontSize: 13 }}>{item.metric}</div>
            {item.measurement && <div style={{ color: "#9E9E9E", marginTop: 2 }}>{item.measurement}</div>}
          </div>
          <div style={{ color: "#6B6B6B" }}>
            <div style={{ fontWeight: 500 }}>Baseline</div>
            <div>{item.baseline ?? "—"}</div>
          </div>
          <div style={{ color: "#E8561B" }}>
            <div style={{ fontWeight: 500 }}>Target</div>
            <div>{item.target ?? "—"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ArchitectureRenderer({ arch }: { arch: Record<string, string> }) {
  const layers = [
    { key: "frontend", label: "Frontend" },
    { key: "backend",  label: "Backend" },
    { key: "data",     label: "Data" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {layers.map(({ key, label }) => arch[key] ? (
        <div key={key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: "#F3F4F6", color: "#6B6B6B", textTransform: "uppercase",
            letterSpacing: "0.06em", flexShrink: 0, minWidth: 64, textAlign: "center",
          }}>
            {label}
          </span>
          <span style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.6 }}>{arch[key]}</span>
        </div>
      ) : null)}
    </div>
  );
}

// ─── Section card renderer ────────────────────────────────────────────────────

function SectionCard({ title, value, sectionKey }: { title: string; value: unknown; sectionKey: string }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4DDD4",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 12,
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-instrument), Georgia, serif",
          fontSize: 16,
          fontWeight: 600,
          color: "#0D0D0D",
          marginBottom: 10,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h3>
      <div
        style={{
          fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
          fontSize: 14,
          color: "#6B6B6B",
          lineHeight: 1.7,
        }}
      >
        {sectionKey === "goals" && Array.isArray(value) ? <GoalsRenderer items={value} /> :
         sectionKey === "features" && Array.isArray(value) ? <FeaturesRenderer items={value} /> :
         sectionKey === "risks" && Array.isArray(value) ? <RisksRenderer items={value} /> :
         sectionKey === "success_metrics" && Array.isArray(value) ? <MetricsRenderer items={value} /> :
         sectionKey === "architecture" && typeof value === "object" && !Array.isArray(value) ? <ArchitectureRenderer arch={value as Record<string, string>} /> :
         renderValue(value)}
      </div>
    </div>
  );
}

function renderValue(val: unknown): React.ReactNode {
  if (val == null) return <span style={{ color: "#9E9E9E" }}>—</span>;
  if (typeof val === "string") return <p style={{ margin: 0 }}>{val}</p>;
  if (Array.isArray(val)) {
    return (
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {val.map((item, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {typeof item === "object" && item !== null ? (
              <span>
                {item.title || item.name ? (
                  <strong>{item.title ?? item.name}: </strong>
                ) : null}
                {item.description ?? JSON.stringify(item)}
              </span>
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof val === "object") {
    return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13 }}>{JSON.stringify(val, null, 2)}</pre>;
  }
  return String(val);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrdPage() {
  const { activeSessionId } = useActiveSession();
  const [prd, setPrd] = useState<PrdData | null>(null);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fromSession, setFromSession] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [showConfirmRegenerate, setShowConfirmRegenerate] = useState(false);

  const stepStatuses = computeStepStatuses(sessionDetail);

  // ── Load existing PRD from session on mount ──
  useEffect(() => {
    setPrd(null);
    setQualityScore(null);
    setError(null);
    setFromSession(false);
    setSessionDetail(null);
    if (!activeSessionId) return;
    let cancelled = false;
    getSession(activeSessionId)
      .then((d) => {
        if (cancelled) return;
        setSessionDetail(d);
        const out = d.state?.state?.outputs as Record<string, unknown> | undefined;
        if (out && out.prd != null) {
          setFromSession(true);
          const raw = out.prd;
          // Unwrap {"data": ...} wrapper
          const unwrapped =
            typeof raw === "object" && raw !== null && Object.keys(raw as object).length === 1 && (raw as Record<string, unknown>).data
              ? (raw as Record<string, unknown>).data
              : raw;
          setPrd(unwrapped as PrdData);
        }
      })
      .catch(() => {
        if (!cancelled) setSessionDetail(null);
      });
    return () => { cancelled = true; };
  }, [activeSessionId]);

  // ── Generate PRD ──
  async function handleGenerate() {
    if (!activeSessionId || generating) return;
    setGenerating(true);
    setError(null);
    setPrd(null);
    setQualityScore(null);
    setLoadingPhase("Loading context...");

    try {
      const phaseTimer = setTimeout(() => setLoadingPhase("Drafting PRD..."), 3000);
      const phaseTimer2 = setTimeout(() => setLoadingPhase("Quality check..."), 12000);

      const res = await fetch(`/api/sessions/${activeSessionId}/prd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      clearTimeout(phaseTimer);
      clearTimeout(phaseTimer2);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.detail ?? body.error ?? res.statusText;
        setError(msg);
        return;
      }

      const body = await res.json();
      setPrd(body.prd ?? body.data ?? null);
      if (body.quality_score) setQualityScore(body.quality_score);
      setFromSession(true);

      // Refresh session detail
      try { setSessionDetail(await getSession(activeSessionId)); } catch {}
    } catch {
      setError("Failed to generate PRD. Check that the backend is running.");
    } finally {
      setGenerating(false);
      setLoadingPhase("");
    }
  }

  // ── Export markdown ──
  async function handleExportMarkdown() {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/prd/export`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail ?? body.error ?? "Export failed");
        return;
      }
      const md = await res.text();
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prd-${activeSessionId.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed");
    }
  }

  // ── Render ──
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PipelineStepper
          currentStepId="tasks"
          stepStatuses={stepStatuses}
          sessionIdShort={activeSessionId ? activeSessionId.slice(0, 8).toUpperCase() : null}
          generating={generating}
          generatingStep="tasks"
        />

        {/* Header */}
        <header
          className="flex items-center justify-between px-6 flex-shrink-0"
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[13px]" style={{ color: "#6B6B6B" }}>
              <span>Signals</span>
              <span style={{ color: "#C0B8B0" }}>/</span>
              <span className="font-medium" style={{ color: "#0D0D0D" }}>PRD</span>
            </div>
            {fromSession && (
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "rgba(232,86,27,0.10)", color: "#E8561B", letterSpacing: "0.03em" }}>
                From Session
              </span>
            )}
            {qualityScore && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 10px",
                  borderRadius: 20,
                  background: qualityColor(qualityScore.score).bg,
                  color: qualityColor(qualityScore.score).color,
                  letterSpacing: "0.03em",
                }}
              >
                {qualityScore.score}/100
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {prd && (
              <>
                <button
                  onClick={handleExportMarkdown}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "0.4rem 0.875rem",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    background: "#FFFFFF",
                    border: "1.5px solid #E4DDD4",
                    color: "#6B6B6B",
                    cursor: "pointer",
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5 }}>
                    <path d="M2 9h8M6 2v5M3.5 5.5L6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Export as Markdown
                </button>
                <button
                  onClick={() => setShowConfirmRegenerate(true)}
                  disabled={generating}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "0.4rem 0.875rem",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    background: "#FFFFFF",
                    border: "1.5px solid #E4DDD4",
                    color: "#6B6B6B",
                    cursor: generating ? "not-allowed" : "pointer",
                    opacity: generating ? 0.6 : 1,
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  }}
                >
                  Regenerate
                </button>
              </>
            )}
            {!prd && (
              <button
                onClick={handleGenerate}
                disabled={generating || !activeSessionId}
                className="btn-dark"
                style={{
                  fontSize: 13,
                  padding: "0.45rem 1rem",
                  opacity: generating || !activeSessionId ? 0.6 : 1,
                  cursor: generating || !activeSessionId ? "not-allowed" : "pointer",
                }}
              >
                {generating ? (
                  <TextShimmer duration={1.2}>
                    {loadingPhase || "Generating..."}
                  </TextShimmer>
                ) : !activeSessionId ? (
                  "Select a session in Sessions"
                ) : (
                  "Generate PRD"
                )}
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        {!prd ? (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ padding: "2rem" }}>
            {generating ? (
              <div className="flex flex-col items-center gap-3">
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: "2.5px solid #E4DDD4",
                    borderTopColor: "#E8561B",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <TextShimmer duration={1.2}>
                  {loadingPhase || "Generating PRD..."}
                </TextShimmer>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4 }}>
                  <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.5" />
                  <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 13, color: "#6B6B6B", textAlign: "center", maxWidth: 400 }}>{error}</span>
                <button
                  onClick={handleGenerate}
                  disabled={!activeSessionId}
                  className="btn-dark"
                  style={{ fontSize: 13, padding: "0.4rem 1rem", marginTop: 8 }}
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: 13, color: "#6B6B6B" }}>
                  {activeSessionId
                    ? "No PRD generated yet. Run all pipeline steps first, then generate."
                    : "Select a session in Sessions to get started."}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex-1 overflow-y-auto"
            style={{ padding: "24px 28px" }}
          >
            {/* Quality gaps banner */}
            {qualityScore && qualityScore.score < 70 && qualityScore.critical_gaps.length > 0 && (
              <div
                style={{
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#6B6B6B",
                }}
              >
                <strong style={{ color: "#DC2626" }}>Quality gaps detected ({qualityScore.score}/100):</strong>
                <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                  {qualityScore.critical_gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Section cards */}
            {PRD_SECTIONS.map(({ key, title }) => {
              const val = prd[key];
              if (val == null) return null;
              return <SectionCard key={key} title={title} value={val} sectionKey={key} />;
            })}
          </div>
        )}
      </div>

      {/* Regenerate confirmation dialog */}
      {showConfirmRegenerate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowConfirmRegenerate(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF",
              borderRadius: 14,
              padding: "28px 28px 20px",
              width: 400,
              maxWidth: "90vw",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#0D0D0D", marginBottom: 8 }}>
              Regenerate PRD?
            </h3>
            <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.6, marginBottom: 20 }}>
              This will overwrite the existing PRD with a new generation. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmRegenerate(false)}
                style={{
                  padding: "0.4rem 1rem",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  background: "#FFFFFF",
                  border: "1.5px solid #E4DDD4",
                  color: "#6B6B6B",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmRegenerate(false);
                  handleGenerate();
                }}
                className="btn-dark"
                style={{ fontSize: 13, padding: "0.4rem 1rem" }}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
