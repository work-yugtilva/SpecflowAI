"use client";

import React from "react";
import type { ResearchEvidence } from "@/lib/pipeline-contracts";
import {
  EvidenceSourcesSection,
  type EvidenceSource,
} from "./EvidenceSourcesSection";

export interface EvidencePanelProps {
  evidence: ResearchEvidence[];
}

function isReadableSourceName(value: string): boolean {
  const name = value.trim();
  if (!name) return false;
  if (/^[a-f0-9]{6,}$/i.test(name)) return false;
  if (/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(name)) return false;
  return true;
}

function inferSourceType(evidence: ResearchEvidence): EvidenceSource["type"] {
  const text = `${evidence.source} ${evidence.title}`.toLowerCase();
  if (text.includes("upload") || text.includes("file") || text.includes("document")) {
    return "uploaded";
  }
  if (text.includes("url") || /^https?:\/\//i.test(evidence.title.trim())) {
    return "url";
  }
  return "integration";
}

function toEvidenceSource(item: ResearchEvidence, index: number): EvidenceSource {
  const title = item.title.trim();
  const source = item.source.trim();
  const filename = isReadableSourceName(title)
    ? title
    : isReadableSourceName(source)
      ? source
      : "";

  return {
    id: `${index}-${title || source}`,
    filename,
    type: inferSourceType(item),
    excerpt: item.content,
  };
}

export function EvidencePanel({ evidence }: EvidencePanelProps) {
  const sources = (evidence ?? []).map(toEvidenceSource);
  return <EvidenceSourcesSection sources={sources} />;
}
