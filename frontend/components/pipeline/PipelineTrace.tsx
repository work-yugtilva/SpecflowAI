"use client";

import React, { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useSessionStore } from "@/lib/store/session-store";
import { cn } from "@/lib/utils";

export type PipelineTraceStepKey =
  | "problems"
  | "features"
  | "decompose"
  | "ui_spec"
  | "tasks"
  | "prd";

type OutputKey =
  | "problems"
  | "features"
  | "decompositions"
  | "ui_specs"
  | "tasks"
  | "prd";

interface RagContextItem {
  title: string;
}

interface TraceQuality {
  score: number;
  passed: boolean;
  critical_issues?: string[];
  items?: Array<{ binary_checks?: Record<string, boolean> }>;
}

const OUTPUT_KEY_BY_STEP: Record<PipelineTraceStepKey, OutputKey> = {
  problems: "problems",
  features: "features",
  decompose: "decompositions",
  ui_spec: "ui_specs",
  tasks: "tasks",
  prd: "prd",
};

const DEPENDENCIES_BY_STEP: Record<PipelineTraceStepKey, string[]> = {
  problems: ["Product Context"],
  features: ["Problems"],
  decompose: ["Problems", "Features"],
  ui_spec: ["Problems", "Features", "Decompositions"],
  tasks: ["Problems", "Features", "Decompositions"],
  prd: ["Product Context", "Problems", "Features", "Decompositions", "Tasks"],
};

const AGENT_BY_STEP: Record<PipelineTraceStepKey, string> = {
  problems: "ProblemsAgent",
  features: "FeaturesAgent",
  decompose: "DecomposeAgent",
  ui_spec: "UISpecAgent",
  tasks: "TasksAgent",
  prd: "PRDAgent",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRagContext(value: unknown): RagContextItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): RagContextItem[] => {
    if (!isRecord(item) || typeof item.title !== "string") return [];
    const title = item.title.trim();
    return title.length > 0 ? [{ title }] : [];
  });
}

function readQuality(value: unknown): TraceQuality | null {
  if (!isRecord(value)) return null;
  if (typeof value.score !== "number" || Number.isNaN(value.score)) return null;
  if (typeof value.passed !== "boolean") return null;
  return {
    score: value.score,
    passed: value.passed,
    critical_issues: Array.isArray(value.critical_issues)
      ? value.critical_issues.map(String)
      : [],
    items: Array.isArray(value.items)
      ? value.items.filter(isRecord).map((item) => ({
          binary_checks: isRecord(item.binary_checks)
            ? Object.fromEntries(
                Object.entries(item.binary_checks).map(([key, checkValue]) => [
                  key,
                  checkValue === true,
                ])
              )
            : undefined,
        }))
      : [],
  };
}

function qualityBadgeClass(quality: TraceQuality): string {
  if (!quality.passed) {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  if (quality.score >= 80) {
    return "border-transparent bg-primary/10 text-primary";
  }
  return "border-transparent bg-secondary text-secondary-foreground";
}

function outputRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value) && Array.isArray(value.data)) return value.data.filter(isRecord);
  if (isRecord(value) && Array.isArray(value.items)) return value.items.filter(isRecord);
  return [];
}

function readSourceIds(value: unknown): string[] {
  const ids = new Set<string>();
  for (const row of outputRows(value)) {
    const sourceIds = row.source_ids;
    if (!Array.isArray(sourceIds)) continue;
    for (const id of sourceIds) {
      const normalized = String(id).trim();
      if (normalized) ids.add(normalized);
    }
  }
  return [...ids];
}

function readEvidenceSourceTitles(value: unknown): RagContextItem[] {
  const titles = new Set<string>();
  for (const row of outputRows(value)) {
    const evidence = row.research_evidence;
    if (typeof evidence === "string") {
      for (const match of evidence.matchAll(/\[Source:\s*([^\]]+)\]/g)) {
        const title = match[1]?.trim();
        if (title) titles.add(title);
      }
      continue;
    }

    const evidenceItems = Array.isArray(evidence) ? evidence : [evidence];
    for (const item of evidenceItems) {
      if (!isRecord(item)) continue;
      const title =
        typeof item.title === "string" && item.title.trim().length > 0
          ? item.title.trim()
          : typeof item.source === "string" && item.source.trim().length > 0
            ? item.source.trim()
            : null;
      if (title) titles.add(title);
    }
  }
  return [...titles].map((title) => ({ title }));
}

