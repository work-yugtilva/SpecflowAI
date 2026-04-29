import type { SessionDetail } from "@/lib/api/session";
import type { PipelineOutputs, QualityGateResult } from "@/lib/pipeline-contracts";
import {
  PIPELINE_STEPS,
  computeStepStatuses,
  type PipelineStepId,
} from "@/lib/pipeline-session";

export interface SourceReadinessCounts {
  available: boolean;
  sourceCount?: number;
  evidenceCount?: number;
}

export interface EvidenceReadinessRow {
  label: string;
  value: string;
  ready: boolean;
}

export type SessionHomeActionType = "link" | "run-step" | "generate-handoff" | "view-handoff";

export interface SessionHomeAction {
  label: string;
  type: SessionHomeActionType;
  href?: string;
  step?: PipelineStepId | "prd";
}

export interface RecentOutputRow {
  key: "problems" | "features" | "decompositions" | "tasks" | "prd" | "handoff";
  label: string;
  available: boolean;
  count: number;
  qualityScore: number | null;
  action: SessionHomeAction;
}

export interface SessionHomeSummary {
  sessionName: string;
  shortSessionId: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  missingContextFields: string[];
  contextReady: boolean;
  researchCount: number;
  sourceCounts: SourceReadinessCounts;
  completedSteps: number;
  totalSteps: number;
  nextRecommendedStep: string;
  lastGeneratedArtifact: string | null;
  evidenceRows: EvidenceReadinessRow[];
  recentOutputs: RecentOutputRow[];
  hasHandoff: boolean;
}

const REQUIRED_CONTEXT_FIELDS = [
  { key: "companyName", label: "Company" },
  { key: "productName", label: "Product" },
  { key: "productDescription", label: "Product description" },
  { key: "targetUsers", label: "Target users" },
  { key: "goals", label: "Goals" },
] as const;

const OUTPUT_ROWS = [
  { key: "problems", label: "Problems", viewHref: "/problems", runStep: "problems" },
  { key: "features", label: "Features", viewHref: "/features", runStep: "features" },
  { key: "decompositions", label: "Decompositions", viewHref: "/decompose", runStep: "decompose" },
  { key: "tasks", label: "Tasks", viewHref: "/tasks", runStep: "tasks" },
  { key: "prd", label: "PRD", viewHref: "/prd", runStep: "prd" },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapOutput(value: unknown): unknown {
  let current = value;
  for (let i = 0; i < 4; i++) {
    if (!isRecord(current)) return current;
    const next = current.data ?? current.items ?? current.tasks;
    if (next === undefined) return current;
    current = next;
  }
  return current;
}

export function getMissingContextFields(context: Record<string, unknown>): string[] {
  return REQUIRED_CONTEXT_FIELDS.filter(({ key }) => !String(context[key] ?? "").trim()).map(
    ({ label }) => label
  );
}

export function countOutputItems(
  outputs: Partial<PipelineOutputs> | Record<string, unknown> | null | undefined,
  key: keyof PipelineOutputs | "handoff"
): number {
  if (!outputs || !isRecord(outputs)) return 0;
  const raw = unwrapOutput(outputs[key]);
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "string") return raw.trim() ? 1 : 0;
  if (isRecord(raw) && Object.keys(raw).length > 0) return 1;
  return 0;
}

function qualityScore(outputs: Partial<PipelineOutputs>, key: string): number | null {
  const quality = outputs[`${key}_quality` as keyof PipelineOutputs] as QualityGateResult | undefined;
  if (!quality || typeof quality.score !== "number" || Number.isNaN(quality.score)) return null;
  return quality.score;
}

function makeOutputAction(
  available: boolean,
  label: string,
  viewHref: string,
  runStep: PipelineStepId | "prd"
): SessionHomeAction {
  if (available) return { label: `View ${label}`, type: "link", href: viewHref };
  if (runStep === "prd") return { label: "Generate PRD", type: "link", href: "/prd" };
  if (runStep === "decompose") return { label: "Decompose Features", type: "run-step", step: runStep };
  return { label: `Generate ${label}`, type: "run-step", step: runStep };
}

function artifactName(summary: Pick<SessionHomeSummary, "recentOutputs" | "hasHandoff">): string | null {
  if (summary.hasHandoff) return "Agent Handoff";
  const last = [...summary.recentOutputs].reverse().find((row) => row.available);
  return last?.label ?? null;
}

