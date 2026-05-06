"use client";

import React, { useId, useState } from "react";

export type EvidenceSource = {
  id: string;
  filename: string;
  type: "uploaded" | "integration" | "url";
  excerpt: string;
};

export interface EvidenceSourcesSectionProps {
  sources: EvidenceSource[];
}

const EXCERPT_PREVIEW_LENGTH = 120;

const TYPE_LABELS: Record<EvidenceSource["type"], string> = {
  uploaded: "UPLOADED",
  integration: "INTEGRATION",
  url: "URL",
};

const TYPE_BADGE_CLASSES: Record<EvidenceSource["type"], string> = {
  uploaded: "border-orange-200 bg-orange-50 text-orange-700",
  integration: "border-red-200 bg-red-50 text-red-700",
  url: "border-stone-200 bg-stone-50 text-stone-600",
};

function isReadableSourceName(value: string): boolean {
  const name = value.trim();
  if (!name) return false;
  if (/^[a-f0-9]{6,}$/i.test(name)) return false;
  if (/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(name)) return false;
  return true;
}

function formatExcerpt(excerpt: string, expanded: boolean): string {
  if (expanded || excerpt.length <= EXCERPT_PREVIEW_LENGTH) return excerpt;
  return `${excerpt.slice(0, EXCERPT_PREVIEW_LENGTH)}...`;
}

export function EvidenceSourcesSection({ sources }: EvidenceSourcesSectionProps) {
  const headingId = useId();
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  if (sources.length === 0) {
    return <p className="text-sm italic text-stone-500">No sources cited.</p>;
  }

  function toggleSource(sourceId: string) {
    setExpandedById((current) => ({
      ...current,
      [sourceId]: !current[sourceId],
    }));
  }

  return (
    <section className="space-y-3" aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-stone-500"
      >
        Sources
      </h3>

      <div className="space-y-3">
        {sources.map((source, index) => {
          const filename = source.filename.trim();
          const displayFilename = isReadableSourceName(filename) ? filename : "";
          const cardKey = source.id || `${filename}-${index}`;
          const expanded = Boolean(expandedById[cardKey]);
          const hasLongExcerpt = source.excerpt.length > EXCERPT_PREVIEW_LENGTH;

          return (
            <article
              key={cardKey}
              className="rounded-lg border border-stone-200 bg-white px-4 py-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                {displayFilename ? (
                  <h4 className="min-w-0 break-words text-sm font-semibold leading-5 text-stone-950">
                    {displayFilename}
                  </h4>
                ) : (
                  <div aria-hidden="true" />
                )}
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold leading-4 tracking-[0.06em] ${TYPE_BADGE_CLASSES[source.type]}`}
                >
                  {TYPE_LABELS[source.type]}
                </span>
              </div>

              <blockquote className="mt-4 border-l-2 border-orange-500 pl-3 text-sm leading-6 text-stone-700">
                {formatExcerpt(source.excerpt, expanded)}
              </blockquote>

              {hasLongExcerpt && (
                <button
                  type="button"
                  onClick={() => toggleSource(cardKey)}
                  className="mt-3 inline-flex items-center text-xs font-semibold text-orange-700 underline-offset-4 hover:text-orange-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                >
                  {expanded ? "Hide ↑" : "Show full excerpt ↓"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
