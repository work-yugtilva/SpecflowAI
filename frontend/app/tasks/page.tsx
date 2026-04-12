"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { PipelineStepper } from "@/components/pipeline/PipelineStepper";
import { QualityBadge } from "@/components/pipeline/QualityBadge";
import { CitationBadge } from "@/components/pipeline/CitationBadge";
import {
  getSession,
  generateHandoff,
  getHandoff,
  exportHandoff,
} from "@/lib/api/session";
import type { SessionDetail, AgentHandoff } from "@/lib/api/session";
import {
  buildPipelineInputFromStorage,
  clearAutorunFlag,
  isAutorunPending,
} from "@/lib/pipeline-input";
import { useActiveSession } from "@/lib/active-session-context";
import { computeStepStatuses } from "@/lib/pipeline-session";
import { runPipelineStepOrFull } from "@/lib/run-pipeline-client";
import { useOrphanedPipeline } from "@/lib/use-orphaned-pipeline";
import { OrphanedPipelineModal } from "@/components/ui/orphaned-pipeline-modal";
import { ConversationPanel } from "@/components/ui/conversation-panel";
import { adaptTasks } from "@/lib/pipeline-contracts";
import type {
  LinearPayload,
  TaskStatus,
  TaskStepViewModel as TaskStep,
  TaskType,
  TaskViewModel as Task,
} from "@/lib/pipeline-contracts";
import type { PipelineInput } from "@/lib/pipeline-types";
import dynamic from "next/dynamic";
const TextShimmer = dynamic(
  () => import("@/components/ui/text-shimmer").then((m) => m.TextShimmer)
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinearPayloadMeta {
  session_id: string;
  session_name: string;
  task_count: number;
  generated_at: string; // ISO string from linear_payload.metadata.generated_at
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUPS: TaskType[] = ["Frontend", "Backend", "API", "Infrastructure"];

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "#C8C2BB",
  "in-progress": "#F59E0B",
  done: "#22C55E",
};

const PRIORITY_COLORS: Record<
  Task["priority"],
  { bg: string; color: string }
> = {
  High: { bg: "#FEF2F2", color: "#EF4444" },
  Medium: { bg: "#FFF7ED", color: "#F59E0B" },
  Low: { bg: "#F0FDF4", color: "#22C55E" },
};

const TYPE_COLORS: Record<TaskType, { bg: string; color: string }> = {
  Frontend: { bg: "#EFF6FF", color: "#3B82F6" },
  Backend: { bg: "#F0FDF4", color: "#16A34A" },
  API: { bg: "#FFF7ED", color: "#D97706" },
  Infrastructure: { bg: "#F5F3FF", color: "#7C3AED" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#9E9E9E",
        marginBottom: 8,
        marginTop: 18,
      }}
    >
      {children}
    </div>
  );
}

function TypeBadge({ type }: { type: TaskType }) {
  const c = TYPE_COLORS[type];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: c.bg,
        color: c.color,
        flexShrink: 0,
      }}
    >
      {type}
    </span>
  );
}

// ─── Handoff Summary Panel ────────────────────────────────────────────────────

const LAYER_COLORS: Record<string, { bg: string; color: string }> = {
  Frontend: TYPE_COLORS["Frontend"],
  Backend: TYPE_COLORS["Backend"],
  API: TYPE_COLORS["API"],
  Infrastructure: TYPE_COLORS["Infrastructure"],
};

function LayerBadge({ layer }: { layer: string }) {
  const c = LAYER_COLORS[layer] ?? { bg: "#F3F4F6", color: "#6B6B6B" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: c.bg,
        color: c.color,
        flexShrink: 0,
      }}
    >
      {layer}
    </span>
  );
}

interface HandoffSummaryPanelProps {
  handoff: import("@/lib/api/session").AgentHandoff;
  sessionId: string;
  expandedTask: string | null;
  onExpandTask: (id: string | null) => void;
  onClose: () => void;
}

