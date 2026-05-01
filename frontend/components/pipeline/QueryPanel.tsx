"use client";

import { useState } from "react";
import {
  resolveResearchEntries,
  type ResolvedEntry,
} from "@/lib/api/research";
import { EvidencePanel } from "@/components/pipeline/EvidencePanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueryResult {
  answer: string;
  cited_sources: string[];
  suggested_next_steps: string[];
}

export interface QueryPanelProps {
  sessionId: string;
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      style={{
        height: "10px",
        width,
        borderRadius: "4px",
        background:
          "linear-gradient(90deg, #E4DDD4 25%, #EDE7DF 50%, #E4DDD4 75%)",
        backgroundSize: "400px 100%",
        animation: "qpShimmer 1.4s infinite linear",
      }}
    />
  );
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            animation: `qpDot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        color: "#9E9E9E",
        marginBottom: "8px",
      }}
    >
      {children}
    </div>
  );
}

// ─── QueryPanel ───────────────────────────────────────────────────────────────

export function QueryPanel({ sessionId }: QueryPanelProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [resolvedSources, setResolvedSources] = useState<ResolvedEntry[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const submit = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setSourcesOpen(false);
    setResolvedSources([]);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Query failed");
      const data: QueryResult = await res.json();
      setResult(data);

      if (data.cited_sources.length > 0) {
        setSourcesLoading(true);
        resolveResearchEntries(data.cited_sources)
          .then(setResolvedSources)
          .finally(() => setSourcesLoading(false));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const canSubmit = question.trim().length > 0 && !loading;

  return (
    <>
      <style>{`
        @keyframes qpShimmer {
          0%   { background-position: -400px 0 }
          100% { background-position:  400px 0 }
        }
        @keyframes qpDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes qpFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes qpPulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
      `}</style>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E4DDD4",
          borderRadius: "16px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "16px 20px 14px",
            borderBottom: "1px solid #F0EAE1",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              background: "rgba(232,86,27,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E8561B"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="1" fill="#E8561B" stroke="none" />
              <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
            </svg>
          </div>
          <div>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                fontSize: "14px",
                fontWeight: 600,
                color: "#0D0D0D",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              Ask your data
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                fontSize: "11.5px",
                color: "#9E9E9E",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              Grounded in research entries, problems, and PRD
            </p>
          </div>
        </div>

        {/* ── Input row ── */}
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            gap: "8px",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="What should we build next?"
              rows={2}
              disabled={loading}
              style={{
                width: "100%",
                resize: "none",
                border: `1px solid ${inputFocused ? "#E8561B" : "#E4DDD4"}`,
                borderRadius: "10px",
                padding: "10px 42px 10px 12px",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                fontSize: "13.5px",
                color: "#0D0D0D",
                background: loading ? "#F8F4EF" : "#FFFFFF",
                outline: "none",
                lineHeight: 1.5,
                boxSizing: "border-box",
                transition: "border-color 0.15s",
                display: "block",
              }}
            />
            <span
              style={{
                position: "absolute",
                right: "10px",
                bottom: "9px",
                fontSize: "9.5px",
                color: "#C5BEB7",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                letterSpacing: "0.02em",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              ⌘↵
            </span>
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              flexShrink: 0,
              height: "42px",
              padding: "0 16px",
              borderRadius: "10px",
              border: "none",
              background: canSubmit ? "#E8561B" : "#F0EAE1",
              color: canSubmit ? "#FFFFFF" : "#B5ADA6",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "background 0.15s, color 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (canSubmit)
                e.currentTarget.style.background = "#D04A14";
            }}
            onMouseLeave={(e) => {
              if (canSubmit)
                e.currentTarget.style.background = "#E8561B";
            }}
          >
            {loading ? (
              <LoadingDots />
            ) : (
              <>
                Ask
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div
            style={{
              margin: "0 16px 14px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.2)",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              fontSize: "12.5px",
              color: "#EF4444",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && (
          <div
            style={{
              margin: "0 16px 16px",
              padding: "14px 16px",
              borderRadius: "10px",
              background: "#F8F4EF",
              border: "1px solid #E4DDD4",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#E8561B",
                  animation: "qpPulse 1.2s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  fontSize: "12px",
                  color: "#6B6B6B",
                }}
              >
                Searching research and reasoning through context…
              </span>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "7px" }}
            >
              <SkeletonLine width="90%" />
              <SkeletonLine width="75%" />
              <SkeletonLine width="60%" />
            </div>
          </div>
        )}

        {/* ── Result ── */}
        {result && !loading && (
          <div
            style={{
              margin: "0 16px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              animation: "qpFadeIn 0.3s ease-out",
            }}
          >
            {/* Answer */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "10px",
                background: "#F8F4EF",
                border: "1px solid #E4DDD4",
              }}
            >
              <SectionLabel>Answer</SectionLabel>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  fontSize: "13.5px",
                  color: "#0D0D0D",
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {result.answer}
              </p>
            </div>

            {/* Sources — collapsible */}
            {result.cited_sources.length > 0 && (
              <div
                style={{
                  border: "1px solid #E4DDD4",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => setSourcesOpen((o) => !o)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F8F4EF";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "7px" }}
                  >
                    <span
                      style={{
                        fontFamily:
                          "var(--font-dm-sans), 'DM Sans', sans-serif",
                        fontSize: "10px",
                        fontWeight: 700,
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.08em",
                        color: "#6B6B6B",
                      }}
                    >
                      Sources
                    </span>
                    <span
                      style={{
                        fontFamily:
                          "var(--font-dm-sans), 'DM Sans', sans-serif",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#E8561B",
                        background: "rgba(232,86,27,0.1)",
                        padding: "1px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {result.cited_sources.length}
                    </span>
                  </div>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9E9E9E"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{
                      transform: sourcesOpen
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                      flexShrink: 0,
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {sourcesOpen && (
                  <div
                    style={{
                      borderTop: "1px solid #F0EAE1",
                      padding: "10px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "7px",
                      animation: "qpFadeIn 0.18s ease-out",
                    }}
                  >
                    {sourcesLoading ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "7px",
                        }}
                      >
                        <SkeletonLine width="72%" />
                        <SkeletonLine width="55%" />
                      </div>
                    ) : resolvedSources.length > 0 ? (
                      resolvedSources.map((src, i) => (
                        <button
                          key={src.id}
                          onClick={() => setSelectedSourceId(src.id)}
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: "8px",
                            background: "none",
                            border: "none",
                            padding: "2px 0",
                            cursor: "pointer",
                            textAlign: "left",
                            width: "100%",
                          }}
                          onMouseEnter={(e) => {
                            const span = e.currentTarget.querySelector("span:last-child") as HTMLElement | null;
                            if (span) span.style.color = "#E8561B";
                          }}
                          onMouseLeave={(e) => {
                            const span = e.currentTarget.querySelector("span:last-child") as HTMLElement | null;
                            if (span) span.style.color = "#3D3D3D";
                          }}
                        >
                          <span
                            style={{
                              flexShrink: 0,
                              width: "16px",
                              height: "16px",
                              borderRadius: "50%",
                              background: "rgba(232,86,27,0.1)",
                              color: "#E8561B",
                              fontSize: "9px",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {i + 1}
                          </span>
                          <span
                            style={{
                              fontFamily:
                                "var(--font-dm-sans), 'DM Sans', sans-serif",
                              fontSize: "12.5px",
                              color: "#3D3D3D",
                              lineHeight: 1.4,
                              transition: "color 0.12s",
                            }}
                          >
                            {src.title}
                          </span>
                        </button>
                      ))
                    ) : (
                      result.cited_sources.map((id, i) => (
                        <button
                          key={id}
                          onClick={() => setSelectedSourceId(id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            background: "none",
                            border: "none",
                            padding: "2px 0",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'Courier New', monospace",
                              fontSize: "10px",
                              color: "#E8561B",
                            }}
                          >
                            {i + 1}.
                          </span>
                          <span
                            style={{
                              fontFamily: "'Courier New', monospace",
                              fontSize: "10.5px",
                              color: "#9E9E9E",
                              textDecoration: "underline",
                            }}
                          >
                            {id}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Suggested next steps */}
            {result.suggested_next_steps.length > 0 && (
              <div
                style={{
                  border: "1px solid #E4DDD4",
                  borderRadius: "10px",
                  padding: "12px 14px",
                }}
              >
                <SectionLabel>Suggested next steps</SectionLabel>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "9px",
                  }}
                >
                  {result.suggested_next_steps.map((step, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          width: "20px",
                          height: "20px",
                          borderRadius: "6px",
                          background: "rgba(61,107,94,0.1)",
                          color: "#3D6B5E",
                          fontSize: "10px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: "1px",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        style={{
                          fontFamily:
                            "var(--font-dm-sans), 'DM Sans', sans-serif",
                          fontSize: "13px",
                          color: "#0D0D0D",
                          lineHeight: 1.55,
                        }}
                      >
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Evidence drawer — opens when a cited source is clicked */}
      {selectedSourceId && (() => {
        const filteredEvidence = resolvedSources
          .filter((source) => source.id === selectedSourceId)
          .map((source) => ({
            title: source.title,
            content: source.content,
            source: source.type,
          }));
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/35 p-6"
            onClick={() => setSelectedSourceId(null)}
          >
            <div
              className="w-full max-w-xl rounded-xl bg-white p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-stone-950">
                  Research Source
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSourceId(null)}
                  className="rounded-md border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-600 hover:border-stone-400 hover:text-stone-950"
                >
                  Close
                </button>
              </div>
              {filteredEvidence.length > 0 ? (
                <EvidencePanel evidence={filteredEvidence} />
              ) : (
                <p style={{ fontSize: 13, color: '#78716C', fontStyle: 'italic', padding: '12px 0' }}>
                  Source unavailable — the referenced document could not be loaded.
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
