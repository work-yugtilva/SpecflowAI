"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";

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

// ─── Mock Generator ───────────────────────────────────────────────────────────

function generateMockFeatures(): Feature[] {
  return [
    {
      id: "f1",
      title: "Progressive onboarding with contextual defaults",
      description:
        "Replace the all-at-once feature selection step with a staged reveal: show 2–3 defaults pre-selected, let users confirm and move on. Deeper customisation is deferred to an in-app settings tour after activation.",
      linkedProblemId: "p1",
      linkedProblemTitle: "Onboarding drop-off after step 2",
      impact: "High",
      effort: "Medium",
      confidence: 84,
      score: 88,
      reasoning:
        "The primary root cause (too many choices, no defaults) is directly addressed by progressive disclosure. Medium effort because it requires redesigning the onboarding flow but no backend changes.",
      successMetrics: [
        "Onboarding completion rate increases from ~27% to >60%",
        "Step 2 → Step 3 drop-off reduces by 40%+",
        "Time-to-first-value (TTFV) decreases by ≥ 30%",
      ],
    },
    {
      id: "f2",
      title: "Semantic search with intent understanding",
      description:
        "Replace exact keyword matching with a vector-based semantic search that understands synonyms, context, and user intent. Integrate an embedding model to score results by relevance rather than keyword frequency.",
      linkedProblemId: "p2",
      linkedProblemTitle: "Search returns irrelevant results for long queries",
      impact: "High",
      effort: "High",
      confidence: 76,
      score: 72,
      reasoning:
        "High effort due to backend indexing changes and model integration, but high impact because search is a core workflow. Addresses the exact root cause: lack of semantic understanding.",
      successMetrics: [
        "Zero-click search rate drops from 58% to < 20%",
        "Search session satisfaction (thumbs up) > 70%",
        "Support tickets mentioning 'search' reduce by 50%",
      ],
    },
    {
      id: "f3",
      title: "Export shortcut in primary action bar",
      description:
        "Surface a persistent 'Export' button in the top action bar of every data view. The button opens a format picker (CSV, PDF, JSON) inline. No navigation to Settings required.",
      linkedProblemId: "p3",
      linkedProblemTitle: "Export feature not discoverable",
      impact: "Medium",
      effort: "Low",
      confidence: 91,
      score: 93,
      reasoning:
        "Very low effort (UI-only change, existing export logic stays in place) and high discoverability lift. The 8× usage increase among users with a direct export link strongly validates this approach.",
      successMetrics: [
        "Export feature usage increases by 5×",
        "User reports of 'can't find export' drop to 0",
        "Settings page drop-off (currently used to find export) decreases",
      ],
    },
    {
      id: "f4",
      title: "Fluid responsive layout system",
      description:
        "Audit and replace all fixed-width component definitions with fluid, relative units (%, clamp(), min-width). Add automated viewport testing at 320px, 375px, and 414px to CI pipeline.",
      linkedProblemId: "p4",
      linkedProblemTitle: "Mobile layout breaks on smaller screen sizes",
      impact: "Medium",
      effort: "Medium",
      confidence: 89,
      score: 81,
      reasoning:
        "Fixes a known regression with clear scope. Medium effort because it touches multiple components but is well-understood work. CI addition prevents regression.",
      successMetrics: [
        "Zero visual regression flags at 320px–414px viewports in CI",
        "App Store review mentions of UI bugs drop to 0",
        "Mobile session completion rate increases by 15%",
      ],
    },
    {
      id: "f5",
      title: "Smart notification digest with user controls",
      description:
        "Replace per-event emails with a smart daily/weekly digest. The digest groups events by type, highlights only those requiring action, and links directly to the relevant in-app context. Add frequency and category controls to notification settings.",
      linkedProblemId: "p5",
      linkedProblemTitle: "Email notifications are too frequent and non-actionable",
      impact: "Low",
      effort: "Medium",
      confidence: 68,
      score: 57,
      reasoning:
        "Medium effort to build batching and digest templating, but the impact is lower because email engagement is already a secondary channel. User controls add longevity to the solution.",
      successMetrics: [
        "Email unsubscribe rate drops below industry average (< 0.5%)",
        "Notification-to-session conversion increases from 11% to > 30%",
        "User-reported email satisfaction improves in next NPS cycle",
      ],
    },
  ];
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

  const selectedFeature = features.find((f) => f.id === selectedId) ?? null;

  async function handleGenerate() {
    setGenerating(true);
    setSelectedId(null);
    await new Promise((r) => setTimeout(r, 1200));
    const mocks = generateMockFeatures();
    setFeatures(mocks);
    setSelectedId(mocks[0].id);
    setGenerating(false);
  }

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
                      color: "#0D0D0D",
                      marginBottom: 6,
                    }}
                  >
                    No features generated yet.
                  </p>
                  <p style={{ fontSize: 13.5, color: "#6B6B6B", lineHeight: 1.6 }}>
                    Generate feature solutions from your identified problems.
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  className="btn-dark"
                  style={{ fontSize: 14, padding: "0.65rem 1.5rem" }}
                >
                  Generate Features
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
