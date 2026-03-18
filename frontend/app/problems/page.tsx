"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Problem {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  impact: "High" | "Medium" | "Low";
  frequency: number;
  tags: string[];
  signals: number;
  evidence: string[];
  rootCause: {
    primary: string;
    secondary?: string;
  };
}

// ─── Mock Generator ───────────────────────────────────────────────────────────

function generateMockProblems(): Problem[] {
  return [
    {
      id: "p1",
      title: "Onboarding drop-off after step 2",
      summary:
        "Users consistently abandon the onboarding flow after the second step, suggesting the value proposition isn't clear early enough or the required effort exceeds perceived benefit.",
      confidence: 87,
      impact: "High",
      frequency: 73,
      tags: ["onboarding", "retention", "UX"],
      signals: 14,
      evidence: [
        "\"I wasn't sure what I was signing up for after the second screen\" — User #34",
        "73% of users who reach step 2 do not proceed to step 3 (analytics, last 30d)",
        "5 out of 8 interviewed users mentioned confusion at the feature selection step",
        "Session recordings show average 45s pause on step 2 before exit",
      ],
      rootCause: {
        primary:
          "Feature selection step presents too many options without context or defaults.",
        secondary:
          "No progress indicator means users can't gauge remaining effort.",
      },
    },
    {
      id: "p2",
      title: "Search returns irrelevant results for long queries",
      summary:
        "Users performing searches with more than 4 words report consistently poor result quality, leading to manual browsing as a workaround and reduced trust in the product.",
      confidence: 79,
      impact: "High",
      frequency: 58,
      tags: ["search", "relevance", "backend"],
      signals: 9,
      evidence: [
        "\"The search just doesn't work for anything specific\" — User #12",
        "58% of searches > 4 tokens result in zero-click sessions",
        "Support tickets mentioning 'search' increased 40% in Q1 2026",
      ],
      rootCause: {
        primary:
          "Current search uses exact keyword matching with no semantic understanding.",
        secondary: "No synonym or stemming support in the index.",
      },
    },
    {
      id: "p3",
      title: "Export feature not discoverable",
      summary:
        "Power users who need to export data to CSV or PDF are unable to find the feature, resorting to copy-paste workarounds that reduce trust and increase churn risk.",
      confidence: 65,
      impact: "Medium",
      frequency: 42,
      tags: ["export", "discoverability", "power-users"],
      signals: 6,
      evidence: [
        "\"I didn't know there was an export button — I've been copying manually\" — User #7",
        "Export menu item is nested 3 levels deep in settings",
        "Feature usage is 8× higher among users who receive a direct link to the export page",
      ],
      rootCause: {
        primary:
          "Export is buried in Settings rather than surfaced in the primary workflow.",
      },
    },
    {
      id: "p4",
      title: "Mobile layout breaks on smaller screen sizes",
      summary:
        "On screens narrower than 375px, several core UI components overflow or overlap, making the app unusable on older iPhones and low-end Android devices.",
      confidence: 91,
      impact: "Medium",
      frequency: 31,
      tags: ["mobile", "responsive", "CSS"],
      signals: 11,
      evidence: [
        "Automated visual regression tests flag 4 broken layouts on 320px viewport",
        "App Store reviews mention UI issues on iPhone SE (3 reviews in Feb 2026)",
        "31% of mobile sessions originate from devices < 375px wide",
      ],
      rootCause: {
        primary:
          "Several components use fixed pixel widths instead of fluid/responsive units.",
        secondary: "No CI check for viewport sizes below 375px.",
      },
    },
    {
      id: "p5",
      title: "Email notifications are too frequent and non-actionable",
      summary:
        "Users are unsubscribing from all notifications after receiving repetitive digests that don't help them take action, creating a permanent engagement gap.",
      confidence: 72,
      impact: "Low",
      frequency: 55,
      tags: ["notifications", "email", "engagement"],
      signals: 7,
      evidence: [
        "\"I just turned all emails off — there were too many and none were useful\" — User #21",
        "Email unsubscribe rate is 2.4× industry average",
        "Only 11% of notification emails result in an app session",
      ],
      rootCause: {
        primary:
          "Notification system sends all events regardless of user activity or relevance.",
        secondary:
          "No smart batching or user-configurable frequency controls.",
      },
    },
  ];
}

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
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const selectedProblem = problems.find((p) => p.id === selectedId) ?? null;

  async function handleGenerate() {
    setGenerating(true);
    setSelectedId(null);
    await new Promise((r) => setTimeout(r, 1200));
    const mocks = generateMockProblems();
    setProblems(mocks);
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
              Problems
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
            {generating ? "Generating…" : "Generate Problems"}
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
                  Analysing ingest data…
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
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
                    No problems generated yet.
                  </p>
                  <p style={{ fontSize: 13.5, color: "#6B6B6B", lineHeight: 1.6 }}>
                    Analyse your ingest data to surface structured problem
                    statements with supporting evidence.
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  className="btn-dark"
                  style={{ fontSize: 14, padding: "0.65rem 1.5rem" }}
                >
                  Generate Problems
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Two-column layout ── */
          <div className="flex-1 flex min-h-0">
            {/* Left: Problems list */}
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
                        <span style={{ fontSize: 11.5, color: "#6B6B6B" }}>
                          {p.confidence}% confidence
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
                              width: `${p.confidence}%`,
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
                          {selectedProblem.confidence}%
                        </div>
                      </div>
                    </div>
                  </div>

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
    </div>
  );
}