function countFailedQualityChecks(quality: TraceQuality | null): number {
  if (!quality?.items) return 0;
  let count = 0;
  for (const item of quality.items) {
    const checks = item.binary_checks ?? {};
    count += Object.values(checks).filter((passed) => !passed).length;
  }
  return count;
}

export function PipelineTrace({ stepKey }: { stepKey: PipelineTraceStepKey }) {
  const [open, setOpen] = useState(false);
  const outputs = useSessionStore((state) => state.activeSessionDetail?.state?.state?.outputs);
  const outputRecord = isRecord(outputs) ? outputs : {};
  const outputKey = OUTPUT_KEY_BY_STEP[stepKey];
  const stepOutput = outputRecord[outputKey];
  const quality = readQuality(outputRecord[`${outputKey}_quality`]);
  const citedSourceIds = readSourceIds(stepOutput);
  const citedSourceTitles = readEvidenceSourceTitles(stepOutput);
  const ragContext = readRagContext(outputRecord.rag_context);
  const evidenceSources =
    citedSourceIds.length > 0
      ? citedSourceTitles.length > 0
        ? citedSourceTitles
        : ragContext
      : citedSourceTitles.length > 0
        ? citedSourceTitles
        : ragContext;
  const evidenceCount =
    citedSourceIds.length > 0
      ? citedSourceIds.length
      : citedSourceTitles.length > 0
        ? citedSourceTitles.length
        : ragContext.length;
  const evidenceLabel =
    citedSourceIds.length > 0
      ? `Grounded on ${evidenceCount} cited evidence item${evidenceCount === 1 ? "" : "s"}.`
      : citedSourceTitles.length > 0
        ? `Grounded on ${evidenceCount} evidence source${evidenceCount === 1 ? "" : "s"}.`
        : evidenceCount > 0
          ? `Grounded on ${evidenceCount} source${evidenceCount === 1 ? "" : "s"} from your uploads.`
          : null;
  const dependencies = DEPENDENCIES_BY_STEP[stepKey];
  const prdRetried = outputRecord._prd_retry === true;
  const failedQualityChecks = countFailedQualityChecks(quality);
  const criticalIssues = quality?.critical_issues ?? [];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded-md text-[12px] font-semibold text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
        >
          How was this generated? {open ? "↑" : "↓"}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 min-w-0 max-w-full overflow-x-auto rounded-lg border border-border bg-card/70 p-3 text-[12px] text-card-foreground shadow-sm">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="font-semibold text-foreground">Evidence used</div>
              {evidenceLabel ? (
                <div className="text-muted-foreground">{evidenceLabel}</div>
              ) : (
                <div className="rounded-md border border-amber-300/80 bg-amber-50 p-2 text-amber-900">
                  No source evidence was attached to this output. Treat this result as unverified.
                </div>
              )}
              {evidenceSources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {evidenceSources.map((source, index) => (
                    <Badge key={`${source.title}-${index}`} variant="outline" className="max-w-full truncate">
                      {source.title}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="font-semibold text-foreground">Memory read</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground">Built using:</span>
                {dependencies.map((dependency) => (
                  <Badge key={dependency} variant="secondary">
                    {dependency}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="font-semibold text-foreground">Quality gate result</div>
              {quality ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={cn("font-bold", qualityBadgeClass(quality))}>
                    {quality.score}/100
                  </Badge>
                  <Badge variant={quality.passed ? "secondary" : "destructive"}>
                    {quality.passed ? "Passed" : "Failed"}
                  </Badge>
                  {failedQualityChecks > 0 && (
                    <Badge variant="outline">
                      {failedQualityChecks} quality issue{failedQualityChecks === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {prdRetried && (
                    <Badge variant="outline">Retry count: 1</Badge>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground">Quality gate unavailable</div>
              )}
              {criticalIssues.length > 0 && (
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                  {criticalIssues.slice(0, 3).map((issue, index) => (
                    <li key={`${issue}-${index}`}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="font-semibold text-foreground">Typed agent</div>
              <div className="text-muted-foreground">
                Executed by: {AGENT_BY_STEP[stepKey]}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
