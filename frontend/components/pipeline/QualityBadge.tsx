"use client";

interface QualityBadgeProps {
  score: number | null;
  passed?: boolean;
  size?: "sm" | "md";
}

function scoreColor(score: number): { bg: string; color: string; label: string } {
  if (score >= 80) return { bg: "rgba(34,197,94,0.12)", color: "#15803D", label: "High" };
  if (score >= 65) return { bg: "rgba(245,158,11,0.12)", color: "#D97706", label: "Medium" };
  return { bg: "rgba(239,68,68,0.12)", color: "#DC2626", label: "Low" };
}

export function QualityBadge({ score, passed, size = "sm" }: QualityBadgeProps) {
  if (score == null) return null;
  const { bg, color, label } = scoreColor(score);
  const fontSize = size === "sm" ? 11 : 13;
  const padding = size === "sm" ? "2px 8px" : "4px 12px";

  return (
    <span
      title={`Quality score: ${score}/100 — ${label}${passed === false ? " (below threshold)" : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding,
        borderRadius: 20,
        fontSize,
        fontWeight: 700,
        background: bg,
        color,
        letterSpacing: "0.02em",
        cursor: "help",
      }}
    >
      {passed === false && (
        <span style={{ fontSize: fontSize - 1 }}>⚠</span>
      )}
      {score}/100
    </span>
  );
}
