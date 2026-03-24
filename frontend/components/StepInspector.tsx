"use client";

import { useState } from "react";

type StepKey = "problems" | "features" | "decompose" | "tasks";

interface FieldDef {
  key: string;
  label: string;
}

const STEP_FIELDS: Record<StepKey, FieldDef[]> = {
  problems: [
    { key: "title", label: "Title" },
    { key: "severity", label: "Severity" },
    { key: "description", label: "Description" },
  ],
  features: [
    { key: "title", label: "Title" },
    { key: "priority", label: "Priority" },
    { key: "acceptance_criteria", label: "Acceptance Criteria" },
  ],
  decompose: [
    { key: "title", label: "Title" },
    { key: "layer", label: "Layer" },
    { key: "user_problem_it_solves", label: "Problem Solved" },
  ],
  tasks: [
    { key: "title", label: "Title" },
    { key: "layer", label: "Layer" },
    { key: "user_problem_it_solves", label: "Problem Solved" },
  ],
};

interface StepInspectorProps {
  step: StepKey;
  items: Record<string, unknown>[];
}

function ItemCard({ item, fields }: { item: Record<string, unknown>; fields: FieldDef[] }) {
  const [issuesOpen, setIssuesOpen] = useState(false);
  const isLowConfidence = item.quality_flag === "low_confidence";
  const qualityIssues = Array.isArray(item.quality_issues) ? item.quality_issues as string[] : [];

  return (
    <div style={{
      background: "#FFFFFF",
      border: `1px solid ${isLowConfidence ? "#E8561B" : "#E5DDD5"}`,
      borderRadius: 8,
      padding: "12px 16px",
      marginBottom: 8,
    }}>
      {isLowConfidence && (
        <div style={{
          display: "inline-block",
          background: "#FFF7ED",
          color: "#C2410C",
          fontSize: 11,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 4,
          marginBottom: 8,
          fontFamily: "Outfit, sans-serif",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>
          Low Confidence
        </div>
      )}
      {fields.map(({ key, label }) => {
        const val = item[key];
        if (!val) return null;
        return (
          <div key={key} style={{ marginBottom: 6 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#9B9189",
              fontFamily: "Outfit, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}>
              {label}
            </span>
            <div style={{
              fontSize: 13,
              color: "#0D0D0D",
              fontFamily: "Outfit, sans-serif",
              marginTop: 2,
            }}>
              {String(val)}
            </div>
          </div>
        );
      })}
      {isLowConfidence && qualityIssues.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setIssuesOpen((o) => !o)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#C2410C",
              fontSize: 12,
              fontFamily: "Outfit, sans-serif",
              padding: 0,
            }}
          >
            {issuesOpen ? "▾" : "▸"} {qualityIssues.length} quality issue{qualityIssues.length !== 1 ? "s" : ""}
          </button>
          {issuesOpen && (
            <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 12, color: "#9A3412", fontFamily: "Outfit, sans-serif" }}>
              {qualityIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function StepInspector({ step, items }: StepInspectorProps) {
  const [open, setOpen] = useState(false);
  const fields = STEP_FIELDS[step] ?? [];

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(items, null, 2)).catch(() => {});
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6B5E52",
            fontSize: 13,
            fontFamily: "Outfit, sans-serif",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {open ? "▾" : "▸"} {items.length} item{items.length !== 1 ? "s" : ""}
        </button>
        <button
          onClick={handleCopy}
          style={{
            background: "none",
            border: "1px solid #E5DDD5",
            borderRadius: 4,
            cursor: "pointer",
            color: "#6B5E52",
            fontSize: 11,
            fontFamily: "Outfit, sans-serif",
            padding: "2px 8px",
          }}
        >
          Copy JSON
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
          {items.map((item, i) => (
            <ItemCard
              key={(item.id as string) ?? i}
              item={item}
              fields={fields}
            />
          ))}
        </div>
      )}
    </div>
  );
}
