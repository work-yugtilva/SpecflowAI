"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { runPipeline } from "@/lib/api/pipeline";
import type { PipelineInput } from "@/lib/api/pipeline";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feature {
  id: string;
  title: string;
  description: string;
  linkedProblemId: string;
  linkedProblemTitle: string;
  impact: "High" | "Medium" | "Low";
  effort: "Low" | "Medium" | "High";
  confidence: number;
  score: number;
  reasoning: string;
  successMetrics: string[];
}

// ─── Pipeline Adapter ─────────────────────────────────────────────────────────

function numericToImpact(n: number): Feature["impact"] {
  if (n >= 70) return "High";
  if (n >= 40) return "Medium";
  return "Low";
}

function numericToEffort(n: number): Feature["effort"] {
  if (n >= 70) return "High";
  if (n >= 40) return "Medium";
  return "Low";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptFeatures(data: Record<string, unknown>): Feature[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let raw: any[] = Array.isArray(data.features) ? data.features : [];
  // Unwrap if AI returned { features: [...] } or { items: [...] }
  if (raw.length === 0 && data.features && typeof data.features === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nested = (data.features as any).features ?? (data.features as any).items ?? [];
    if (Array.isArray(nested)) raw = nested;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const problems: any[] = Array.isArray(data.problems) ? data.problems : [];

  return raw.map((item: any, idx: number) => {
    const attrs = item.attributes ?? item;
    const reasoning = item.reasoning ?? {};
    const linkedItems: string[] = Array.isArray(item.linked_items) ? item.linked_items : [];
    const linkedProblem = problems[idx] ?? problems[0] ?? {};

    // impact/effort can be numeric (0-100) or already a string label
    const impactRaw = attrs.impact ?? item.impact ?? 50;
    const effortRaw = attrs.effort ?? item.effort ?? 50;
    const impact: Feature["impact"] =
      typeof impactRaw === "string" ? (impactRaw as Feature["impact"]) : numericToImpact(Number(impactRaw));
    const effort: Feature["effort"] =
      typeof effortRaw === "string" ? (effortRaw as Feature["effort"]) : numericToEffort(Number(effortRaw));

    return {
      id: item.id ?? `f${idx}`,
      title: item.title ?? item.name ?? `Feature ${idx + 1}`,
      description: item.description ?? item.summary ?? "",
      linkedProblemId: linkedProblem.id ?? linkedItems[0] ?? `p${idx}`,
      linkedProblemTitle: linkedProblem.title ?? linkedProblem.summary ?? linkedItems[0] ?? "",
      impact,
      effort,
      confidence: Number(attrs.confidence ?? item.confidence ?? 70),
      score: Number(attrs.score ?? item.score ?? 70),
      reasoning:
        typeof reasoning === "string"
          ? reasoning
          : reasoning.why_it_matters ?? reasoning.summary ?? item.reasoning ?? "",
      successMetrics: Array.isArray(reasoning.tradeoffs)
        ? reasoning.tradeoffs
        : Array.isArray(item.success_metrics)
        ? item.success_metrics
        : [],
    };
  });
}

// ─── Badge configs ────────────────────────────────────────────────────────────

const IMPACT_STYLES: Record<Feature["impact"], { bg: string; color: string }> =
  {
    High: { bg: "#FEF2F2", color: "#EF4444" },
    Medium: { bg: "#FFF7ED", color: "#F59E0B" },
    Low: { bg: "#F0FDF4", color: "#22C55E" },
  };

const EFFORT_STYLES: Record<Feature["effort"], { bg: string; color: string }> =
  {
    Low: { bg: "#F0FDF4", color: "#22C55E" },
    Medium: { bg: "#FFF7ED", color: "#F59E0B" },
    High: { bg: "#FEF2F2", color: "#EF4444" },
  };

function Badge({
  label,
  styles,
  prefix,
}: {
  label: string;
  styles: { bg: string; color: string };
  prefix?: string;
}) {
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
        background: styles.bg,
        color: styles.color,
        flexShrink: 0,
      }}
    >
      {prefix && (
        <span style={{ marginRight: 3, opacity: 0.7, fontWeight: 400 }}>
          {prefix}
        </span>
      )}
      {label}
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

// ─── Features Page ────────────────────────────────────────────────────────────

export default function FeaturesPage() {
  const router = useRouter();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromSession, setFromSession] = useState(false);

  const selectedFeature = features.find((f) => f.id === selectedId) ?? null;

  async function handleGenerate() {
    setGenerating(true);
    setSelectedId(null);
    setError(null);
    setFromSession(false);
    try {
      const pending = localStorage.getItem("specflow_pending_input");
      const inputData: PipelineInput = pending
        ? JSON.parse(pending)
        : { context: JSON.parse(localStorage.getItem("specflow_context") ?? "{}"), research: [], ingest: [] };
      const { data } = await runPipeline(inputData);
      const adapted = adaptFeatures(data);
      if (adapted.length > 0) {
        setFeatures(adapted);
        setSelectedId(adapted[0].id);
      } else {
        setError("Pipeline returned no features. Check your context input.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }

  // Auto-run on mount when redirected from sessions "Run All Steps"
  useEffect(() => {
    if (localStorage.getItem("specflow_autorun") === "1") {
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      {/* Sidebar */}
      <div className="h-full relative flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
                Features
              </span>
            </div>
            {fromSession && (
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "rgba(232,86,27,0.10)", color: "#E8561B", letterSpacing: "0.03em" }}>
                From Session
              </span>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-dark"
            style={{
              fontSize: 13,
              padding: "0.45rem 1rem",
              opacity: generating ? 0.6 : 1,
              cursor: generating ? "not-allowed" : "pointer",
            }}
          >
            {generating ? "Generating…" : "Generate Features"}
          </button>
        </header>

        {/* Content */}
        {features.length === 0 ? (
          /* ── Empty state ── */
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
                <p style={{ fontSize: 13.5, color: "#6B6B6B" }}>
                  Analysing problems…
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-4 text-center"
                style={{ maxWidth: 360 }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "rgba(232,86,27,0.08)",
                    border: "1px solid rgba(232,86,27,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
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
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                  </svg>
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
                    {error ? "Pipeline error" : "No features generated yet."}
                  </p>
                  <p style={{ fontSize: 13.5, color: "#6B6B6B", lineHeight: 1.6 }}>
                    {error ?? "Generate feature solutions from your identified problems."}
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  className="btn-dark"
                  style={{ fontSize: 14, padding: "0.65rem 1.5rem" }}
                >
                  {error ? "Retry" : "Generate Features"}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Two-column layout ── */
          <div className="flex-1 flex min-h-0">
            {/* Left: Features list */}
            <div
              className="flex-shrink-0 flex flex-col overflow-y-auto"
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
                  Features ({features.length})
                </span>
              </div>

              {/* Feature cards */}
              <div className="flex flex-col">
                {features.map((f) => {
                  const active = selectedId === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
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
                        if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.02)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {/* Row 1: badges + score */}
                      <div
                        className="flex items-center gap-1.5 flex-wrap"
                        style={{ marginBottom: 7 }}
                      >
                        <Badge
                          label={f.impact}
                          styles={IMPACT_STYLES[f.impact]}
                          prefix="Impact"
                        />
                        <Badge
                          label={f.effort}
                          styles={EFFORT_STYLES[f.effort]}
                          prefix="Effort"
                        />
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 11.5,
                            color: "#0D0D0D",
                            fontWeight: 600,
                          }}
                        >
                          <span style={{ color: "#9E9E9E", fontWeight: 400 }}>Score </span>
                          {f.score}
                        </span>
                      </div>

                      {/* Row 2: title */}
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: active ? 500 : 400,
                          color: "#0D0D0D",
                          lineHeight: 1.4,
                          marginBottom: 5,
                        }}
                      >
                        {f.title}
                      </div>

                      {/* Row 3: linked problem */}
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9E9E9E",
                          marginBottom: 8,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ↳{" "}
                        {f.linkedProblemTitle.length > 40
                          ? f.linkedProblemTitle.slice(0, 40) + "…"
                          : f.linkedProblemTitle}
                      </div>

                      {/* Row 4: confidence bar */}
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 11.5, color: "#6B6B6B" }}>
                          {f.confidence}% confidence
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 2,
                            background: "#F0EDE9",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${f.confidence}%`,
                              background: "#E8561B",
                              borderRadius: 2,
                            }}
                          />
                        </div>
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
              {selectedFeature ? (
                <div style={{ padding: "24px 28px", maxWidth: 680 }}>
                  {/* Header */}
                  <div
                    className="flex items-start justify-between gap-4"
                    style={{ marginBottom: 12 }}
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
                      {selectedFeature.title}
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
                      Edit Feature
                    </button>
                  </div>

                  {/* Score + badges row */}
                  <div
                    className="flex items-center gap-3 flex-wrap"
                    style={{ marginBottom: 20 }}
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#9E9E9E",
                        }}
                      >
                        Score
                      </span>
                      <span
                        style={{
                          fontSize: "2rem",
                          fontWeight: 700,
                          color: "#0D0D0D",
                          letterSpacing: "-0.03em",
                          lineHeight: 1,
                        }}
                      >
                        {selectedFeature.score}
                      </span>
                    </div>
                    <div style={{ width: 1, height: 24, background: "#E4DDD4" }} />
                    <Badge
                      label={selectedFeature.impact}
                      styles={IMPACT_STYLES[selectedFeature.impact]}
                      prefix="Impact"
                    />
                    <Badge
                      label={selectedFeature.effort}
                      styles={EFFORT_STYLES[selectedFeature.effort]}
                      prefix="Effort"
                    />
                  </div>

                  {/* Description */}
                  <div
                    style={{
                      paddingTop: 18,
                      borderTop: "1px solid #E4DDD4",
                      marginBottom: 20,
                    }}
                  >
                    <SectionLabel>Description</SectionLabel>
                    <p
                      style={{
                        fontSize: 14,
                        color: "#3D3D3D",
                        lineHeight: 1.7,
                      }}
                    >
                      {selectedFeature.description}
                    </p>
                  </div>

                  {/* Linked Problem */}
                  <div
                    style={{
                      paddingTop: 18,
                      borderTop: "1px solid #E4DDD4",
                      marginBottom: 20,
                    }}
                  >
                    <SectionLabel>Linked Problem</SectionLabel>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 10px",
                        background: "#F3F4F6",
                        borderRadius: 8,
                        fontSize: 12.5,
                        color: "#3D3D3D",
                        fontWeight: 400,
                      }}
                    >
                      <span style={{ color: "#9E9E9E" }}>↳</span>
                      {selectedFeature.linkedProblemTitle}
                    </span>
                  </div>

                  {/* Reasoning */}
                  <div
                    style={{
                      paddingTop: 18,
                      borderTop: "1px solid #E4DDD4",
                      marginBottom: 20,
                    }}
                  >
                    <SectionLabel>Reasoning</SectionLabel>
                    <p
                      style={{
                        fontSize: 13.5,
                        color: "#3D3D3D",
                        lineHeight: 1.65,
                      }}
                    >
                      {selectedFeature.reasoning}
                    </p>
                  </div>

                  {/* Success Metrics */}
                  <div
                    style={{
                      paddingTop: 18,
                      borderTop: "1px solid #E4DDD4",
                      marginBottom: 28,
                    }}
                  >
                    <SectionLabel>Success Metrics</SectionLabel>
                    <div className="flex flex-col gap-2.5">
                      {selectedFeature.successMetrics.map((metric, i) => (
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
                          {metric}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => router.push("/decompose")}
                    className="btn-dark w-full"
                    style={{
                      fontSize: "0.9375rem",
                      padding: "0.75rem 1.5rem",
                      borderRadius: 10,
                    }}
                  >
                    Decompose Feature →
                  </button>
                </div>
              ) : (
                <div
                  className="flex-1 flex items-center justify-center h-full"
                  style={{ color: "#9E9E9E", fontSize: 13.5 }}
                >
                  Select a feature to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
