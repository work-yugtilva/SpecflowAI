"use client";

interface CitationBadgeProps {
  sourceIds: string[];
  confidence: "high" | "medium" | "insufficient" | undefined;
}

export function CitationBadge({ sourceIds, confidence }: CitationBadgeProps) {
  let bg: string;
  let color: string;
  let label: string;

  if (confidence === "insufficient" || (sourceIds.length === 0 && confidence === undefined)) {
    bg = "rgba(239,68,68,0.10)";
    color = "#DC2626";
    label = "No source";
  } else if (confidence === "high" || (sourceIds.length > 0 && !confidence)) {
    bg = "rgba(34,197,94,0.10)";
    color = "#15803D";
    label = "Cited ✓";
  } else {
    // confidence === "medium"
    bg = "rgba(245,158,11,0.10)";
    color = "#D97706";
    label = "Partial";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 600,
        background: bg,
        color,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}
