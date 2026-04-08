// SMOKE TEST: Open /problems after running pipeline with research entries.
// Click Evidence button on any item. Drawer should open showing source entry
// titles and content. citation_confidence badge should be visible.
// If drawer shows "No sources", check that source_ids is populated in DB:
// SELECT title, source_ids FROM problems WHERE session_id = '<your session id>';
"use client";

import { useState, useEffect } from "react";
import {
  resolveResearchEntries,
  type ResolvedEntry,
} from "@/lib/api/research";

export type { ResolvedEntry };

export interface EvidencePanelProps {
  sourceIds: string[];
  citationConfidence: "high" | "medium" | "insufficient" | undefined;
  researchEvidence: string;
  itemTitle: string;
  resolvedEntries?: ResolvedEntry[];
  open: boolean;
  onClose: () => void;
}

const CONFIDENCE_CONFIG = {
  high: {
    color: "#15803D",
    bg: "#DCFCE7",
    label: "High confidence",
    copy: "Strong evidence chain — this item is well-supported by source data.",
  },
  medium: {
    color: "#D97706",
    bg: "#FEF3C7",
    label: "Medium confidence",
    copy: "Partially evidenced — some supporting data present, additional validation recommended.",
  },
  insufficient: {
    color: "#DC2626",
    bg: "#FEE2E2",
    label: "Insufficient evidence",
    copy: "Insufficient source data — treat with caution and verify independently.",
  },
} as const;

