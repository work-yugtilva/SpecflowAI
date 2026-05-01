"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { PipelineStepper } from "@/components/pipeline/PipelineStepper";
import { PipelineTrace } from "@/components/pipeline/PipelineTrace";
import { getSession } from "@/lib/api/session";
import type { SessionDetail } from "@/lib/api/session";
import { iterateSseJsonLines } from "@/lib/sse-parse";
import { useActiveSession } from "@/lib/active-session-context";
import { computeStepStatuses } from "@/lib/pipeline-session";
import type { LinearPayload } from "@/lib/pipeline-contracts";
import {
  fetchFeedback,
  createFeedback,
  deleteFeedback,
  DEFAULT_FEEDBACK_TYPE,
  FEEDBACK_TYPES,
  FEEDBACK_TYPES_PANEL_ORDER,
  type FeedbackEntry,
  type FeedbackType,
} from "@/lib/api/feedback";
import dynamic from "next/dynamic";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { EvidencePanel } from "@/components/pipeline/EvidencePanel";
import { resolveResearchEntries, type ResolvedEntry } from "@/lib/api/research";
import { ConversationPanel } from "@/components/ui/conversation-panel";
import { ArtifactExportMenu } from "@/components/artifacts/ArtifactExportMenu";
import { PRDExportButton } from "@/features/prd/PRDExportButton";
import { useSessionStore } from "@/lib/store/session-store";
import {
  prdToMarkdown,
  copyToClipboard,
  downloadTextFile,
  safeFilename,
} from "@/lib/artifact-export";
import type { ResearchEvidence } from "@/lib/pipeline-contracts";
import { posthog } from "@/lib/posthog";
const TextShimmer = dynamic(
  () => import("@/components/ui/text-shimmer").then((m) => m.TextShimmer)
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface QualityScore {
  score: number;
  critical_gaps: string[];
}

type PrdData = Record<string, unknown>;

interface GoalItem {
  goal?: string;
  metric?: string;
  target?: string;
  timeline?: string;
}

type CitationConfidence = "high" | "medium" | "insufficient";

interface FeatureItemData {
  title: string;
  source_ids?: string[];
  citation_confidence?: CitationConfidence;
  description?: string;
  linked_problem?: string;
  acceptance_criteria?: string;
}

interface RiskItem {
  likelihood?: string;
  risk?: string;
  mitigation?: string;
}

interface MetricItem {
  metric?: string;
  measurement?: string;
  baseline?: string | number | null;
  target?: string | number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : [];
}

const TRACE_OUTPUT_KEYS = [
  "problems",
  "features",
  "decompositions",
  "tasks",
] as const;

function isResearchEvidence(value: unknown): value is ResearchEvidence {
  if (!isRecord(value)) return false;
  return (
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    typeof value.source === "string"
  );
}

function collectResearchEvidence(value: unknown): ResearchEvidence[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectResearchEvidence(entry));
  }

  if (!isRecord(value)) return [];

  const direct = Array.isArray(value.research_evidence)
    ? value.research_evidence.filter(isResearchEvidence)
    : [];
  const nested = Object.entries(value)
    .filter(([key]) => key !== "research_evidence")
    .flatMap(([, entry]) => collectResearchEvidence(entry));

  return [...direct, ...nested];
}

