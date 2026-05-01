"use client";

import React, { useState } from "react";
import type { ResearchEvidence } from "@/lib/pipeline-contracts";

export interface EvidencePanelProps {
  evidence: ResearchEvidence[];
}

const EMPTY_EVIDENCE_MESSAGE =
  "No sources linked — rerun with uploaded documents for grounded output.";

const CONTENT_PREVIEW_LENGTH = 120;

const SOURCE_TONES = {
  interview: "border-emerald-200 bg-emerald-50 text-emerald-700",
  analytics: "border-violet-200 bg-violet-50 text-violet-700",
  market_insight: "border-amber-200 bg-amber-50 text-amber-700",
  neutral: "border-stone-200 bg-stone-50 text-stone-600",
} as const;

function normalizeSource(source: string): keyof typeof SOURCE_TONES {
  const normalized = source.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "interview") return "interview";
  if (normalized === "analytics") return "analytics";
  if (normalized === "market_insight" || normalized === "marketinsight") {
    return "market_insight";
  }
  return "neutral";
}

function formatContent(content: string, expanded: boolean): string {
  if (expanded || content.length <= CONTENT_PREVIEW_LENGTH) return content;
  return `${content.slice(0, CONTENT_PREVIEW_LENGTH)}...`;
}

export function EvidencePanel({ evidence }: EvidencePanelProps) {
  const [expandedIndexes, setExpandedIndexes] = useState<Set<number>>(
    () => new Set()
  );

  if (!evidence || evidence.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
        {EMPTY_EVIDENCE_MESSAGE}
      </div>
    );
  }

  function toggleExpanded(index: number) {
    setExpandedIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 px-4 py-3">
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-stone-500">
          Evidence Trace
        </div>
        <div className="mt-1 text-sm text-stone-600">
          {evidence.length} cited source{evidence.length === 1 ? "" : "s"}
        </div>
      </div>
      <ol className="divide-y divide-stone-100">
        {evidence.map((item, index) => {
          const isExpanded = expandedIndexes.has(index);
          const hasLongContent = item.content.length > CONTENT_PREVIEW_LENGTH;
          const sourceTone = SOURCE_TONES[normalizeSource(item.source)];
          const sourceLabel = item.source.trim() || "Source";

          return (
            <li key={`${item.source}-${item.title}-${index}`} className="flex gap-3 px-4 py-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-stone-900 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] ${sourceTone}`}
                  >
                    {sourceLabel}
                  </span>
                  <span className="text-sm font-semibold leading-6 text-stone-950">
                    {item.title || "Untitled source"}
                  </span>
                </div>
                <blockquote className="mt-3 border-l-2 border-orange-300 pl-3 text-sm leading-6 text-stone-700">
                  {formatContent(item.content, isExpanded)}
                </blockquote>
                {hasLongContent && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(index)}
                    className="mt-2 text-xs font-semibold text-orange-700 underline-offset-2 hover:underline"
                  >
                    {isExpanded ? "show less" : "show more"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