export function getSessionHomeSummary({
  detail,
  context,
  researchCount,
  sourceCounts,
  hasHandoff,
}: {
  detail: SessionDetail | null;
  context: Record<string, unknown>;
  researchCount: number;
  sourceCounts: SourceReadinessCounts;
  hasHandoff: boolean;
}): SessionHomeSummary {
  const outputs = (detail?.state?.state?.outputs ?? {}) as Partial<PipelineOutputs>;
  const statuses = computeStepStatuses(detail);
  const completedSteps = PIPELINE_STEPS.filter((step) => statuses[step.id] === "completed").length;
  const missingContextFields = getMissingContextFields(context);
  const contextReady = missingContextFields.length === 0;

  const recentOutputs: RecentOutputRow[] = OUTPUT_ROWS.map((row) => {
    const count = countOutputItems(outputs, row.key);
    const available = count > 0;
    return {
      key: row.key,
      label: row.label,
      available,
      count,
      qualityScore: qualityScore(outputs, row.key),
      action: makeOutputAction(available, row.label, row.viewHref, row.runStep),
    };
  });

  recentOutputs.push({
    key: "handoff",
    label: "Agent Handoff",
    available: hasHandoff,
    count: hasHandoff ? 1 : 0,
    qualityScore: null,
    action: hasHandoff
      ? { label: "View Handoff", type: "view-handoff" }
      : { label: "Generate Handoff", type: "generate-handoff" },
  });

  const evidenceRows: EvidenceReadinessRow[] = [
    {
      label: "Context",
      value: contextReady ? "Ready" : `Missing ${missingContextFields.length}`,
      ready: contextReady,
    },
    {
      label: "Research entries",
      value: String(researchCount),
      ready: researchCount > 0,
    },
  ];

  if (sourceCounts.available) {
    evidenceRows.push(
      {
        label: "Source files",
        value: String(sourceCounts.sourceCount ?? 0),
        ready: (sourceCounts.sourceCount ?? 0) > 0,
      },
      {
        label: "Evidence objects",
        value: String(sourceCounts.evidenceCount ?? 0),
        ready: (sourceCounts.evidenceCount ?? 0) > 0,
      }
    );
  }

  const nextPending = PIPELINE_STEPS.find((step) => statuses[step.id] === "pending");
  const summary: SessionHomeSummary = {
    sessionName: detail?.session.session_name ?? "Untitled session",
    shortSessionId: detail?.session.id ? detail.session.id.slice(0, 8).toUpperCase() : "—",
    status: detail?.session.status ?? "active",
    createdAt: detail?.session.created_at ?? null,
    updatedAt: detail?.session.updated_at ?? null,
    missingContextFields,
    contextReady,
    researchCount,
    sourceCounts,
    completedSteps,
    totalSteps: PIPELINE_STEPS.length,
    nextRecommendedStep: nextPending?.label ?? (countOutputItems(outputs, "prd") > 0 ? "Handoff" : "PRD"),
    lastGeneratedArtifact: null,
    evidenceRows,
    recentOutputs,
    hasHandoff,
  };
  summary.lastGeneratedArtifact = artifactName(summary);
  return summary;
}

export function getNextRecommendedAction(summary: SessionHomeSummary): SessionHomeAction {
  if (!summary.contextReady) {
    return { label: "Complete Context", type: "link", href: "/context" };
  }

  const hasResearch = summary.researchCount > 0;
  const hasSourceEvidence = summary.sourceCounts.available && (summary.sourceCounts.evidenceCount ?? 0) > 0;
  if (!hasResearch && !hasSourceEvidence) {
    return { label: "Add Sources", type: "link", href: "/sources" };
  }

  const output = (key: RecentOutputRow["key"]) =>
    summary.recentOutputs.find((row) => row.key === key)?.available ?? false;

  if (!output("problems")) return { label: "Generate Problems", type: "run-step", step: "problems" };
  if (!output("features")) return { label: "Generate Features", type: "run-step", step: "features" };
  if (!output("decompositions")) return { label: "Decompose Features", type: "run-step", step: "decompose" };
  if (!output("tasks")) return { label: "Generate Tasks", type: "run-step", step: "tasks" };
  if (!output("prd")) return { label: "Generate PRD", type: "link", href: "/prd" };
  if (!summary.hasHandoff) return { label: "Generate Agent Handoff", type: "generate-handoff" };
  return { label: "View Handoff", type: "view-handoff" };
}
