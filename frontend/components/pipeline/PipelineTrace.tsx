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
  | "tasks"
  | "prd";

type OutputKey =
  | "problems"
  | "features"
  | "decompositions"
  | "tasks"
  | "prd";

interface RagContextItem {
  title: string;
}

interface TraceQuality {
  score: number;
  passed: boolean;
}

const OUTPUT_KEY_BY_STEP: Record<PipelineTraceStepKey, OutputKey> = {
  problems: "problems",
  features: "features",
  decompose: "decompositions",
  tasks: "tasks",
  prd: "prd",
};

const DEPENDENCIES_BY_STEP: Record<PipelineTraceStepKey, string[]> = {
  problems: ["Product Context"],
  features: ["Problems"],
  decompose: ["Problems", "Features"],
  tasks: ["Problems", "Features", "Decompositions"],
  prd: ["Product Context", "Problems", "Features", "Decompositions", "Tasks"],
};

const AGENT_BY_STEP: Record<PipelineTraceStepKey, string> = {
  problems: "ProblemsAgent",
  features: "FeaturesAgent",
  decompose: "DecomposeAgent",
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
  return { score: value.score, passed: value.passed };
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

export function PipelineTrace({ stepKey }: { stepKey: PipelineTraceStepKey }) {
  const [open, setOpen] = useState(false);
  const outputs = useSessionStore((state) => state.activeSessionDetail?.state?.state?.outputs);
  const outputRecord = isRecord(outputs) ? outputs : {};
  const outputKey = OUTPUT_KEY_BY_STEP[stepKey];
  const quality = readQuality(outputRecord[`${outputKey}_quality`]);
  const ragContext = readRagContext(outputRecord.rag_context);
  const dependencies = DEPENDENCIES_BY_STEP[stepKey];
  const prdRetried = outputRecord._prd_retry === true;

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
        <div className="mt-2 rounded-lg border border-border bg-card/70 p-3 text-[12px] text-card-foreground shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="font-semibold text-foreground">Evidence used</div>
              <div className="text-muted-foreground">
                Grounded on {ragContext.length} source
                {ragContext.length === 1 ? "" : "s"} from your uploads.
              </div>
              {ragContext.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ragContext.map((source, index) => (
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
                  {prdRetried && (
                    <Badge variant="outline">Retry count: 1</Badge>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground">Quality gate unavailable</div>
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