function HandoffSummaryPanel({
  handoff,
  sessionId,
  expandedTask,
  onExpandTask,
  onClose,
}: HandoffSummaryPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          top: 52,
          background: "rgba(0,0,0,0.15)",
          zIndex: 39,
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: 52,
          width: 420,
          height: "calc(100vh - 52px)",
          background: "#FFFFFF",
          borderLeft: "1px solid #E4DDD4",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 220ms ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E4DDD4",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0D0D0D" }}>
              Agent Handoff
            </span>
            {handoff.estimated_sessions != null && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: "rgba(232,86,27,0.10)",
                  color: "#E8561B",
                }}
              >
                ~{handoff.estimated_sessions} session{handoff.estimated_sessions !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#9E9E9E",
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
            }}
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        {/* Clarification warning */}
        {handoff.needs_clarification_count > 0 && (
          <div
            style={{
              padding: "10px 20px",
              background: "rgba(245,158,11,0.08)",
              borderBottom: "1px solid rgba(245,158,11,0.2)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <span style={{ color: "#D97706", fontSize: 13 }}>⚠</span>
            <span style={{ fontSize: 12.5, color: "#92400E", lineHeight: 1.5 }}>
              {handoff.needs_clarification_count} task
              {handoff.needs_clarification_count !== 1 ? "s" : ""} need clarification before handoff
            </span>
          </div>
        )}

        {/* Project brief */}
        {handoff.project_brief && (
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid #E4DDD4",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#9E9E9E",
                marginBottom: 6,
              }}
            >
              Project Brief
            </div>
            <p
              style={{
                fontSize: 12.5,
                color: "#6B6B6B",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {handoff.project_brief}
            </p>
          </div>
        )}

        {/* Task list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {handoff.tasks.map((task) => {
            const isExpanded = expandedTask === task.id;
            return (
              <div key={task.id} style={{ borderBottom: "1px solid #F0EDE9" }}>
                <button
                  onClick={() => onExpandTask(isExpanded ? null : task.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 20px",
                    background: isExpanded ? "rgba(232,86,27,0.03)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                    transition: "background 120ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) e.currentTarget.style.background = "rgba(0,0,0,0.02)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Chevron */}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    style={{
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 150ms ease",
                      flexShrink: 0,
                      color: "#9E9E9E",
                    }}
                  >
                    <path
                      d="M3.5 2L7 5L3.5 8"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "#0D0D0D",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {task.title}
                  </span>
                  {task.needs_clarification && (
                    <span
                      title={task.clarification_reason}
                      style={{ fontSize: 12, color: "#D97706", flexShrink: 0, cursor: "help" }}
                    >
                      ⚠
                    </span>
                  )}
                  <LayerBadge layer={task.layer} />
                </button>

                {isExpanded && (
                  <div
                    style={{
                      padding: "0 20px 14px 38px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {task.clarification_reason && task.needs_clarification && (
                      <div
                        style={{
                          padding: "8px 12px",
                          background: "rgba(245,158,11,0.07)",
                          border: "1px solid rgba(245,158,11,0.2)",
                          borderRadius: 6,
                          fontSize: 12,
                          color: "#92400E",
                          lineHeight: 1.5,
                        }}
                      >
                        ⚠ {task.clarification_reason}
                      </div>
                    )}
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.07em",
                          textTransform: "uppercase",
                          color: "#9E9E9E",
                          marginBottom: 5,
                        }}
                      >
                        Implementation Prompt
                      </div>
                      <p
                        style={{
                          fontSize: 12,
                          color: "#3D3D3D",
                          lineHeight: 1.6,
                          margin: 0,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {task.implementation_prompt}
                      </p>
                    </div>
                    {task.acceptance_criteria && (
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                            color: "#9E9E9E",
                            marginBottom: 5,
                          }}
                        >
                          Acceptance Criteria
                        </div>
                        <p
                          style={{
                            fontSize: 12,
                            color: "#3D3D3D",
                            lineHeight: 1.6,
                            margin: 0,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {task.acceptance_criteria}
                        </p>
                      </div>
                    )}
                    {task.dependencies.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                            color: "#9E9E9E",
                            marginBottom: 5,
                          }}
                        >
                          Dependencies
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {task.dependencies.map((dep, i) => (
                            <div key={i} style={{ fontSize: 12, color: "#6B6B6B", lineHeight: 1.5 }}>
                              <span style={{ color: "#E8561B", marginRight: 6 }}>→</span>
                              {dep}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom export strip */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #E4DDD4",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#9E9E9E",
              marginBottom: 2,
            }}
          >
            Export
          </div>
          {([
            { label: "Export CLAUDE.md",    format: "claude_md"    },
            { label: "Export .cursorrules", format: "cursor_rules" },
            { label: "Copy task prompts",   format: "task_list"    },
          ] as const).map(({ label, format }) => (
            <button
              key={format}
              onClick={() => exportHandoff(sessionId, format)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                fontSize: 12.5,
                color: "#0D0D0D",
                background: "#F8F4EF",
                border: "1px solid #E4DDD4",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                transition: "background 120ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#EFE9E2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#F8F4EF"; }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Tasks Page ───────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter();
  const { activeSessionId } = useActiveSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [fromSession, setFromSession] = useState(false);
  const [qualityScore, setQualityScore] = useState<{score: number; passed: boolean} | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const {
    showOrphanedModal,
    orphanedOutput,
    triggerOrphanedPrompt,
    closeOrphanedModal,
  } = useOrphanedPipeline();

  const [expandedGroups, setExpandedGroups] = useState<Set<TaskType>>(
    new Set<TaskType>(["Frontend", "Backend", "API", "Infrastructure"])
  );
  // Status overrides: user can change task status interactively
  const [statusMap, setStatusMap] = useState<Record<string, TaskStatus>>({});
  // Step done overrides: per-task, per-step
  const [stepsMap, setStepsMap] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [prdGenerating, setPrdGenerating] = useState(false);
  const [prdStatus, setPrdStatus] = useState<"success" | "error" | null>(null);
  const [prdError, setPrdError] = useState<string | null>(null);
  const [linearPayload, setLinearPayload] = useState<LinearPayload | null>(null);
  const [linearPushing, setLinearPushing] = useState(false);
  const [linearPushStatus, setLinearPushStatus] = useState<"success" | "error" | null>(null);
  const [linearPushError, setLinearPushError] = useState<string | null>(null);
  const [linearNotConnected, setLinearNotConnected] = useState(false);
  const [linearPayloadMeta, setLinearPayloadMeta] = useState<LinearPayloadMeta | null>(null);
  const [showLinearConfirm, setShowLinearConfirm] = useState(false);
  const [handoff, setHandoff] = useState<AgentHandoff | null>(null);
  const [handoffGenerating, setHandoffGenerating] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState<"success" | "error" | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [showHandoffPanel, setShowHandoffPanel] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [expandedHandoffTask, setExpandedHandoffTask] = useState<string | null>(null);

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;
  const effectiveStatus = (t: Task): TaskStatus => statusMap[t.id] ?? t.status;

  const stepStatuses = computeStepStatuses(sessionDetail);
  const regenCount = sessionDetail?.state?.state?.regeneration_counts?.["tasks"] ?? 0;
  const regenLimitReached = regenCount >= 3;
  const regenLeft = Math.max(0, 3 - regenCount);

  useEffect(() => {
    setTasks([]);
    setSelectedId(null);
    setStatusMap({});
    setStepsMap({});
    setFromSession(false);
    setSessionDetail(null);
    setLinearPayload(null);
    setLinearPayloadMeta(null);
    setShowLinearConfirm(false);
    setLinearNotConnected(false);
    setHandoff(null);
    if (!activeSessionId) return;
    let cancelled = false;
    getSession(activeSessionId)
      .then((d) => {
        if (cancelled) return;
        setSessionDetail(d);
        const out = d.state?.state?.outputs as
          | Record<string, unknown>
          | undefined;
        if (out && out.tasks != null) {
          setFromSession(true);
          const _tq = out?.tasks_quality as {score: number; passed: boolean} | undefined;
          if (_tq) setQualityScore(_tq);
          const adapted = adaptTasks(out);
          setTasks(adapted);
          if (adapted.length > 0) setSelectedId(adapted[0].id);
        }
        const lp = out?.linear_payload as LinearPayload | undefined;
        if (lp) {
          setLinearPayload(lp);
          setLinearPayloadMeta({
            session_id: activeSessionId,
            session_name: d.session?.session_name ?? activeSessionId ?? "Unknown session",
            task_count: lp.metadata.total_issues,
            generated_at: lp.metadata.generated_at,
          });
        }
        // Load existing handoff (404 = never generated, not an error)
        getHandoff(activeSessionId)
          .then((r) => { if (!cancelled && r.handoff) setHandoff(r.handoff); })
          .catch(() => { /* 404 is expected — stay null */ });
      })
      .catch(() => {
        if (!cancelled) setSessionDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeSessionId,
    setTasks,
    setSelectedId,
    setStatusMap,
    setStepsMap,
    setFromSession,
    setSessionDetail,
    setLinearPayload,
    setLinearPayloadMeta,
    setShowLinearConfirm,
    setLinearNotConnected,
    setHandoff,
    setQualityScore,
  ]);

  const tasksByGroup = GROUPS.map((type) => ({
    type,
    tasks: tasks.filter((t) => t.type === type),
  }));

  function toggleGroup(type: TaskType) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function setStatus(taskId: string, status: TaskStatus) {
    setStatusMap((prev) => ({ ...prev, [taskId]: status }));
  }

  function toggleStep(taskId: string, stepId: string, current: boolean) {
    setStepsMap((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] ?? {}), [stepId]: !current },
    }));
  }

  function isStepDone(taskId: string, step: TaskStep): boolean {
    return stepsMap[taskId]?.[step.id] ?? step.done;
  }

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setSelectedId(null);
    setStatusMap({});
    setStepsMap({});
    setFromSession(false);
    const isAutorun = isAutorunPending(activeSessionId ?? undefined);
    setLinearPayload(null);
    setLinearPayloadMeta(null);
    setShowLinearConfirm(false);
    try {
      const inputData: PipelineInput = await buildPipelineInputFromStorage(
        activeSessionId ?? undefined
      );
      const result = await runPipelineStepOrFull(
        "tasks",
        inputData,
        activeSessionId
      );
      const { data, mode, sessionState } = result;
      setFromSession(mode === "session");
      if (data.tasks_quality) setQualityScore(data.tasks_quality as any);
      if (mode === "orphaned" && result.orphanedOutput) {
        triggerOrphanedPrompt(result.orphanedOutput);
      }
      const adapted = adaptTasks(data, sessionState);
      setTasks(adapted);
      if (adapted.length > 0) setSelectedId(adapted[0].id);
      if (activeSessionId) {
        try {
          setSessionDetail(await getSession(activeSessionId));
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    } finally {
      if (isAutorun) clearAutorunFlag(activeSessionId ?? undefined);
      setGenerating(false);
    }
  }, [
    activeSessionId,
    triggerOrphanedPrompt,
    setGenerating,
    setSelectedId,
    setStatusMap,
    setStepsMap,
    setFromSession,
    setLinearPayload,
    setLinearPayloadMeta,
    setShowLinearConfirm,
    setQualityScore,
    setTasks,
    setSessionDetail,
  ]);

  async function handleGeneratePrd() {
    if (!activeSessionId || prdGenerating) return;
    setPrdGenerating(true);
    setPrdStatus(null);
    setPrdError(null);
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/prd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? body.detail ?? res.statusText ?? "Generation failed";
        setPrdError(msg);
        setPrdStatus("error");
        return;
      }
      setPrdStatus("success");
      router.push("/prd");
    } catch (err) {
      setPrdError(err instanceof Error ? err.message : "Connection failed");
      setPrdStatus("error");
    } finally {
      setPrdGenerating(false);
    }
  }

  useEffect(() => {
    if (prdStatus === null) return;
    const t = setTimeout(() => setPrdStatus(null), 5000);
    return () => clearTimeout(t);
  }, [prdStatus, setPrdStatus]);

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
        const body = await res.json().catch(() => ({})) as { code?: string; error?: string };
        if (res.status === 401 && body.code === "linear_not_connected") {
          setLinearNotConnected(true);
          return;
        }
        setLinearPushError(body.error ?? res.statusText ?? "Push failed");
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

  useEffect(() => {
    if (linearPushStatus === null) return;
    const t = setTimeout(() => setLinearPushStatus(null), 5000);
    return () => clearTimeout(t);
  }, [linearPushStatus, setLinearPushStatus]);

  async function handleGenerateHandoff() {
    if (!activeSessionId || handoffGenerating) return;
    setHandoffGenerating(true);
    setHandoffStatus(null);
    setHandoffError(null);
    try {
      const res = await generateHandoff(activeSessionId);
      setHandoff(res.handoff);
      setHandoffStatus("success");
      setShowHandoffPanel(true);
    } catch (e) {
      setHandoffStatus("error");
      setHandoffError(e instanceof Error ? e.message : "Handoff failed");
    } finally {
      setHandoffGenerating(false);
    }
  }

  useEffect(() => {
    if (handoffStatus === null) return;
    const t = setTimeout(() => setHandoffStatus(null), 5000);
    return () => clearTimeout(t);
  }, [handoffStatus, setHandoffStatus]);

  useEffect(() => {
    if (!showExportDropdown) return;
    function handleClick(e: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showExportDropdown, exportDropdownRef, setShowExportDropdown]);

  useEffect(() => {
    if (!activeSessionId || !isAutorunPending(activeSessionId)) return;
    handleGenerate();
  }, [activeSessionId, handleGenerate]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      <Sidebar />

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PipelineStepper
          currentStepId="tasks"
          stepStatuses={stepStatuses}
          sessionIdShort={activeSessionId ? activeSessionId.slice(0, 8).toUpperCase() : null}
          generating={generating}
          generatingStep="tasks"
        />
        {/* Top bar */}
        <header
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            flexShrink: 0,
            gap: 12,
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#9E9E9E", fontWeight: 400 }}>
              Signals
            </span>
            <span style={{ fontSize: 13, color: "#C8C2BB" }}>›</span>
            <span
              style={{ fontSize: 13, fontWeight: 500, color: "#0D0D0D" }}
            >
              Tasks
            </span>
            {tasks.length > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "1px 7px",
                  borderRadius: 4,
                  fontSize: 11,
                  background: "#F3F4F6",
                  color: "#6B6B6B",
                }}
              >
                {tasks.length} tasks
              </span>
            )}
            {fromSession && (
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "rgba(232,86,27,0.10)", color: "#E8561B", letterSpacing: "0.03em" }}>
                From Session
              </span>
            )}
            {qualityScore && (
              <QualityBadge score={qualityScore.score} passed={qualityScore.passed} />
            )}
            {activeSessionId && regenCount > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "rgba(0,0,0,0.06)", color: regenLimitReached ? "#B91C1C" : "#6B6B6B", letterSpacing: "0.03em" }}>
                {regenLeft}/3 Regenerations Left
              </span>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {linearPushStatus === "success" && (
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "rgba(34,197,94,0.12)", color: "#15803D" }}>
                Pushed to Linear ✓
              </span>
            )}
            {linearNotConnected && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 500, color: "#6B6B6B" }}>
                Linear not connected —{" "}
                <a
                  href="/settings/integrations"
                  style={{ color: "#E8561B", fontWeight: 600, textDecoration: "none" }}
                >
                  Connect in Settings ↗
                </a>
              </span>
            )}
            {linearPushStatus === "error" && (
              <span
                title={linearPushError ?? undefined}
                style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "rgba(239,68,68,0.12)", color: "#DC2626", cursor: "help", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {linearPushError ? `Linear error: ${linearPushError}` : "Push failed — try again"}
              </span>
            )}
            {/* Push to Linear — two-step confirm flow */}
            {!showLinearConfirm ? (
              <button
                onClick={() => setShowLinearConfirm(true)}
                disabled={!linearPayload || !activeSessionId}
                title={
                  !activeSessionId
                    ? "Select a session first"
                    : !linearPayload
                    ? "Run the full pipeline to generate the Linear payload first"
                    : "Review payload before pushing"
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "0.4rem 0.875rem",
                  borderRadius: 8,
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  background: !linearPayload || !activeSessionId ? "#F8F4EF" : "#FFFFFF",
                  border: "1.5px solid #E4DDD4",
                  color: !linearPayload || !activeSessionId ? "#9E9E9E" : "#0D0D0D",
                  cursor: !linearPayload || !activeSessionId ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  opacity: !linearPayload || !activeSessionId ? 0.6 : 1,
                  transition: "background 150ms ease, border-color 150ms ease",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: !linearPayload ? 0.4 : 0.7 }}>
                  <polygon points="5.5,1 10,9.5 1,9.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
                </svg>
                Push to Linear
              </button>
            ) : (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 10px",
                borderRadius: 8,
                border: "1.5px solid #E4DDD4",
                background: "#FDFCFB",
                fontSize: "0.75rem",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              }}>
                <span style={{ color: "#6B6B6B", whiteSpace: "nowrap" }}>
                  <strong style={{ color: "#0D0D0D" }}>{linearPayloadMeta?.task_count ?? 0} tasks</strong>
                  {" · "}
                  {linearPayloadMeta?.session_name}
                  {" · "}
                  {linearPayloadMeta?.generated_at
                    ? new Date(linearPayloadMeta.generated_at).toLocaleString()
                    : "unknown time"}
                </span>
                <button
                  onClick={async () => { await handlePushToLinear(); setShowLinearConfirm(false); }}
                  disabled={linearPushing}
                  style={{
                    padding: "2px 10px",
                    borderRadius: 6,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: "#E8561B",
                    color: "#FFFFFF",
                    border: "none",
                    cursor: linearPushing ? "not-allowed" : "pointer",
                    opacity: linearPushing ? 0.6 : 1,
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  }}
                >
                  {linearPushing ? "Pushing…" : "Confirm Push"}
                </button>
                <button
                  onClick={() => setShowLinearConfirm(false)}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    background: "transparent",
                    color: "#6B6B6B",
                    border: "1px solid #E4DDD4",
                    cursor: "pointer",
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            {/* Handoff status chips */}
            {handoffStatus === "success" && (
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "rgba(34,197,94,0.12)", color: "#15803D" }}>
                Handoff ready ✓
              </span>
            )}
            {handoffStatus === "error" && (
              <span
                title={handoffError ?? undefined}
                style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "rgba(239,68,68,0.12)", color: "#DC2626", cursor: handoffError ? "help" : "default", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {handoffError ? handoffError : "Handoff failed — try again"}
              </span>
            )}
            {/* View Handoff toggle (only when handoff exists) */}
            {handoff && (
              <button
                onClick={() => setShowHandoffPanel((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "0.4rem 0.875rem",
                  borderRadius: 8,
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  background: showHandoffPanel ? "rgba(232,86,27,0.06)" : "#FFFFFF",
                  border: "1.5px solid rgba(232,86,27,0.35)",
                  color: "#E8561B",
                  cursor: "pointer",
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  transition: "background 150ms ease",
                }}
              >
                {showHandoffPanel ? "Hide Handoff" : "View Handoff"}
              </button>
            )}
            {/* Export dropdown (only when handoff exists) */}
            {handoff && (
              <div ref={exportDropdownRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setShowExportDropdown((v) => !v)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "0.4rem 0.875rem",
                    borderRadius: 8,
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    background: "#FFFFFF",
                    border: "1.5px solid #E4DDD4",
                    color: "#0D0D0D",
                    cursor: "pointer",
                    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                    transition: "background 150ms ease",
                  }}
                >
                  Export for Agent ↓
                </button>
                {showExportDropdown && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, width: 200, background: "#FFF", border: "1px solid #E4DDD4", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 50, overflow: "hidden" }}>
                    {([
                      { label: "Export CLAUDE.md",    format: "claude_md"    },
                      { label: "Export .cursorrules", format: "cursor_rules" },
                      { label: "Copy task prompts",   format: "task_list"    },
                    ] as const).map(({ label, format }) => (
                      <button
                        key={format}
                        onClick={() => { exportHandoff(activeSessionId!, format); setShowExportDropdown(false); }}
                        style={{ width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 12.5, color: "#0D0D0D", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Generate Handoff button (when tasks exist) */}
            {tasks.length > 0 && (
              <button
                onClick={handleGenerateHandoff}
                disabled={handoffGenerating || !activeSessionId}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "0.4rem 0.875rem",
                  borderRadius: 8,
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  background: handoffGenerating || !activeSessionId ? "#F8F4EF" : "#FFFFFF",
                  border: "1.5px solid #E4DDD4",
                  color: handoffGenerating || !activeSessionId ? "#9E9E9E" : "#0D0D0D",
                  cursor: handoffGenerating || !activeSessionId ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  opacity: !activeSessionId ? 0.6 : 1,
                  transition: "background 150ms ease, border-color 150ms ease",
                }}
              >
                {handoffGenerating ? (
                  <TextShimmer duration={1.2}>Preparing handoff…</TextShimmer>
                ) : (
                  "Generate Handoff"
                )}
              </button>
            )}
            {prdStatus === "success" && (
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "rgba(34,197,94,0.12)", color: "#15803D" }}>
                PRD generated ✓
              </span>
            )}
            {prdStatus === "error" && (
              <span
                title={prdError ?? undefined}
                style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "rgba(239,68,68,0.12)", color: "#DC2626", cursor: "help", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {prdError ? `Error: ${prdError}` : "Failed — try again"}
              </span>
            )}
            {/* Navigate to PRD page */}
            <button
              onClick={() => router.push("/prd")}
              disabled={!activeSessionId}
              title={!activeSessionId ? "Select a session first" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "0.4rem 0.875rem",
                borderRadius: 8,
                fontSize: "0.8125rem",
                fontWeight: 500,
                background: "#FFFFFF",
                border: "1.5px solid #E4DDD4",
                color: !activeSessionId ? "#9E9E9E" : "#6B6B6B",
                cursor: !activeSessionId ? "not-allowed" : "pointer",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                opacity: !activeSessionId ? 0.6 : 1,
              }}
            >
              PRD
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
                <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {tasks.length > 0 && (
              <button
                onClick={handleGeneratePrd}
                disabled={prdGenerating || !activeSessionId}
                title={!activeSessionId ? "Select a session first" : undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "0.4rem 0.875rem",
                  borderRadius: 8,
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  background: "#FFFFFF",
                  border: "1.5px solid #E4DDD4",
                  color: prdGenerating || !activeSessionId ? "#9E9E9E" : "#6B6B6B",
                  cursor: prdGenerating || !activeSessionId ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                  opacity: prdGenerating || !activeSessionId ? 0.6 : 1,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  style={{ opacity: 0.5 }}
                >
                  <path
                    d="M2 9h8M6 2v5M3.5 5.5L6 8l2.5-2.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {prdGenerating ? "Generating PRD..." : "Generate PRD"}
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating || !activeSessionId || regenLimitReached}
              title={regenLimitReached ? "Limit reached. Use the editor." : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0.4rem 0.875rem",
                borderRadius: 8,
                fontSize: "0.8125rem",
                fontWeight: 500,
                background: generating || !activeSessionId || regenLimitReached ? "#F8F4EF" : "#FFFFFF",
                border: "1.5px solid #E4DDD4",
                color: generating || !activeSessionId || regenLimitReached ? "#9E9E9E" : "#0D0D0D",
                cursor: generating || !activeSessionId || regenLimitReached ? "not-allowed" : "pointer",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
            >
              {generating ? (
                <>
                  <TextShimmer duration={1.2}>Running…</TextShimmer>
                </>
              ) : !activeSessionId ? (
                "Select a session in Sessions"
              ) : (
                "Run Tasks (this step)"
              )}
            </button>
          </div>
        </header>

        {prdStatus === "error" && prdError && (
          <div style={{
            background: "rgba(239,68,68,0.07)",
            borderBottom: "1px solid rgba(239,68,68,0.15)",
            padding: "6px 20px",
            fontSize: 12.5,
            color: "#DC2626",
            flexShrink: 0,
          }}>
            PRD generation failed: {prdError}
          </div>
        )}

        {/* Content */}
        {!tasks.length && !generating ? (
          // Empty state
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 10,
                background: "rgba(232,86,27,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Checklist icon */}
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect
                  x="4"
                  y="4"
                  width="7"
                  height="7"
                  rx="1.5"
                  stroke="#E8561B"
                  strokeWidth="1.5"
                />
                <rect
                  x="4"
                  y="15"
                  width="7"
                  height="7"
                  rx="1.5"
                  stroke="#E8561B"
                  strokeWidth="1.5"
                />
                <line
                  x1="15"
                  y1="7.5"
                  x2="24"
                  y2="7.5"
                  stroke="#E8561B"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="15"
                  y1="18.5"
                  x2="24"
                  y2="18.5"
                  stroke="#E8561B"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#0D0D0D",
                  margin: 0,
                }}
              >
                No tasks generated yet.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={!activeSessionId}
              className="btn-dark"
              style={{
                fontSize: "0.8125rem",
                padding: "0.45rem 1rem",
                marginTop: 4,
                opacity: !activeSessionId ? 0.6 : 1,
                cursor: !activeSessionId ? "not-allowed" : "pointer",
              }}
            >
              {!activeSessionId
                ? "Select a session in Sessions"
                : "Run Tasks (this step)"}
            </button>
          </div>
        ) : generating ? (
          // Generating state
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <div
              style={{ fontSize: 13, color: "#9E9E9E" }}
            >
              <TextShimmer duration={1.2}>Generating tasks…</TextShimmer>
            </div>
          </div>
        ) : (
          // Two-column layout
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* LEFT PANEL — Task groups */}
            <div
              style={{
                width: 300,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                borderRight: "1px solid #E4DDD4",
                background: "#FFFFFF",
                overflow: "hidden",
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #E4DDD4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#9E9E9E",
                  }}
                >
                  Tasks
                </span>
                <span style={{ fontSize: 11, color: "#6B6B6B" }}>
                  {tasks.length} total
                </span>
              </div>

              {/* Scrollable group list */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {tasksByGroup.map(({ type, tasks: groupTasks }) => {
                  const expanded = expandedGroups.has(type);
                  return (
                    <div key={type}>
                      {/* Group header */}
                      <button
                        onClick={() => toggleGroup(type)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 16px",
                          borderBottom: "1px solid #F0EDE9",
                          background: "#FFFFFF",
                          cursor: "pointer",
                          border: "none",
                          borderBottomWidth: 1,
                          borderBottomStyle: "solid",
                          borderBottomColor: "#F0EDE9",
                          fontFamily:
                            "var(--font-dm-sans), 'DM Sans', sans-serif",
                          transition: "background 120ms ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "rgba(0,0,0,0.02)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#FFFFFF";
                        }}
                      >
                        {/* Chevron */}
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          style={{
                            transform: expanded
                              ? "rotate(90deg)"
                              : "rotate(0deg)",
                            transition: "transform 150ms ease",
                            flexShrink: 0,
                            color: "#9E9E9E",
                          }}
                        >
                          <path
                            d="M4 2.5L8 6L4 9.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>

                        {/* Type badge */}
                        <TypeBadge type={type} />

                        {/* Task count — pushed right */}
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 11,
                            color: "#9E9E9E",
                          }}
                        >
                          {groupTasks.length}
                        </span>
                      </button>

                      {/* Task rows */}
                      {expanded &&
                        groupTasks.map((task) => {
                          const active = selectedId === task.id;
                          const status = effectiveStatus(task);
                          const pri = PRIORITY_COLORS[task.priority];
                          return (
                            <button
                              key={task.id}
                              onClick={() => setSelectedId(task.id)}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                display: "flex",
                                alignItems: "center",
                                gap: 9,
                                padding: "9px 16px 9px 28px",
                                borderBottom: "1px solid #F0EDE9",
                                borderLeft: active
                                  ? "3px solid #E8561B"
                                  : "3px solid transparent",
                                background: active
                                  ? "rgba(232,86,27,0.04)"
                                  : "transparent",
                                cursor: "pointer",
                                border: "none",
                                borderLeftWidth: 3,
                                borderLeftStyle: "solid",
                                borderLeftColor: active
                                  ? "#E8561B"
                                  : "transparent",
                                borderBottomWidth: 1,
                                borderBottomStyle: "solid",
                                borderBottomColor: "#F0EDE9",
                                fontFamily:
                                  "var(--font-dm-sans), 'DM Sans', sans-serif",
                                transition:
                                  "background 120ms ease, border-color 120ms ease",
                              }}
                              onMouseEnter={(e) => {
                                if (!active)
                                  e.currentTarget.style.background =
                                    "rgba(0,0,0,0.02)";
                              }}
                              onMouseLeave={(e) => {
                                if (!active)
                                  e.currentTarget.style.background =
                                    "transparent";
                              }}
                            >
                              {/* Status dot */}
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: STATUS_DOT[status],
                                  flexShrink: 0,
                                }}
                              />

                              {/* Title */}
                              <span
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: active ? 500 : 400,
                                  color: "#0D0D0D",
                                  lineHeight: 1.4,
                                  flex: 1,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {task.title}
                              </span>

                              {/* Quality warning icon */}
                              {task.qualityFlag && (
                                <span
                                  title={task.qualityIssues?.join("\n") ?? "Quality issues detected"}
                                  style={{ fontSize: 11, color: "#D97706", flexShrink: 0, cursor: "help", lineHeight: 1 }}
                                >
                                  ⚠
                                </span>
                              )}

                              {/* Priority chip */}
                              <span
                                style={{
                                  fontSize: 10.5,
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                  background: pri.bg,
                                  color: pri.color,
                                  fontWeight: 500,
                                  flexShrink: 0,
                                }}
                              >
                                {task.priority}
                              </span>
                              <CitationBadge sourceIds={task.source_ids ?? []} confidence={task.citation_confidence as "high" | "medium" | "insufficient" | undefined} />
                            </button>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT PANEL — Task detail */}
            {selectedTask ? (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "24px 28px",
                  background: "#F8F4EF",
                }}
              >
                {/* Title row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <h1
                    style={{
                      fontSize: 19,
                      fontWeight: 500,
                      color: "#0D0D0D",
                      letterSpacing: "-0.02em",
                      lineHeight: 1.3,
                      margin: 0,
                      flex: 1,
                    }}
                  >
                    {selectedTask.title}
                  </h1>
                  <TypeBadge type={selectedTask.type} />
                </div>

                {/* Status toggle */}
                <div style={{ display: "flex", gap: 6, marginBottom: 2 }}>
                  {(["todo", "in-progress", "done"] as TaskStatus[]).map(
                    (s) => {
                      const active = effectiveStatus(selectedTask) === s;
                      const label =
                        s === "todo"
                          ? "Todo"
                          : s === "in-progress"
                          ? "In Progress"
                          : "Done";
                      return (
                        <button
                          key={s}
                          onClick={() => setStatus(selectedTask.id, s)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            background: active
                              ? "rgba(232,86,27,0.08)"
                              : "#FFFFFF",
                            border: active
                              ? "1.5px solid #E8561B"
                              : "1.5px solid #E4DDD4",
                            color: active ? "#0D0D0D" : "#6B6B6B",
                            cursor: "pointer",
                            fontFamily:
                              "var(--font-dm-sans), 'DM Sans', sans-serif",
                            transition:
                              "background 120ms ease, border-color 120ms ease, color 120ms ease",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: STATUS_DOT[s],
                              flexShrink: 0,
                            }}
                          />
                          {label}
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Divider */}
                <div
                  style={{
                    height: 1,
                    background: "#E4DDD4",
                    margin: "18px 0 0",
                  }}
                />

                {/* Description */}
                <SectionLabel>Description</SectionLabel>
                <p
                  style={{
                    fontSize: 13,
                    color: "#3D3D3D",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {selectedTask.description}
                </p>

                {/* Quality Issues */}
                {selectedTask.qualityIssues && selectedTask.qualityIssues.length > 0 && (
                  <>
                    <SectionLabel>Quality Issues</SectionLabel>
                    <div
                      style={{
                        background: "rgba(245,158,11,0.07)",
                        border: "1px solid rgba(245,158,11,0.25)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {selectedTask.qualityIssues.map((issue, i) => (
                        <div
                          key={i}
                          style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
                        >
                          <span style={{ color: "#D97706", flexShrink: 0, fontSize: 12, lineHeight: 1.6 }}>
                            ⚠
                          </span>
                          <span style={{ fontSize: 12.5, color: "#92400E", lineHeight: 1.6 }}>
                            {issue}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Steps */}
                <SectionLabel>Steps</SectionLabel>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: "2px 0",
                  }}
                >
                  {selectedTask.steps.map((step) => {
                    const done = isStepDone(selectedTask.id, step);
                    return (
                      <button
                        key={step.id}
                        onClick={() =>
                          toggleStep(selectedTask.id, step.id, done)
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          textAlign: "left",
                          fontFamily:
                            "var(--font-dm-sans), 'DM Sans', sans-serif",
                        }}
                      >
                        {/* Checkbox */}
                        <span
                          style={{
                            width: 15,
                            height: 15,
                            borderRadius: 3,
                            border: done
                              ? "none"
                              : "1.5px solid #C8C2BB",
                            background: done ? "#E8561B" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            transition: "background 150ms ease, border 150ms ease",
                          }}
                        >
                          {done && (
                            <svg
                              width="9"
                              height="9"
                              viewBox="0 0 9 9"
                              fill="none"
                            >
                              <path
                                d="M1.5 4.5L3.5 6.5L7.5 2.5"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: done ? "#9E9E9E" : "#0D0D0D",
                            textDecoration: done ? "line-through" : "none",
                            lineHeight: 1.5,
                            transition: "color 150ms ease",
                          }}
                        >
                          {step.title}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Dependencies */}
                <SectionLabel>Dependencies</SectionLabel>
                {selectedTask.dependencies.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "#C8C2BB", margin: 0 }}>
                    No dependencies
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {selectedTask.dependencies.map((dep, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            color: "#E8561B",
                            flexShrink: 0,
                            lineHeight: 1.5,
                          }}
                        >
                          →
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: "#3D3D3D",
                            lineHeight: 1.5,
                          }}
                        >
                          {dep}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom padding */}
                <div style={{ height: 32 }} />
              </div>
            ) : (
              // No task selected
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <p style={{ fontSize: 13, color: "#C8C2BB" }}>
                  Select a task to view details
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <OrphanedPipelineModal
        open={showOrphanedModal}
        onClose={closeOrphanedModal}
        pipelineOutput={orphanedOutput}
      />
      <ConversationPanel
        sessionId={activeSessionId}
        contextKeys={["problems", "features", "decompositions", "tasks"]}
        mode="float"
      />
      {showHandoffPanel && handoff && activeSessionId && (
        <HandoffSummaryPanel
          handoff={handoff}
          sessionId={activeSessionId}
          expandedTask={expandedHandoffTask}
          onExpandTask={setExpandedHandoffTask}
          onClose={() => setShowHandoffPanel(false)}
        />
      )}
    </div>
  );
}