function collectPrdResearchEvidence(outputs: unknown): ResearchEvidence[] {
  if (!isRecord(outputs)) return [];

  const seen = new Set<string>();
  const evidence: ResearchEvidence[] = [];

  for (const key of TRACE_OUTPUT_KEYS) {
    for (const item of collectResearchEvidence(outputs[key])) {
      const title = item.title.trim();
      const content = item.content.trim();
      const source = item.source.trim();
      if (!title && !content) continue;
      const dedupeKey = `${source}\u0000${title}\u0000${content}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      evidence.push({ title, content, source });
    }
  }

  return evidence;
}

function countUniqueEvidenceSources(evidence: ResearchEvidence[]): number {
  return evidence.length;
}

// ─── Section metadata ─────────────────────────────────────────────────────────

const PRD_SECTIONS: { key: string; title: string }[] = [
  { key: "executive_summary", title: "Executive Summary" },
  { key: "problem_statement", title: "Problem Statement" },
  { key: "goals", title: "Goals" },
  { key: "features", title: "Features" },
  { key: "architecture", title: "Architecture" },
  { key: "implementation_plan", title: "Implementation Plan" },
  { key: "risks", title: "Risks" },
  { key: "success_metrics", title: "Success Metrics" },
];

// ─── Section visibility per view mode ────────────────────────────────────────

const SECTION_VISIBILITY: Record<"full" | "engineering" | "executive", string[]> = {
  full: ["executive_summary", "problem_statement", "goals", "features", "architecture", "implementation_plan", "risks", "success_metrics"],
  engineering: ["features", "architecture", "implementation_plan"],
  executive: ["executive_summary", "problem_statement", "goals", "risks", "success_metrics"],
};

// ─── View mode metadata ───────────────────────────────────────────────────────

const VIEW_MODE_META: Record<"full" | "engineering" | "executive", { label: string; description: string; audience: string | null }> = {
  full: {
    label: "Full PRD",
    description: "Complete spec — all sections visible",
    audience: null,
  },
  engineering: {
    label: "Engineering View",
    description: "Architecture, implementation plan, and feature specs only",
    audience: "For your engineering team",
  },
  executive: {
    label: "Executive View",
    description: "Summary, goals, risks, and success metrics only",
    audience: "For stakeholders and leadership",
  },
};

// ─── Quality badge color ──────────────────────────────────────────────────────

function qualityColor(score: number): { bg: string; color: string } {
  if (score >= 80) return { bg: "rgba(232,86,27,0.12)", color: "#E8561B" };
  if (score >= 60) return { bg: "rgba(245,158,11,0.12)", color: "#D97706" };
  return { bg: "rgba(239,68,68,0.12)", color: "#DC2626" };
}

// ─── Specialized section renderers ────────────────────────────────────────────

function GoalsRenderer({ items }: { items: unknown[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => {
        const goalItem = isRecord(item) ? (item as GoalItem) : {};
        return (
          <div key={i} style={{ background: "#F8F4EF", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontWeight: 600, color: "#0D0D0D", fontSize: 13, marginBottom: 6 }}>{goalItem.goal}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 12, color: "#6B6B6B" }}>
              {goalItem.metric && <span><strong>Metric:</strong> {goalItem.metric}</span>}
              {goalItem.target && <span><strong>Target:</strong> {goalItem.target}</span>}
              {goalItem.timeline && <span><strong>Timeline:</strong> {goalItem.timeline}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PRD_TYPE_COLORS: Record<string, string> = {
  Interview: "#3D6B5E",
  Survey: "#1D4ED8",
  Analytics: "#7C3AED",
  "Market Insight": "#C2410C",
};

function PrdTypeBadge({ type }: { type: string }) {
  const color = PRD_TYPE_COLORS[type] ?? "#6B6B6B";
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
      textTransform: "uppercase" as const,
      color, background: `${color}18`, border: `1px solid ${color}40`,
      borderRadius: 3, padding: "1px 5px", flexShrink: 0,
    }}>
      {type}
    </span>
  );
}

function InlineEvidenceSummary({ sourceIds }: { sourceIds: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<ResolvedEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (!sourceIds.length) return null;

  async function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && entries === null) {
      setLoading(true);
      const result = await resolveResearchEntries(sourceIds);
      setEntries(result);
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={handleToggle}
        style={{
          background: "none", border: "none", padding: 0,
          cursor: "pointer", fontSize: 11, color: "#E8561B",
          display: "flex", alignItems: "center", gap: 4,
          fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
        }}
      >
        <span>{sourceIds.length} source{sourceIds.length !== 1 ? "s" : ""}</span>
        <span style={{
          display: "inline-block",
          transition: "transform 0.15s",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          lineHeight: 1,
        }}>▾</span>
      </button>
      {expanded && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {loading ? (
            <div style={{ fontSize: 11, color: "#9E9E9E", fontStyle: "italic" }}>Loading sources…</div>
          ) : (entries ?? []).length === 0 ? (
            <div style={{ fontSize: 11, color: "#9E9E9E", fontStyle: "italic" }}>No source details available.</div>
          ) : (entries ?? []).map((entry) => (
            <div key={entry.id} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12, flexWrap: "wrap" as const }}>
              <PrdTypeBadge type={entry.type} />
              <span style={{ color: "#0D0D0D", fontWeight: 500 }}>{entry.title}</span>
              {entry.content && (
                <span style={{ color: "#9E9E9E" }}>
                  — {entry.content.slice(0, 80)}{entry.content.length > 80 ? "…" : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeatureItem({
  item,
  feedback,
  sessionId,
  onAddFeedback,
}: {
  item: FeatureItemData;
  feedback?: FeedbackEntry[];
  sessionId?: string | null;
  onAddFeedback?: (entry: FeedbackEntry) => void;
}) {
  const [hovering, setHovering] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<FeedbackType>(DEFAULT_FEEDBACK_TYPE);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existingFeedback = feedback?.find((f) => f.prd_item_title === item.title);
  const sourceIds = Array.isArray(item.source_ids) ? item.source_ids : [];
  const confidence = item.citation_confidence as "high" | "medium" | "insufficient" | undefined;
  const isNoSource = confidence === "insufficient" || (sourceIds.length === 0 && confidence === undefined);

  const feedbackColors: Record<string, { bg: string; text: string }> = {
    validated: { bg: "rgba(61,107,94,0.10)", text: "#3D6B5E" },
    invalidated: { bg: "rgba(220,38,38,0.10)", text: "#DC2626" },
    partial: { bg: "rgba(217,119,6,0.10)", text: "#D97706" },
    deferred: { bg: "rgba(107,107,107,0.10)", text: "#6B6B6B" },
  };

  async function handleSubmit() {
    if (!sessionId || !onAddFeedback) return;
    setSubmitting(true);
    try {
      const entry = await createFeedback(sessionId, {
        prd_section: "features",
        prd_item_title: item.title,
        feedback_type: type,
        outcome_note: note,
        linked_problem_ids: [],
        linked_research_ids: [],
      });
      onAddFeedback(entry);
      setShowForm(false);
      setNote("");
    } catch (err) {
      console.error("Failed to submit feedback", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{ borderLeft: "2px solid #E4DDD4", paddingLeft: 12, position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 600, color: "#0D0D0D", fontSize: 13 }}>{item.title}</div>
          
        </div>
        
        {existingFeedback ? (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
            background: feedbackColors[existingFeedback.feedback_type].bg,
            color: feedbackColors[existingFeedback.feedback_type].text,
            textTransform: "capitalize"
          }}>
            {existingFeedback.feedback_type}
          </span>
        ) : !showForm ? (
          <button
            onClick={() => setShowForm(true)}
            style={{
              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
              background: "rgba(232,86,27,0.08)", color: "#E8561B",
              border: "1px solid rgba(232,86,27,0.18)", cursor: "pointer",
              opacity: hovering ? 1 : 0, pointerEvents: hovering ? "auto" : "none",
              transition: "opacity 0.15s",
            }}
          >
            Log Outcome
          </button>
        ) : null}
      </div>

      {item.description && <div style={{ fontSize: 13, color: "#6B6B6B", marginTop: 4 }}>{item.description}</div>}
      
      {item.linked_problem && (
        <div style={{ fontSize: 11, color: "#E8561B", marginTop: 4 }}>Solves: {item.linked_problem}</div>
      )}
      
      {item.acceptance_criteria && (
        <div style={{
          marginTop: 8, background: "#F3F4F6", borderRadius: 6,
          padding: "8px 10px", fontSize: 12, color: "#374151",
          fontFamily: "var(--font-mono, 'Courier New', monospace)",
          whiteSpace: "pre-wrap",
        }}>
          {item.acceptance_criteria}
        </div>
      )}
      
      {isNoSource && (
        <div style={{ fontSize: 11, color: "#D97706", marginTop: 6 }}>
          ⚠ This claim could not be traced to a source. Verify before shipping.
        </div>
      )}

      {sourceIds.length > 0 && (
        <InlineEvidenceSummary sourceIds={sourceIds} />
      )}

      {showForm && (
        <div style={{
          marginTop: 12, background: "#F8F4EF", borderRadius: 8, padding: 12,
          border: "1px solid #E4DDD4"
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {FEEDBACK_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 20,
                  background: type === t ? feedbackColors[t].text : "#FFFFFF",
                  color: type === t ? "#FFFFFF" : "#6B6B6B",
                  border: `1px solid ${type === t ? feedbackColors[t].text : "#E4DDD4"}`,
                  cursor: "pointer", textTransform: "capitalize",
                  transition: "all 0.15s"
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you learn?"
            rows={2}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 6,
              border: "1px solid #E4DDD4", fontSize: 12, color: "#0D0D0D",
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              resize: "none", outline: "none", marginBottom: 8,
              boxSizing: "border-box"
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              onClick={() => setShowForm(false)}
              style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 6,
                background: "none", border: "none", color: "#6B6B6B",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
                background: "#0D0D0D", color: "#FFFFFF", border: "none",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.6 : 1
              }}
            >
              {submitting ? "Saving..." : "Save Outcome"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeaturesRenderer({
  items,
  feedback,
  sessionId,
  onAddFeedback,
}: {
  items: unknown[];
  feedback?: FeedbackEntry[];
  sessionId?: string | null;
  onAddFeedback?: (entry: FeedbackEntry) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item, i) => {
        const featureItem = isRecord(item) ? (item as unknown as FeatureItemData) : { title: "" };
        return (
          <FeatureItem
            key={i}
            item={featureItem}
            feedback={feedback}
            sessionId={sessionId}
            onAddFeedback={onAddFeedback}
          />
        );
      })}
    </div>
  );
}

const LIKELIHOOD_STYLE: Record<string, { bg: string; color: string }> = {
  high:   { bg: "#FEF2F2", color: "#EF4444" },
  medium: { bg: "#FFF7ED", color: "#F59E0B" },
  low:    { bg: "#F0FDF4", color: "#22C55E" },
};

function RisksRenderer({ items }: { items: unknown[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => {
        const riskItem = isRecord(item) ? (item as RiskItem) : {};
        const likelihood = typeof riskItem.likelihood === "string" ? riskItem.likelihood : "medium";
        const lk = likelihood.toLowerCase();
        const style = LIKELIHOOD_STYLE[lk] ?? LIKELIHOOD_STYLE.medium;
        return (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, flexShrink: 0,
              background: style.bg, color: style.color, textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              {likelihood}
            </span>
            <div>
              <div style={{ fontSize: 13, color: "#0D0D0D", fontWeight: 500 }}>{riskItem.risk}</div>
              {riskItem.mitigation && <div style={{ fontSize: 12, color: "#6B6B6B", marginTop: 3 }}>↳ {riskItem.mitigation}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricsRenderer({ items }: { items: unknown[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => {
        const metricItem = isRecord(item) ? (item as MetricItem) : {};
        return (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8,
            background: "#F8F4EF", borderRadius: 8, padding: "10px 12px", fontSize: 12,
          }}>
            <div>
              <div style={{ fontWeight: 600, color: "#0D0D0D", fontSize: 13 }}>{metricItem.metric}</div>
              {metricItem.measurement && <div style={{ color: "#9E9E9E", marginTop: 2 }}>{metricItem.measurement}</div>}
            </div>
            <div style={{ color: "#6B6B6B" }}>
              <div style={{ fontWeight: 500 }}>Baseline</div>
              <div>{metricItem.baseline ?? "—"}</div>
            </div>
            <div style={{ color: "#E8561B" }}>
              <div style={{ fontWeight: 500 }}>Target</div>
              <div>{metricItem.target ?? "—"}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArchitectureRenderer({ arch }: { arch: Record<string, string> }) {
  const layers = [
    { key: "frontend", label: "Frontend" },
    { key: "backend",  label: "Backend" },
    { key: "data",     label: "Data" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {layers.map(({ key, label }) => arch[key] ? (
        <div key={key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: "#F3F4F6", color: "#6B6B6B", textTransform: "uppercase",
            letterSpacing: "0.06em", flexShrink: 0, minWidth: 64, textAlign: "center",
          }}>
            {label}
          </span>
          <span style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.6 }}>{arch[key]}</span>
        </div>
      ) : null)}
    </div>
  );
}

// ─── TipTap inline string editor ─────────────────────────────────────────────

function TipTapStringEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const lines = (value ?? "").split("\n").filter((l) => l.length > 0);
  const initialContent = {
    type: "doc",
    content:
      lines.length > 0
        ? lines.map((line) => ({
            type: "paragraph",
            content: [{ type: "text", text: line }],
          }))
        : [{ type: "paragraph", content: [] }],
  };

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getText({ blockSeparator: "\n" }));
    },
  });

  return (
    <div className="tiptap-wrapper">
      <EditorContent editor={editor} />
    </div>
  );
}

// ─── Section card renderer ────────────────────────────────────────────────────

function SectionCard({
  title, value, sectionKey, editing, onEditStart, onEditEnd, onUpdate, onScheduleSave,
  onAiEdit, aiEditing, aiEdited, citations, citationCount,
  feedback, sessionId, onAddFeedback,
}: {
  title: string; value: unknown; sectionKey: string;
  editing: boolean;
  onEditStart: () => void; onEditEnd: () => void;
  onUpdate: (v: unknown) => void;
  onScheduleSave?: (v: unknown) => void;
  onAiEdit: (instruction: string) => Promise<void>;
  aiEditing: boolean;
  aiEdited: boolean;
  citations?: Record<string, string[]> | null;
  citationCount?: number;
  feedback?: FeedbackEntry[];
  sessionId?: string | null;
  onAddFeedback?: (entry: FeedbackEntry) => void;
}) {
  const [hovering, setHovering] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  async function handleAiSubmit() {
    const trimmed = aiInstruction.trim();
    if (!trimmed) return;
    setAiError(null);
    try {
      await onAiEdit(trimmed);
      setShowAiInput(false);
      setAiInstruction("");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI edit failed");
    }
  }

  const editTextareaStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1.5px solid #E8561B", fontSize: 13, color: "#0D0D0D", lineHeight: 1.7,
    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
    resize: "vertical" as const, outline: "none", background: "#FDFAF7",
    boxSizing: "border-box",
  };
  const editMonoStyle: React.CSSProperties = {
    ...editTextareaStyle,
    fontSize: 12, lineHeight: 1.6,
    fontFamily: "var(--font-mono, 'Courier New', monospace)",
    minHeight: 200,
  };

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        position: "relative",
        background: "#FFFFFF",
        border: `1px solid ${aiEditing ? "rgba(232,86,27,0.3)" : "#E4DDD4"}`,
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 12,
        transition: "border-color 0.2s",
      }}
    >
      {/* Shimmer overlay while AI is rewriting */}
      {aiEditing && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 12, pointerEvents: "none", zIndex: 1,
          background: "linear-gradient(90deg, transparent 0%, rgba(232,86,27,0.06) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "prd-shimmer 1.4s ease-in-out infinite",
        }} />
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        {/* Title + AI edited badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3
            style={{
              fontFamily: "var(--font-instrument), Georgia, serif",
              fontSize: 16,
              fontWeight: 600,
              color: "#0D0D0D",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h3>
          {aiEdited && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 20,
              background: "rgba(232,86,27,0.10)", color: "#E8561B", letterSpacing: "0.04em",
            }}>
              AI edited
            </span>
          )}
          {citationCount != null && citationCount > 0 ? (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
              background: "rgba(61,107,94,0.10)", color: "#3D6B5E",
            }}>
              {citationCount} sourced
            </span>
          ) : citationCount === 0 && sectionKey === "features" ? (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
              background: "rgba(245,158,11,0.10)", color: "#D97706",
            }}>
              Unverified
            </span>
          ) : null}
        </div>
        {/* Right-side controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* AI edit pill / input */}
          {showAiInput ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <input
                ref={aiInputRef}
                value={aiInstruction}
                onChange={e => setAiInstruction(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); handleAiSubmit(); }
                  if (e.key === "Escape") { setShowAiInput(false); setAiInstruction(""); setAiError(null); }
                }}
                disabled={aiEditing}
                placeholder="Edit this section..."
                autoFocus
                style={{
                  fontSize: 12, padding: "4px 11px", borderRadius: 20, width: 210,
                  border: "1px solid rgba(232,86,27,0.35)", outline: "none",
                  background: "#FDFAF7", color: "#0D0D0D",
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  opacity: aiEditing ? 0.6 : 1,
                }}
              />
              <button
                onClick={handleAiSubmit}
                disabled={aiEditing || !aiInstruction.trim()}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
                  background: "#E8561B", color: "#FFFFFF", border: "none",
                  cursor: aiEditing || !aiInstruction.trim() ? "not-allowed" : "pointer",
                  opacity: aiEditing || !aiInstruction.trim() ? 0.5 : 1,
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                }}
              >
                {aiEditing ? "…" : "Apply"}
              </button>
              <button
                onClick={() => { setShowAiInput(false); setAiInstruction(""); setAiError(null); }}
                disabled={aiEditing}
                style={{
                  fontSize: 11, padding: "4px 7px", borderRadius: 20,
                  background: "none", border: "1px solid #E4DDD4", color: "#9E9E9E",
                  cursor: "pointer", lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setShowAiInput(true); }}
              style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                background: "rgba(232,86,27,0.08)", color: "#E8561B",
                border: "1px solid rgba(232,86,27,0.18)", cursor: "pointer",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                opacity: hovering ? 1 : 0,
                pointerEvents: hovering ? "auto" : "none",
                transition: "opacity 0.15s",
              }}
            >
              ✦ AI Edit
            </button>
          )}
          {typeof value !== "string" && (
            <button
              onClick={() => editing ? onEditEnd() : onEditStart()}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "2px 8px",
                borderRadius: 6, fontSize: 11, fontWeight: 500,
                color: editing ? "#E8561B" : "#9E9E9E",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              }}
            >
              {editing ? "Done" : "Edit"}
            </button>
          )}
        </div>
      </div>
      {/* Inline AI error */}
      {aiError && (
        <div style={{ fontSize: 11, color: "#DC2626", marginBottom: 8, paddingLeft: 2 }}>
          {aiError}
        </div>
      )}
      <div
        style={{
          fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
          fontSize: 14,
          color: "#6B6B6B",
          lineHeight: 1.7,
          opacity: aiEditing ? 0.35 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {typeof value === "string" ? (
          <TipTapStringEditor
            key={sectionKey}
            value={value}
            onChange={(newVal) => {
              onUpdate(newVal);
              onScheduleSave?.(newVal);
            }}
          />
        ) : editing && Array.isArray(value) ? (
          <textarea
            defaultValue={JSON.stringify(value, null, 2)}
            autoFocus
            onBlur={e => {
              try { onUpdate(JSON.parse(e.target.value)); onEditEnd(); } catch {}
            }}
            style={editMonoStyle}
          />
        ) : editing && typeof value === "object" && !Array.isArray(value) ? (
          <textarea
            defaultValue={JSON.stringify(value, null, 2)}
            autoFocus
            onBlur={e => {
              try { onUpdate(JSON.parse(e.target.value)); onEditEnd(); } catch {}
            }}
            style={{ ...editMonoStyle, minHeight: 120 }}
          />
        ) : sectionKey === "goals" && Array.isArray(value) ? <GoalsRenderer items={value} /> :
           sectionKey === "features" && Array.isArray(value) ? <FeaturesRenderer items={value} feedback={feedback} sessionId={sessionId} onAddFeedback={onAddFeedback} /> :
           sectionKey === "risks" && Array.isArray(value) ? <RisksRenderer items={value} /> :
           sectionKey === "success_metrics" && Array.isArray(value) ? <MetricsRenderer items={value} /> :
           sectionKey === "architecture" && typeof value === "object" && !Array.isArray(value) ? <ArchitectureRenderer arch={value as Record<string, string>} /> :
           renderValue(value)}
      </div>
    </div>
  );
}

function renderValue(val: unknown): React.ReactNode {
  if (val == null) return <span style={{ color: "#9E9E9E" }}>—</span>;
  if (typeof val === "string") return <p style={{ margin: 0 }}>{val}</p>;
  if (Array.isArray(val)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {val.map((item, i) => {
          if (typeof item !== "object" || item === null) {
            return <div key={i} style={{ fontSize: 14, color: "#6B6B6B" }}>{String(item)}</div>;
          }
          const obj = item as Record<string, unknown>;

          // Implementation plan phase card
          if (obj.phase || obj.deliverables) {
            const deliverables = Array.isArray(obj.deliverables) ? obj.deliverables : [];
            return (
              <div key={i} style={{ background: "#F8F4EF", borderRadius: 10, padding: "14px 16px", border: "1px solid #E4DDD4" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0D0D0D" }}>
                    {String(obj.phase ?? "")}
                  </span>
                  {obj.duration != null && (
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: "rgba(232,86,27,0.10)", color: "#E8561B" }}>
                      {String(obj.duration)}
                    </span>
                  )}
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                  {deliverables.map((d, di) => (
                    <li key={di} style={{ fontSize: 13, color: "#3D3D3D", lineHeight: 1.6 }}>{String(d)}</li>
                  ))}
                </ul>
              </div>
            );
          }

          // Goals card
          if (obj.goal || (obj.metric && !obj.baseline)) {
            return (
              <div key={i} style={{ background: "#FFFFFF", borderRadius: 10, padding: "14px 16px", border: "1px solid #E4DDD4" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0D0D0D", marginBottom: 8 }}>
                  {String(obj.goal ?? obj.title ?? "")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {obj.metric != null && (
                    <div>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "#9E9E9E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Metric</span>
                      <p style={{ fontSize: 12.5, color: "#3D3D3D", margin: "3px 0 0" }}>{String(obj.metric)}</p>
                    </div>
                  )}
                  {obj.target != null && (
                    <div>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "#9E9E9E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Target</span>
                      <p style={{ fontSize: 12.5, color: "#E8561B", fontWeight: 500, margin: "3px 0 0" }}>{String(obj.target)}</p>
                    </div>
                  )}
                  {obj.timeline != null && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "#9E9E9E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Timeline</span>
                      <p style={{ fontSize: 12.5, color: "#6B6B6B", margin: "3px 0 0" }}>{String(obj.timeline)}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Risks card
          if (obj.risk || obj.likelihood) {
            const likelihood = String(obj.likelihood ?? "medium").toLowerCase();
            const likelihoodColor = likelihood === "high" ? "#DC2626" : likelihood === "low" ? "#15803D" : "#D97706";
            const likelihoodBg = likelihood === "high" ? "rgba(239,68,68,0.10)" : likelihood === "low" ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.10)";
            return (
              <div key={i} style={{ background: "#FFFFFF", borderRadius: 10, padding: "14px 16px", border: "1px solid #E4DDD4" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: likelihoodBg, color: likelihoodColor, textTransform: "uppercase" as const, letterSpacing: "0.05em", flexShrink: 0, marginTop: 1 }}>
                    {String(obj.likelihood ?? "medium")}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0D0D0D", lineHeight: 1.4 }}>{String(obj.risk ?? "")}</span>
                </div>
                {obj.mitigation != null && (
                  <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.6, margin: 0, paddingLeft: 4, borderLeft: "2px solid #E4DDD4" }}>
                    ↳ {String(obj.mitigation)}
                  </p>
                )}
              </div>
            );
          }

          // Success metrics card
          if (obj.metric && (obj.baseline || obj.target)) {
            return (
              <div key={i} style={{ background: "#FFFFFF", borderRadius: 10, padding: "14px 16px", border: "1px solid #E4DDD4" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0D0D0D", marginBottom: 8 }}>{String(obj.metric)}</div>
                {obj.measurement != null && <p style={{ fontSize: 12.5, color: "#6B6B6B", margin: "0 0 10px", lineHeight: 1.5 }}>{String(obj.measurement)}</p>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {obj.baseline != null && (
                    <div style={{ background: "#F8F4EF", borderRadius: 8, padding: "10px 12px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Baseline</span>
                      <p style={{ fontSize: 12.5, color: "#3D3D3D", margin: "4px 0 0", lineHeight: 1.5 }}>{String(obj.baseline)}</p>
                    </div>
                  )}
                  {obj.target != null && (
                    <div style={{ background: "rgba(232,86,27,0.06)", borderRadius: 8, padding: "10px 12px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#E8561B", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Target</span>
                      <p style={{ fontSize: 12.5, color: "#E8561B", fontWeight: 600, margin: "4px 0 0", lineHeight: 1.5 }}>{String(obj.target)}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Features card
          if (obj.title && (obj.description || obj.acceptance_criteria)) {
            return (
              <div key={i} style={{ background: "#FFFFFF", borderRadius: 10, padding: "14px 16px", border: "1px solid #E4DDD4" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0D0D0D", marginBottom: 6 }}>{String(obj.title)}</div>
                {obj.linked_problem != null && (
                  <span style={{ fontSize: 11, color: "#E8561B", fontWeight: 500, display: "block", marginBottom: 8 }}>
                    Solves: {String(obj.linked_problem)}
                  </span>
                )}
                {obj.description != null && <p style={{ fontSize: 13, color: "#3D3D3D", lineHeight: 1.6, margin: "0 0 10px" }}>{String(obj.description)}</p>}
                {obj.acceptance_criteria != null && (
                  <pre style={{ margin: 0, padding: "10px 12px", background: "#F8F4EF", borderRadius: 8, fontSize: 12, color: "#3D3D3D", whiteSpace: "pre-wrap", lineHeight: 1.6, fontFamily: "monospace", border: "1px solid #E4DDD4" }}>
                    {String(obj.acceptance_criteria)}
                  </pre>
                )}
              </div>
            );
          }

          // Generic fallback
          return (
            <div key={i} style={{ fontSize: 14, color: "#3D3D3D", lineHeight: 1.7 }}>
              {(obj.title != null || obj.name != null) ? (
                <><strong>{String(obj.title ?? obj.name)}</strong>{obj.description != null ? `: ${String(obj.description)}` : ""}</>
              ) : (
                <span>{JSON.stringify(obj)}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const archKeys = ["frontend", "backend", "data"];
    const isArchitecture = archKeys.some(k => k in obj);
    if (isArchitecture) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {archKeys.filter(k => obj[k]).map(k => (
            <div key={k} style={{ background: "#F8F4EF", borderRadius: 10, padding: "14px 16px", border: "1px solid #E4DDD4" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#9E9E9E", textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>{k}</span>
              <p style={{ fontSize: 13, color: "#3D3D3D", lineHeight: 1.7, margin: 0 }}>{String(obj[k])}</p>
            </div>
          ))}
        </div>
      );
    }
    return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13 }}>{JSON.stringify(val, null, 2)}</pre>;
  }
  return String(val);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PrdPage() {
  const { activeSessionId } = useActiveSession();
  const setActiveSessionDetail = useSessionStore((s) => s.setActiveSessionDetail);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [prd, setPrd] = useState<PrdData | null>(null);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fromSession, setFromSession] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [showConfirmRegenerate, setShowConfirmRegenerate] = useState(false);
  const [linearPayload, setLinearPayload] = useState<LinearPayload | null>(null);
  const [linearPushing, setLinearPushing] = useState(false);
  const [linearPushStatus, setLinearPushStatus] = useState<"success" | "error" | null>(null);
  const [linearPushError, setLinearPushError] = useState<string | null>(null);
  const [linearNotConnected, setLinearNotConnected] = useState(false);
  const urlView = searchParams.get("view");
  const [viewMode, setViewMode] = useState<"full" | "engineering" | "executive">(
    urlView === "engineering" || urlView === "executive" ? urlView : "full"
  );
  const [copied, setCopied] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [aiEditingKey, setAiEditingKey] = useState<string | null>(null);
  const [aiEditedSections, setAiEditedSections] = useState<Set<string>>(new Set());
  const [citations, setCitations] = useState<Record<string, string[]> | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackLoadError, setFeedbackLoadError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [interruptedJobId, setInterruptedJobId] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  const stepStatuses = computeStepStatuses(sessionDetail);
  const regenCount = sessionDetail?.state?.state?.regeneration_counts?.["prd"] ?? 0;
  const regenLimitReached = regenCount >= 3;
  const regenLeft = Math.max(0, 3 - regenCount);
  const prdSourceEvidence = useMemo(
    () => collectPrdResearchEvidence(sessionDetail?.state?.state?.outputs),
    [sessionDetail]
  );
  const prdSourceDocumentCount = useMemo(
    () => countUniqueEvidenceSources(prdSourceEvidence),
    [prdSourceEvidence]
  );

  // ── Load existing PRD from memory_entries on mount ──
  useEffect(() => {
    posthog.capture("prd_viewed");
  }, []);

  useEffect(() => {
    setPrd(null);
    setQualityScore(null);
    setError(null);
    setFromSession(false);
    setSessionDetail(null);
    setLinearPayload(null);
    setLinearPushStatus(null);
    setLinearPushError(null);
    setLinearNotConnected(false);
    setFeedback([]);
    setFeedbackLoadError(null);
    setActiveSessionDetail(null);
    if (!activeSessionId) return;
    let cancelled = false;

    // Load feedback
    setFeedbackLoading(true);
    fetchFeedback(activeSessionId)
      .then((data) => {
        if (!cancelled) {
          setFeedbackLoadError(null);
          setFeedback(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load feedback:", err);
        if (!cancelled) {
          setFeedbackLoadError(err instanceof Error ? err.message : "Failed to load outcomes");
        }
      })
      .finally(() => {
        if (!cancelled) setFeedbackLoading(false);
      });

    // Load session detail for stepper + linear_payload
    getSession(activeSessionId)
      .then((d) => {
        if (!cancelled) {
          setSessionDetail(d);
          setActiveSessionDetail(d);
          const lp = d?.state?.state?.outputs?.linear_payload as LinearPayload | undefined;
          if (lp) setLinearPayload(lp);
        }
      })
      .catch(() => {
        if (!cancelled) setActiveSessionDetail(null);
      });

    // Load PRD from memory_entries (separate from session state)
    fetch(`/api/sessions/${activeSessionId}/prd`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) return; // 404 = no PRD yet, silently ignore
        const data = await res.json();
        if (cancelled) return;
        if (data.prd) {
          setPrd(data.prd as PrdData);
          setFromSession(true);
          if (data.quality_score) setQualityScore(data.quality_score);
          if (data.citations?.citations) setCitations(data.citations.citations);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [activeSessionId, setActiveSessionDetail]);

  // Sync viewMode to URL without navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (viewMode === "full") params.delete("view");
    else params.set("view", viewMode);
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateSection(key: string, value: unknown) {
    setPrd(prev => prev ? { ...prev, [key]: value } : prev);
  }

  function scheduleSave(updatedPrd: PrdData) {
    if (!activeSessionId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/pipeline/autosave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: activeSessionId,
            output_key: "prd",
            updated_content: updatedPrd,
          }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, 1000);
  }

  // ── Generate PRD ──
  async function handleGenerate(resumeJobId?: string) {
    if (!activeSessionId || generating) return;
    setGenerating(true);
    setError(null);
    setInterruptedJobId(null);
    setPrd(null);
    setQualityScore(null);
    setLoadingPhase("Loading context...");

    // Track job_id received from first SSE event so we can resume on disconnect
    let currentJobId: string | null = null;

    try {
      const streamUrl = resumeJobId
        ? `/api/sessions/${activeSessionId}/prd/stream?job_id=${encodeURIComponent(resumeJobId)}`
        : `/api/sessions/${activeSessionId}/prd/stream`;

      const res = await fetch(streamUrl, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail ?? body.error ?? "Generation failed");
        return;
      }

      let sawComplete = false;
      let streamReportedError = false;
      try {
        for await (const raw of iterateSseJsonLines<Record<string, unknown>>(res.body)) {
          const t = raw.type;
          if (t === "job_created" && typeof raw.job_id === "string") {
            currentJobId = raw.job_id;
          } else if (t === "phase" && typeof raw.phase === "string") {
            setLoadingPhase(raw.phase);
          } else if (t === "complete") {
            sawComplete = true;
            setPrd((raw.prd as PrdData | undefined) ?? null);
            if (raw.quality_score) setQualityScore(raw.quality_score as QualityScore);
            const cits = raw.citations as { citations?: unknown } | undefined;
            if (cits?.citations) setCitations(cits.citations as Record<string, string[]>);
            setFromSession(true);
            try {
              const d = await getSession(activeSessionId);
              setSessionDetail(d);
              setActiveSessionDetail(d);
            } catch {
              /* session refresh best-effort */
            }
          } else if (t === "error" && typeof raw.message === "string") {
            streamReportedError = true;
            setError(raw.message);
          }
        }
      } catch (streamErr) {
        const m =
          streamErr instanceof Error ? streamErr.message : String(streamErr);
        if (
          /failed to fetch|load failed|network.?error|econnrefused|socket|fetch/i.test(
            m
          )
        ) {
          setError(
            "Failed to reach the pipeline. Start the FastAPI service (port 8001), e.g. `npm run dev:pipeline` from backend/, or run `npm run dev` from the repo root."
          );
        } else {
          setError(m || "PRD stream failed.");
        }
        // On network disconnect: if we have a job_id, offer resume
        if (currentJobId && !sawComplete) {
          setInterruptedJobId(currentJobId);
          setError("Generation interrupted — the connection was lost.");
        }
        return;
      }

      if (!sawComplete && !streamReportedError) {
        if (currentJobId) {
          setInterruptedJobId(currentJobId);
          setError("Generation interrupted — the connection was lost.");
        } else {
          setError(
            "PRD stream ended before completion. If the pipeline was restarted, try Generate again."
          );
        }
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (/failed to fetch|load failed|network.?error/i.test(m)) {
        setError(
          "Failed to reach the app or pipeline. Ensure Next.js is running and the FastAPI pipeline is up on port 8001."
        );
      } else {
        setError(m || "Failed to generate PRD.");
      }
    } finally {
      setGenerating(false);
      setLoadingPhase("");
    }
  }

  // ── Resume interrupted PRD generation ──
  async function handleResume() {
    if (!activeSessionId || !interruptedJobId || resuming) return;
    setResuming(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sessions/${activeSessionId}/job/${interruptedJobId}/status`,
        { credentials: "same-origin" }
      );
      if (!res.ok) {
        setError("Could not check job status. Try generating again.");
        setInterruptedJobId(null);
        return;
      }
      const job = await res.json() as { status: string; error?: string };

      if (job.status === "completed") {
        // Fetch the stored PRD from memory_entries
        const prdRes = await fetch(`/api/sessions/${activeSessionId}/prd`, {
          credentials: "same-origin",
        });
        if (prdRes.ok) {
          const prdData = await prdRes.json() as {
            prd?: PrdData;
            quality_score?: QualityScore;
            citations?: Record<string, string[]>;
          };
          setPrd(prdData.prd ?? null);
          if (prdData.quality_score) setQualityScore(prdData.quality_score);
          if (prdData.citations) setCitations(prdData.citations);
          setFromSession(true);
          setError(null);
          setInterruptedJobId(null);
          try {
            const d = await getSession(activeSessionId);
            setSessionDetail(d);
            setActiveSessionDetail(d);
          } catch {
            /* best-effort */
          }
        } else {
          setError("Could not load the completed PRD. Try refreshing.");
          setInterruptedJobId(null);
        }
      } else if (job.status === "failed") {
        setError(job.error ?? "Generation failed on the server.");
        setInterruptedJobId(null);
      } else {
        // running — reconnect SSE stream with the same job_id
        setInterruptedJobId(null);
        setResuming(false);
        await handleGenerate(interruptedJobId);
        return;
      }
    } catch {
      setError("Could not check job status. Try generating again.");
      setInterruptedJobId(null);
    } finally {
      setResuming(false);
    }
  }

  // ── Push to Linear ──
  async function handlePushToLinear() {
    if (!linearPayload || linearPushing) return;
    setLinearPushing(true);
    setLinearPushStatus(null);
    setLinearPushError(null);
    setLinearNotConnected(false);
    try {
      const res = await fetch("/api/linear/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linear_payload: linearPayload }),
      });
      if (!res.ok) {
        const body = await res.json();
        if (res.status === 401 && body.code === "linear_not_connected") {
          setLinearNotConnected(true);
          return;
        }
        setLinearPushError(body.error ?? res.statusText);
        setLinearPushStatus("error");
        return;
      }
      setLinearPushStatus("success");
    } catch (err) {
      setLinearPushError(err instanceof Error ? err.message : "Connection failed");
      setLinearPushStatus("error");
    } finally {
      setLinearPushing(false);
    }
  }

  // ── Citation count helper ──
  function getSectionCitationCount(sectionKey: string, prdData: PrdData, cits: Record<string, string[]> | null): number {
    if (cits === null) return 0;
    if (sectionKey !== "features") return 0;
    const features = prdData.features;
    if (!Array.isArray(features)) return 0;
    return features.filter((item, idx) => {
      const featureItem = isRecord(item) ? (item as { source_ids?: unknown }) : {};
      const fromItem = getStringArray(featureItem.source_ids).length > 0;
      const fromMap = Array.isArray(cits[String(idx)]) && (cits[String(idx)] as string[]).length > 0;
      return fromItem || fromMap;
    }).length;
  }

  // ── AI inline edit ──
  async function handleAiEdit(key: string, instruction: string): Promise<void> {
    if (!activeSessionId || !prd) throw new Error("No active session");
    setAiEditingKey(key);
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/prd/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_key: key,
          instruction,
          current_section_value: prd[key],
          full_prd: prd,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? "AI edit failed");
      }
      const data = await res.json();
      updateSection(key, data.updated_section);
      scheduleSave({ ...prd, [key]: data.updated_section });
      setAiEditedSections(prev => { const next = new Set(prev); next.add(key); return next; });
    } finally {
      setAiEditingKey(null);
    }
  }

  // ── Export markdown ──
  async function handleExportMarkdown() {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/prd/export?view=${viewMode}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail ?? body.error ?? "Export failed");
        return;
      }
      const md = await res.text();
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const shortId = activeSessionId.slice(0, 8);
      a.download = viewMode === "engineering"
        ? `prd-engineering-${shortId}.md`
        : viewMode === "executive"
        ? `prd-executive-${shortId}.md`
        : `prd-${shortId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed");
    }
  }

  // ── Render ──
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PipelineStepper
          currentStepId="tasks"
          stepStatuses={stepStatuses}
          sessionIdShort={activeSessionId ? activeSessionId.slice(0, 8).toUpperCase() : null}
          generating={generating}
          generatingStep="tasks"
        />

        {/* Header */}
        <header
          className="flex items-center justify-between px-6 flex-shrink-0"
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[13px]" style={{ color: "#6B6B6B" }}>
              <span>Signals</span>
              <span style={{ color: "#C0B8B0" }}>/</span>
              <span className="font-medium" style={{ color: "#0D0D0D" }}>PRD</span>
            </div>
            {fromSession && (
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "rgba(232,86,27,0.10)", color: "#E8561B", letterSpacing: "0.03em" }}>
                From Session
              </span>
            )}
            {qualityScore && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 10px",
                  borderRadius: 20,
                  background: qualityColor(qualityScore.score).bg,
                  color: qualityColor(qualityScore.score).color,
                  letterSpacing: "0.03em",
                }}
              >
                {qualityScore.score}/100
              </span>
            )}
            {saveStatus !== "idle" && (
              <span style={{
                fontSize: 10.5, fontWeight: 500, letterSpacing: "0.02em",
                color: saveStatus === "saving" ? "#9E9E9E" : saveStatus === "saved" ? "#15803D" : "#DC2626",
                transition: "color 0.2s",
              }}>
                {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved ✓" : "Save failed"}
              </span>
            )}
            {activeSessionId && regenCount > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "rgba(0,0,0,0.06)", color: regenLimitReached ? "#B91C1C" : "#6B6B6B", letterSpacing: "0.03em", width: "6.5rem", display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
                {regenLeft}/3 Regen Left
              </span>
            )}
          </div>

          {/* View mode toggle */}
          <div style={{ display: "flex", border: "1px solid #E4DDD4", borderRadius: 8, overflow: "hidden" }}>
            {(["full", "engineering", "executive"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "5px 12px",
                  border: "none",
                  cursor: "pointer",
                  background: viewMode === mode ? "#0D0D0D" : "#FFFFFF",
                  color: viewMode === mode ? "#FFFFFF" : "#6B6B6B",
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                }}
              >
                {mode === "full" ? "Full" : mode === "engineering" ? "Engineering" : "Exec"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {prd && (
              <>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    width: "6.5rem",
                    padding: "0.4rem 0.5rem",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    background: "#FFFFFF",
                    border: "1.5px solid #E4DDD4",
                    color: "#6B6B6B",
                    cursor: "pointer",
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
                    <path d="M4.5 7.5a2.5 2.5 0 003.536-3.536L6.5 2.43A2.5 2.5 0 002.964 5.965" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M7.5 4.5A2.5 2.5 0 003.964 8.036L5.5 9.57A2.5 2.5 0 009.036 6.035" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <PRDExportButton prd={prd} />
                <ArtifactExportMenu
                  disabled={!prd}
                  disabledReason="Generate PRD before exporting"
                  align="right"
                  actions={prd ? [
                    {
                      id: "copy-markdown",
                      label: "Copy Markdown",
                      description: "Copy PRD for docs or chat",
                      successLabel: "Copied",
                      errorLabel: "Copy failed",
                      onSelect: async () => copyToClipboard(prdToMarkdown(prd)),
                    },
                    {
                      id: "download-markdown",
                      label: "Download Markdown",
                      description: "Save PRD as Markdown",
                      badge: ".md",
                      successLabel: "Downloaded",
                      errorLabel: "Export failed",
                      onSelect: () => downloadTextFile(`${safeFilename("prd")}.md`, prdToMarkdown(prd)),
                    },
                  ] : []}
                />
                <button
                  onClick={handleExportMarkdown}
                  title="Export as Markdown"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    width: "6.5rem",
                    padding: "0.4rem 0.5rem",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    background: "#FFFFFF",
                    border: "1.5px solid #E4DDD4",
                    color: "#6B6B6B",
                    cursor: "pointer",
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
                    <path d="M2 9h8M6 2v5M3.5 5.5L6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Export MD
                </button>
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    width: "6.5rem",
                    padding: "0.4rem 0.5rem",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    background: chatOpen ? "rgba(232,86,27,0.08)" : "#FFFFFF",
                    border: chatOpen ? "1.5px solid rgba(232,86,27,0.4)" : "1.5px solid #E4DDD4",
                    color: chatOpen ? "#E8561B" : "#0D0D0D",
                    cursor: "pointer",
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Ask AI
                </button>
                <button
                  onClick={() => setShowFeedbackPanel(!showFeedbackPanel)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    width: "6.5rem",
                    padding: "0.4rem 0.5rem",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    background: showFeedbackPanel ? "#F3F4F6" : "#FFFFFF",
                    border: "1.5px solid #E4DDD4",
                    color: "#0D0D0D",
                    cursor: "pointer",
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 21v-5h5" />
                  </svg>
                  Discovery
                  {feedback.length > 0 && (
                    <span style={{
                      background: "#E8561B", color: "white", fontSize: 10,
                      padding: "1px 5px", borderRadius: 10, fontWeight: 600, flexShrink: 0,
                    }}>
                      {feedback.length}
                    </span>
                  )}
                </button>
                {/* Push to Linear */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <button
                    onClick={handlePushToLinear}
                    disabled={linearPushing || !linearPayload}
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                      width: "6.5rem", padding: "0.4rem 0.5rem", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 500,
                      background: linearPushStatus === "success" ? "rgba(232,86,27,0.08)" : "#0D0D0D",
                      border: linearPushStatus === "success" ? "1.5px solid rgba(232,86,27,0.3)" : "1.5px solid #0D0D0D",
                      color: linearPushStatus === "success" ? "#E8561B" : "#FFFFFF",
                      cursor: (linearPushing || !linearPayload) ? "not-allowed" : "pointer",
                      opacity: (linearPushing || !linearPayload) ? 0.6 : 1,
                      fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {linearPushing ? (
                      <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M3.5 5.5h4M5.5 3.5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    )}
                    {linearPushStatus === "success" ? "Pushed ✓" : "→ Linear"}
                  </button>
                  {linearPushStatus === "error" && linearPushError && (
                    <span style={{ fontSize: 11, color: "#DC2626" }}>{linearPushError}</span>
                  )}
                  {linearNotConnected && (
                    <span style={{ fontSize: 11, color: "#6B6B6B" }}>
                      Not connected —{" "}
                      <a href="/settings/integrations" style={{ color: "#E8561B", fontWeight: 600, textDecoration: "none" }}>
                        Connect ↗
                      </a>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowConfirmRegenerate(true)}
                  disabled={generating || regenLimitReached}
                  title={regenLimitReached ? "Limit reached. Use the editor." : undefined}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    width: "6.5rem",
                    padding: "0.4rem 0.5rem",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    background: "#FFFFFF",
                    border: "1.5px solid #E4DDD4",
                    color: "#6B6B6B",
                    cursor: generating || regenLimitReached ? "not-allowed" : "pointer",
                    opacity: generating || regenLimitReached ? 0.6 : 1,
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  }}
                >
                  Regenerate
                </button>
              </>
            )}
            {!prd && (
              <button
                onClick={() => void handleGenerate()}
                disabled={generating || !activeSessionId || regenLimitReached}
                title={regenLimitReached ? "Limit reached. Use the editor." : undefined}
                className="btn-dark"
                style={{
                  fontSize: 13,
                  padding: "0.45rem 1rem",
                  opacity: generating || !activeSessionId || regenLimitReached ? 0.6 : 1,
                  cursor: generating || !activeSessionId || regenLimitReached ? "not-allowed" : "pointer",
                }}
              >
                {generating ? (
                  <TextShimmer duration={1.2}>
                    {loadingPhase || "Generating..."}
                  </TextShimmer>
                ) : !activeSessionId ? (
                  "Select a session in Sessions"
                ) : (
                  "Generate PRD"
                )}
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        {!prd ? (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ padding: "2rem" }}>
            {generating ? (
              <div className="flex flex-col items-center gap-3">
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: "2.5px solid #E4DDD4",
                    borderTopColor: "#E8561B",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                <style>{`
                  @keyframes spin { to { transform: rotate(360deg); } }
                  .tiptap-wrapper { border-radius: 6px; margin: -4px; padding: 4px; transition: background 0.15s; cursor: text; }
                  .tiptap-wrapper:hover { background: rgba(232,86,27,0.03); }
                  .tiptap-wrapper:focus-within { background: rgba(232,86,27,0.05); outline: none; }
                  .tiptap { outline: none; }
                  .tiptap p { margin: 0 0 0.4em 0; }
                  .tiptap p:last-child { margin: 0; }
                `}</style>
                <TextShimmer duration={1.2}>
                  {loadingPhase || "Generating PRD..."}
                </TextShimmer>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4 }}>
                  <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.5" />
                  <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 13, color: "#6B6B6B", textAlign: "center", maxWidth: 400 }}>{error}</span>
                {interruptedJobId ? (
                  <div className="flex flex-col items-center gap-2" style={{ marginTop: 8 }}>
                    <button
                      onClick={handleResume}
                      disabled={resuming || !activeSessionId}
                      className="btn-dark"
                      style={{ fontSize: 13, padding: "0.4rem 1rem" }}
                    >
                      {resuming ? "Checking..." : "Resume Generation"}
                    </button>
                    <button
                      onClick={() => { setInterruptedJobId(null); handleGenerate(); }}
                      disabled={!activeSessionId || regenLimitReached}
                      title={regenLimitReached ? "Limit reached. Use the editor." : undefined}
                      style={{ fontSize: 12, color: "#6B6B6B", background: "none", border: "none", cursor: regenLimitReached ? "not-allowed" : "pointer", opacity: regenLimitReached ? 0.5 : 0.7, textDecoration: "underline" }}
                    >
                      Start Over
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleGenerate()}
                    disabled={!activeSessionId || regenLimitReached}
                    title={regenLimitReached ? "Limit reached. Use the editor." : undefined}
                    className="btn-dark"
                    style={{ fontSize: 13, padding: "0.4rem 1rem", marginTop: 8, opacity: regenLimitReached ? 0.6 : 1, cursor: regenLimitReached ? "not-allowed" : "pointer" }}
                  >
                    Try Again
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: 13, color: "#6B6B6B" }}>
                  {activeSessionId
                    ? viewMode === "engineering"
                      ? "No PRD yet. Generate the full PRD first, then switch to Engineering view."
                      : viewMode === "executive"
                      ? "No PRD yet. Generate the full PRD first, then switch to Executive view."
                      : "No PRD generated yet. Run all pipeline steps first, then generate."
                    : "Select a session in Sessions to get started."}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <div
              className="flex-1 overflow-y-auto"
              style={{ padding: "24px 28px" }}
            >
              <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes prd-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                .tiptap-wrapper { border-radius: 6px; margin: -4px; padding: 4px; transition: background 0.15s; cursor: text; }
                .tiptap-wrapper:hover { background: rgba(232,86,27,0.03); }
                .tiptap-wrapper:focus-within { background: rgba(232,86,27,0.05); }
                .tiptap { outline: none; }
                .tiptap p { margin: 0 0 0.4em 0; }
                .tiptap p:last-child { margin: 0; }
              `}</style>
              {/* Quality gaps banner */}
              {qualityScore && qualityScore.score < 70 && qualityScore.critical_gaps.length > 0 && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.06)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    marginBottom: 16,
                    fontSize: 13,
                    color: "#6B6B6B",
                  }}
                >
                  <strong style={{ color: "#DC2626" }}>Quality gaps detected ({qualityScore.score}/100):</strong>
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {qualityScore.critical_gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* View mode context banner */}
              {viewMode !== "full" && (
                <div
                  style={{
                    background: "rgba(232,86,27,0.06)",
                    border: "1px solid rgba(232,86,27,0.15)",
                    borderRadius: 10,
                    padding: "10px 16px",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0D0D0D" }}>
                      {VIEW_MODE_META[viewMode].label}
                    </span>
                    {VIEW_MODE_META[viewMode].audience && (
                      <span style={{ fontSize: 12, color: "#E8561B" }}>
                        {VIEW_MODE_META[viewMode].audience}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "#6B6B6B" }}>
                    {VIEW_MODE_META[viewMode].description}
                  </span>
                </div>
              )}

              <PipelineTrace stepKey="prd" />

              {/* Section cards */}
              {PRD_SECTIONS.map(({ key, title }) => {
                if (!SECTION_VISIBILITY[viewMode].includes(key)) return null;
                const val = prd[key];
                if (val == null) return null;
                return (
                  <SectionCard
                    key={key}
                    title={title}
                    value={val}
                    sectionKey={key}
                    editing={editingKey === key}
                    onEditStart={() => setEditingKey(key)}
                    onEditEnd={() => setEditingKey(null)}
                    onUpdate={(v) => updateSection(key, v)}
                    onScheduleSave={(v) => scheduleSave({ ...prd, [key]: v })}
                    onAiEdit={(instruction) => handleAiEdit(key, instruction)}
                    aiEditing={aiEditingKey === key}
                    aiEdited={aiEditedSections.has(key)}
                    citations={citations}
                    citationCount={getSectionCitationCount(key, prd, citations)}
                    feedback={feedback}
                    sessionId={activeSessionId}
                    onAddFeedback={(entry) => setFeedback(prev => [entry, ...prev])}
                  />
                );
              })}

              <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-stone-950">
                    Sources cited
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    This PRD was generated from {prdSourceDocumentCount} source documents.
                  </p>
                </div>
                <EvidencePanel evidence={prdSourceEvidence} />
              </section>
            </div>

            {/* Feedback Panel */}
            <ConversationPanel
              sessionId={activeSessionId}
              contextKeys={["problems", "features", "tasks", "prd"]}
              mode="sidebar"
              isOpen={chatOpen}
              onClose={() => setChatOpen(false)}
            />

            {showFeedbackPanel && (
              <div
                style={{
                  width: 280,
                  flexShrink: 0,
                  borderLeft: "1px solid #E4DDD4",
                  background: "#FFFFFF",
                  display: "flex",
                  flexDirection: "column",
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                }}
              >
                <div style={{ padding: 20, borderBottom: "1px solid #E4DDD4" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0D0D0D", margin: "0 0 12px 0" }}>
                    Discovery Loop
                  </h3>
                  {feedbackLoading ? (
                    <div style={{ fontSize: 12, color: "#9E9E9E" }}>Loading outcomes…</div>
                  ) : feedbackLoadError ? (
                    <div style={{ fontSize: 12, color: "#DC2626", lineHeight: 1.5 }}>
                      {feedbackLoadError}
                      <div style={{ fontSize: 11, color: "#6B6B6B", marginTop: 6 }}>
                        Check that the pipeline API is running and you are signed in.
                      </div>
                    </div>
                  ) : (() => {
                    const total = feedback.length;
                    const validated = feedback.filter(f => f.feedback_type === "validated").length;
                    const partial = feedback.filter(f => f.feedback_type === "partial").length;
                    if (total === 0) {
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 500 }}>Validation Score</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#9E9E9E" }}>—</span>
                          </div>
                          <div style={{ height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }} />
                          <div style={{ fontSize: 11, color: "#9E9E9E", marginTop: 8 }}>
                            No outcomes logged yet. Use <strong style={{ color: "#6B6B6B" }}>Log Outcome</strong> on feature rows (Full or Engineering view).
                          </div>
                        </div>
                      );
                    }
                    const score = Math.round(((validated + partial * 0.5) / total) * 100);
                    const scoreColor = score >= 70 ? "#3D6B5E" : score >= 40 ? "#D97706" : "#DC2626";
                    return (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 500 }}>Validation Score</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor }}>{score}%</span>
                        </div>
                        <div style={{ height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: scoreColor, width: `${score}%`, transition: "width 0.3s ease" }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#9E9E9E", marginTop: 8 }}>
                          {validated} validated, {partial} partial out of {total} logged
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                  {feedbackLoadError ? null : feedbackLoading ? (
                    <div style={{ fontSize: 13, color: "#9E9E9E", textAlign: "center", marginTop: 40 }}>
                      Loading…
                    </div>
                  ) : feedback.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#6B6B6B", textAlign: "center", marginTop: 40, lineHeight: 1.6 }}>
                      Outcomes you log appear here. Hover a feature in the PRD and choose validated, partial, invalidated, or deferred.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {FEEDBACK_TYPES_PANEL_ORDER.map((type) => {
                        const items = feedback.filter(f => f.feedback_type === type);
                        if (items.length === 0) return null;
                        const colors: Record<string, string> = {
                          validated: "#3D6B5E",
                          invalidated: "#DC2626",
                          partial: "#D97706",
                          deferred: "#6B6B6B"
                        };
                        return (
                          <div key={type}>
                            <h4 style={{ fontSize: 11, fontWeight: 700, color: colors[type], textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px 0" }}>
                              {type} ({items.length})
                            </h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {items.map(item => (
                                <div key={item.id} style={{ background: "#F8F4EF", borderRadius: 8, padding: 12, border: "1px solid #E4DDD4", position: "relative" }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0D0D0D", marginBottom: 4, paddingRight: 20 }}>
                                    {item.prd_item_title}
                                  </div>
                                  {item.outcome_note && (
                                    <div style={{ fontSize: 11, color: "#6B6B6B", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                      {item.outcome_note}
                                    </div>
                                  )}
                                  <button
                                    onClick={async () => {
                                      try {
                                        await deleteFeedback(activeSessionId!, item.id);
                                        setFeedback(prev => prev.filter(f => f.id !== item.id));
                                      } catch (err) {
                                        console.error("Failed to delete", err);
                                      }
                                    }}
                                    style={{
                                      position: "absolute", top: 10, right: 10,
                                      background: "none", border: "none", color: "#9E9E9E", cursor: "pointer",
                                      padding: 2, borderRadius: 4
                                    }}
                                    title="Delete"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Regenerate confirmation dialog */}
      {showConfirmRegenerate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowConfirmRegenerate(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF",
              borderRadius: 14,
              padding: "28px 28px 20px",
              width: 400,
              maxWidth: "90vw",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#0D0D0D", marginBottom: 8 }}>
              Regenerate PRD?
            </h3>
            <p style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.6, marginBottom: 20 }}>
              This will overwrite the existing PRD with a new generation. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmRegenerate(false)}
                style={{
                  padding: "0.4rem 1rem",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  background: "#FFFFFF",
                  border: "1.5px solid #E4DDD4",
                  color: "#6B6B6B",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmRegenerate(false);
                  handleGenerate();
                }}
                className="btn-dark"
                style={{ fontSize: 13, padding: "0.4rem 1rem" }}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PrdPageWrapper() {
  return (
    <Suspense fallback={null}>
      <PrdPage />
    </Suspense>
  );
}