const TYPE_COLORS: Record<string, string> = {
  Interview: "#3D6B5E",
  Survey: "#1D4ED8",
  Analytics: "#7C3AED",
  "Market Insight": "#C2410C",
};

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? "#6B6B6B";
  return (
    <span
      style={{
        fontSize: "10px",
        fontFamily: "var(--font-dm-sans), sans-serif",
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase" as const,
        color,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        borderRadius: "4px",
        padding: "2px 6px",
        display: "inline-block",
      }}
    >
      {type}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: "#F8F4EF",
        border: "1px solid #E4DDD4",
        borderRadius: "8px",
        padding: "12px",
        display: "flex",
        flexDirection: "column" as const,
        gap: "8px",
      }}
    >
      <div
        style={{
          height: "10px",
          width: "60px",
          background: "#E4DDD4",
          borderRadius: "4px",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
      <div
        style={{
          height: "14px",
          width: "80%",
          background: "#E4DDD4",
          borderRadius: "4px",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
      <div
        style={{
          height: "12px",
          width: "100%",
          background: "#E4DDD4",
          borderRadius: "4px",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
      <div
        style={{
          height: "12px",
          width: "70%",
          background: "#E4DDD4",
          borderRadius: "4px",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
    </div>
  );
}

function EntryCard({ entry }: { entry: ResolvedEntry }) {
  const isAnalytics = entry.type === "Analytics";
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4DDD4",
        borderRadius: "8px",
        padding: "12px",
        display: "flex",
        flexDirection: "column" as const,
        gap: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap" as const,
        }}
      >
        <TypeBadge type={entry.type} />
      </div>
      <div
        style={{
          fontFamily: "var(--font-dm-sans), sans-serif",
          fontSize: "13px",
          fontWeight: 600,
          color: "#0D0D0D",
          lineHeight: 1.4,
        }}
      >
        {entry.title}
      </div>

      {isAnalytics && entry.metric_name ? (
        <div
          style={{
            background: "#F3F0FF",
            border: "1px solid #C4B5FD",
            borderRadius: "6px",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column" as const,
            gap: "4px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-dm-sans), sans-serif",
              fontSize: "11px",
              fontWeight: 700,
              color: "#7C3AED",
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
            }}
          >
            {entry.metric_name}
          </div>
          <div
            style={{
              display: "flex",
              gap: "16px",
              fontFamily: "'Courier New', monospace",
              fontSize: "13px",
              color: "#0D0D0D",
            }}
          >
            {entry.metric_value != null && (
              <span>
                <span style={{ color: "#6B6B6B", fontSize: "11px" }}>
                  current{" "}
                </span>
                <strong>
                  {entry.metric_value}
                  {entry.metric_unit ?? ""}
                </strong>
              </span>
            )}
            {entry.metric_baseline != null && (
              <span>
                <span style={{ color: "#6B6B6B", fontSize: "11px" }}>
                  baseline{" "}
                </span>
                <strong>
                  {entry.metric_baseline}
                  {entry.metric_unit ?? ""}
                </strong>
              </span>
            )}
          </div>
          {(entry.time_period || entry.data_source) && (
            <div
              style={{
                fontFamily: "var(--font-dm-sans), sans-serif",
                fontSize: "11px",
                color: "#6B6B6B",
              }}
            >
              {[entry.time_period, entry.data_source].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            fontFamily: "var(--font-dm-sans), sans-serif",
            fontSize: "12px",
            color: "#6B6B6B",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
        >
          {entry.content}
        </div>
      )}
    </div>
  );
}

export function EvidencePanel({
  sourceIds,
  citationConfidence,
  researchEvidence,
  itemTitle,
  resolvedEntries,
  open,
  onClose,
}: EvidencePanelProps) {
  const [entries, setEntries] = useState<ResolvedEntry[]>(
    resolvedEntries ?? []
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (resolvedEntries) {
      setEntries(resolvedEntries);
      return;
    }
    if (!sourceIds.length) return;
    setLoading(true);
    resolveResearchEntries(sourceIds)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [open, sourceIds, resolvedEntries]);

  if (!open) return null;

  const conf = citationConfidence ? CONFIDENCE_CONFIG[citationConfidence] : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(13, 13, 13, 0.35)",
          zIndex: 49,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "380px",
          height: "100vh",
          background: "#FFFFFF",
          zIndex: 50,
          display: "flex",
          flexDirection: "column" as const,
          boxShadow: "-4px 0 32px rgba(13, 13, 13, 0.15)",
          animation: "slideInRight 0.25s ease-out",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 20px 16px",
            borderBottom: "1px solid #E4DDD4",
            position: "sticky",
            top: 0,
            background: "#FFFFFF",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-dm-sans), sans-serif",
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.08em",
                  color: "#9E9E9E",
                  marginBottom: "4px",
                }}
              >
                Why we surfaced this
              </div>
              <div
                style={{
                  fontFamily: "var(--font-instrument), serif",
                  fontSize: "16px",
                  color: "#0D0D0D",
                  lineHeight: 1.35,
                }}
              >
                {itemTitle}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                flexShrink: 0,
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #E4DDD4",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6B6B6B",
                fontSize: "16px",
                lineHeight: 1,
              }}
              aria-label="Close evidence panel"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column" as const,
            gap: "24px",
          }}
        >
          {/* AI Reasoning */}
          {researchEvidence && (
            <section>
              <div
                style={{
                  fontFamily: "var(--font-dm-sans), sans-serif",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.07em",
                  color: "#9E9E9E",
                  marginBottom: "10px",
                }}
              >
                AI Reasoning
              </div>
              <div
                style={{
                  borderLeft: "3px solid #E8561B",
                  paddingLeft: "12px",
                  fontFamily: "var(--font-dm-sans), sans-serif",
                  fontSize: "13px",
                  color: "#3D3D3D",
                  lineHeight: 1.6,
                }}
              >
                {researchEvidence}
              </div>
            </section>
          )}

          {/* Source Entries */}
          <section>
            <div
              style={{
                fontFamily: "var(--font-dm-sans), sans-serif",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.07em",
                color: "#9E9E9E",
                marginBottom: "10px",
              }}
            >
              Source Entries
              {!loading && entries.length > 0 && (
                <span
                  style={{
                    marginLeft: "6px",
                    fontWeight: 400,
                    color: "#9E9E9E",
                  }}
                >
                  ({entries.length})
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : entries.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
                {entries.map((e) => (
                  <EntryCard key={e.id} entry={e} />
                ))}
              </div>
            ) : sourceIds.length > 0 ? (
              <div
                style={{
                  fontFamily: "var(--font-dm-sans), sans-serif",
                  fontSize: "13px",
                  color: "#9E9E9E",
                  fontStyle: "italic",
                  padding: "12px",
                  background: "#F8F4EF",
                  borderRadius: "8px",
                  border: "1px solid #E4DDD4",
                }}
              >
                Source entries could not be loaded.
              </div>
            ) : (
              <div
                style={{
                  fontFamily: "var(--font-dm-sans), sans-serif",
                  fontSize: "13px",
                  color: "#9E9E9E",
                  fontStyle: "italic",
                  padding: "12px",
                  background: "#F8F4EF",
                  borderRadius: "8px",
                  border: "1px solid #E4DDD4",
                }}
              >
                No research sources were linked to this item. Add research entries and re-run the pipeline.
              </div>
            )}
          </section>

          {/* Confidence */}
          {conf && (
            <section>
              <div
                style={{
                  fontFamily: "var(--font-dm-sans), sans-serif",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.07em",
                  color: "#9E9E9E",
                  marginBottom: "10px",
                }}
              >
                Confidence
              </div>
              <div
                style={{
                  background: conf.bg,
                  border: `1px solid ${conf.color}40`,
                  borderRadius: "8px",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: conf.color,
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                />
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-dm-sans), sans-serif",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: conf.color,
                      marginBottom: "2px",
                    }}
                  >
                    {conf.label}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-dm-sans), sans-serif",
                      fontSize: "12px",
                      color: "#3D3D3D",
                      lineHeight: 1.5,
                    }}
                  >
                    {conf.copy}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export interface EvidencePanelWithTriggerProps {
  sourceIds: string[];
  citationConfidence: "high" | "medium" | "insufficient" | undefined;
  researchEvidence: string;
  itemTitle: string;
  resolvedEntries?: ResolvedEntry[];
}

export function EvidencePanelWithTrigger(props: EvidencePanelWithTriggerProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-dm-sans), sans-serif",
          fontSize: "12.5px",
          color: "#E8561B",
          textDecoration: hovered ? "underline" : "none",
          letterSpacing: "0.01em",
        }}
      >
        View source evidence →
      </button>
      <EvidencePanel {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function EvidenceTrigger({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: "var(--font-dm-sans), sans-serif",
        fontSize: "11px",
        fontWeight: 500,
        color: hovered ? "#E8561B" : "#6B6B6B",
        background: "transparent",
        border: `1px solid ${hovered ? "#E8561B" : "#E4DDD4"}`,
        borderRadius: "5px",
        padding: "3px 8px",
        cursor: "pointer",
        transition: "color 0.15s, border-color 0.15s",
        letterSpacing: "0.01em",
        lineHeight: 1.5,
      }}
    >
      Evidence
    </button>
  );
}
