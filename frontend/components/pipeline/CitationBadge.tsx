"use client";

import React, { useState } from "react";
import type { ResearchEvidence } from "@/lib/pipeline-contracts";

interface CitationBadgeProps {
  researchEvidence: ResearchEvidence[];
}

export function CitationBadge({ researchEvidence }: CitationBadgeProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!researchEvidence || researchEvidence.length === 0) return null;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 4 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {researchEvidence.map((item, i) => {
          const isOpen = expandedIndex === i;
          return (
            <span
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => setExpandedIndex(isOpen ? null : i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedIndex(isOpen ? null : i);
                }
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 600,
                background: isOpen ? "rgba(232,86,27,0.12)" : "#F8F4EF",
                color: isOpen ? "#E8561B" : "#8B7E75",
                border: `1px solid ${isOpen ? "#E8561B" : "#E4DDD4"}`,
                cursor: "pointer",
                userSelect: "none",
                maxWidth: 160,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
              }}
            >
              ¶ {item.title || "Source"}
            </span>
          );
        })}
      </div>
      {expandedIndex !== null && (
        <div
          style={{
            background: "#FDFAF7",
            border: "1px solid #E4DDD4",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          {researchEvidence[expandedIndex].source && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#E8561B",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 5,
              }}
            >
              {researchEvidence[expandedIndex].source}
            </div>
          )}
          <div
            style={{
              fontSize: 12,
              color: "#1A1512",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            {researchEvidence[expandedIndex].title}
          </div>
          <div style={{ fontSize: 12, color: "#4A4542", lineHeight: 1.6 }}>
            {researchEvidence[expandedIndex].content}
          </div>
        </div>
      )}
    </div>
  );
}
