"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import {
  createSession,
  runSession,
  getSession,
} from "@/lib/api/session";
import type { SessionDetail, SessionEvent } from "@/lib/api/session";

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { id: "problems", label: "Problems", description: "Surface pain points" },
  { id: "features", label: "Features", description: "Define capabilities" },
  { id: "decompose", label: "Decompose", description: "Break into components" },
  { id: "tasks", label: "Tasks", description: "Generate action items" },
];

const LS_KEY = "specflow_sessions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoredSession {
  session_id: string;
  project_id: string;
  user_id: string;
  status: string;
  created_at: string | null;
}

type StepStatus = "pending" | "completed" | "failed" | "running";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStepStatuses(
  detail: SessionDetail | null
): Record<string, StepStatus> {
  const result: Record<string, StepStatus> = {};
  PIPELINE_STEPS.forEach((s) => {
    result[s.id] = "pending";
  });
  if (!detail) return result;

  const { session, state } = detail;
  const lastCompleted = state?.state?.last_completed_step ?? null;

  if (session.status === "completed") {
    PIPELINE_STEPS.forEach((s) => {
      result[s.id] = "completed";
    });
    return result;
  }

  if (lastCompleted) {
    for (const step of PIPELINE_STEPS) {
      result[step.id] = "completed";
      if (step.id === lastCompleted) break;
    }
  }

  if (session.status === "failed") {
    const lastIdx = lastCompleted
      ? PIPELINE_STEPS.findIndex((s) => s.id === lastCompleted)
      : -1;
    const failedIdx = lastIdx + 1;
    if (failedIdx >= 0 && failedIdx < PIPELINE_STEPS.length) {
      result[PIPELINE_STEPS[failedIdx].id] = "failed";
    }
  }

  return result;
}

function getNextStep(statuses: Record<string, StepStatus>): string | null {
  for (const step of PIPELINE_STEPS) {
    if (statuses[step.id] === "pending") return step.id;
  }
  return null;
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getOutputSummary(detail: SessionDetail | null): string[] {
  if (!detail?.state?.state?.outputs) return [];
  return Object.entries(detail.state.state.outputs).map(([key, val]) => {
    const count = Array.isArray(val) ? val.length : typeof val === "object" && val ? Object.keys(val as object).length : 1;
    return `${key}: ${count} item${count !== 1 ? "s" : ""}`;
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  active:    { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA", dot: "#F59E0B" },
  completed: { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0", dot: "#22C55E" },
  failed:    { bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA", dot: "#EF4444" },
  partial:   { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", dot: "#F59E0B" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.active;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: s.dot,
          flexShrink: 0,
          ...(status === "active" ? { animation: "pulse 1.8s ease-in-out infinite" } : {}),
        }}
      />
      {status}
    </span>
  );
}

function StepTracker({ statuses, running }: { statuses: Record<string, StepStatus>; running: boolean }) {
  const STEP_COLORS: Record<StepStatus, { bg: string; border: string; text: string; icon: string }> = {
    pending:   { bg: "#F8F4EF", border: "#E4DDD4", text: "#9B9189", icon: "#C8C0B8" },
    completed: { bg: "#F0FDF4", border: "#86EFAC", text: "#15803D", icon: "#22C55E" },
    failed:    { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C", icon: "#EF4444" },
    running:   { bg: "rgba(232,86,27,0.08)", border: "#E8561B", text: "#E8561B", icon: "#E8561B" },
  };

  // Determine which step is "running" (the one being run right now)
  const runningStep = running ? PIPELINE_STEPS.find((s) => statuses[s.id] === "pending")?.id : null;
  const effectiveStatuses = { ...statuses };
  if (runningStep) effectiveStatuses[runningStep] = "running";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {PIPELINE_STEPS.map((step, i) => {
        const st = effectiveStatuses[step.id];
        const c = STEP_COLORS[st];
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            {/* Step node */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: c.bg,
                  border: `1.5px solid ${c.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.3s ease",
                  ...(st === "running" ? { animation: "stepPulse 1.8s ease-in-out infinite" } : {}),
                }}
              >
                {st === "completed" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : st === "failed" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : st === "running" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.7s linear infinite" }}>
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                ) : (
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.icon }} />
                )}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: c.text, letterSpacing: "0.01em" }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 10, color: "#9B9189", marginTop: 1 }}>{step.description}</div>
              </div>
            </div>
            {/* Connector line */}
            {i < PIPELINE_STEPS.length - 1 && (
              <div
                style={{
                  height: 1.5,
                  width: 24,
                  marginBottom: 26,
                  background: effectiveStatuses[PIPELINE_STEPS[i + 1].id] === "pending" ? "#E4DDD4" : "#86EFAC",
                  transition: "background 0.4s ease",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    input:      { bg: "#EFF6FF", color: "#3B82F6" },
    output:     { bg: "#F0FDF4", color: "#22C55E" },
    agent_step: { bg: "rgba(232,86,27,0.10)", color: "#E8561B" },
    message:    { bg: "#F5F3FF", color: "#7C3AED" },
  };
  const s = map[type] ?? { bg: "#F8F4EF", color: "#6B6B6B" };
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        background: s.bg,
        color: s.color,
        flexShrink: 0,
      }}
    >
      {type.replace("_", " ")}
    </span>
  );
}

function EventLogRow({ event }: { event: SessionEvent }) {
  const isStep = event.type === "agent_step";
  const status = event.payload.status as string | undefined;
  const agent = event.payload.agent as string | undefined;
  const error = event.payload.error as string | undefined;
  const keys = event.payload.keys as string[] | undefined;

  let description = "";
  if (isStep && agent) {
    description = `${agent} — ${status ?? ""}`;
    if (error) description += `: ${error}`;
  } else if (event.type === "output" && keys) {
    description = `outputs: ${keys.join(", ")}`;
  } else if (event.type === "input") {
    description = "pipeline input received";
  } else {
    const k = Object.keys(event.payload).slice(0, 2);
    description = k.map((key) => `${key}: ${JSON.stringify(event.payload[key])}`).join(" · ");
  }

  const isError = status === "failed";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "7px 0",
        borderBottom: "1px solid #F0EAE1",
      }}
    >
      <span style={{ fontSize: 10.5, color: "#9B9189", fontFamily: "monospace", flexShrink: 0, marginTop: 2 }}>
        {formatTs(event.timestamp)}
      </span>
      <EventBadge type={event.type} />
      <span
        style={{
          fontSize: 12.5,
          color: isError ? "#DC2626" : "#3a3530",
          lineHeight: 1.4,
          wordBreak: "break-word",
        }}
      >
        {description}
      </span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Ingest form state
  const [activeTab, setActiveTab] = useState<"interview" | "product_data">("interview");
  const [interviewContent, setInterviewContent] = useState("");
  const [interviewMeta, setInterviewMeta] = useState({ user: "", pain: "", context: "" });
  const [productContent, setProductContent] = useState("");
  const [productMeta, setProductMeta] = useState({ dropOffRate: "", activeUsers: "" });

  // Create form state
  const [newProjectId, setNewProjectId] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSessions(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  // Persist sessions to localStorage
  const persistSessions = useCallback((updated: StoredSession[]) => {
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    setSessions(updated);
  }, []);

  // Load detail when session selected
  const loadDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    setRunError(null);
    try {
      const d = await getSession(id);
      setDetail(d);
      // Update stored status
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.session_id === id ? { ...s, status: d.session.status } : s
        );
        localStorage.setItem(LS_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      setDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const handleSelectSession = useCallback(
    (id: string) => {
      setSelectedId(id);
      setRunError(null);
      loadDetail(id);
    },
    [loadDetail]
  );

  // Create session
  const handleCreate = useCallback(async () => {
    if (!newProjectId.trim() || !newUserId.trim()) {
      setCreateError("Both project ID and user ID are required.");
      return;
    }
    setCreateError(null);
    setIsCreatingSession(true);
    try {
      const result = await createSession(newProjectId.trim(), newUserId.trim());
      const stored: StoredSession = {
        session_id: result.session_id,
        project_id: newProjectId.trim(),
        user_id: newUserId.trim(),
        status: result.status,
        created_at: result.created_at,
      };
      const updated = [stored, ...sessions];
      persistSessions(updated);
      setNewProjectId("");
      setNewUserId("");
      setIsCreating(false);
      setSelectedId(result.session_id);
      loadDetail(result.session_id);
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setIsCreatingSession(false);
    }
  }, [newProjectId, newUserId, sessions, persistSessions, loadDetail]);

  // Build inputData from the ingest form
  const buildInputData = useCallback((): Record<string, unknown> => {
    const entry =
      activeTab === "interview"
        ? {
            id: crypto.randomUUID(),
            type: "interview",
            content: interviewContent,
            metadata: interviewMeta,
            createdAt: new Date().toISOString(),
          }
        : {
            id: crypto.randomUUID(),
            type: "product_data",
            content: productContent,
            metadata: { metrics: productMeta },
            createdAt: new Date().toISOString(),
          };

    // Persist to ingest_entries (max 10)
    try {
      const existing = JSON.parse(localStorage.getItem("ingest_entries") || "[]");
      localStorage.setItem("ingest_entries", JSON.stringify([entry, ...existing].slice(0, 10)));
    } catch { /* ignore */ }

    return {
      context: (() => { try { return JSON.parse(localStorage.getItem("specflow_context") || "{}"); } catch { return {}; } })(),
      research: [],
      ingest: [entry],
    };
  }, [activeTab, interviewContent, interviewMeta, productContent, productMeta]);

  // Run pipeline
  const handleRun = useCallback(
    async (step?: string) => {
      if (!selectedId) return;
      setRunError(null);

      const inputData = buildInputData();

      // Full run: save input for pipeline pages and navigate immediately
      if (!step) {
        try {
          localStorage.setItem("specflow_pending_input", JSON.stringify(inputData));
          localStorage.setItem("specflow_autorun", "1");
        } catch { /* ignore */ }
        router.push("/problems");
        return;
      }

      // Single step run via session API
      setIsRunning(true);
      try {
        await runSession(selectedId, inputData, step);
        await loadDetail(selectedId);
      } catch (e) {
        setRunError(String(e));
        await loadDetail(selectedId);
      } finally {
        setIsRunning(false);
      }
    },
    [selectedId, buildInputData, loadDetail, router]
  );

  const stepStatuses = computeStepStatuses(detail);
  const nextStep = getNextStep(stepStatuses);
  const isSessionDone = detail?.session.status === "completed";
  const isSessionFailed = detail?.session.status === "failed";
  const outputSummary = getOutputSummary(detail);
  const selectedStored = sessions.find((s) => s.session_id === selectedId);

  return (
    <>
      <div style={{ display: "flex", height: "100vh", background: "#F8F4EF", fontFamily: "'DM Sans', sans-serif" }}>
        <Sidebar />

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Top bar */}
          <div
            style={{
              height: 52,
              borderBottom: "1px solid #E4DDD4",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 20px",
              background: "#FFFFFF",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#6B6B6B", fontWeight: 400 }}>Signals</span>
              <span style={{ color: "#C8C0B8", fontSize: 13 }}>›</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#0D0D0D" }}>Sessions</span>
              <span
                style={{
                  marginLeft: 6,
                  background: "rgba(232,86,27,0.10)",
                  color: "#E8561B",
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: "1px 7px",
                  borderRadius: 20,
                  letterSpacing: "0.04em",
                }}
              >
                {sessions.length}
              </span>
            </div>
            <button
              onClick={() => { setIsCreating(true); setCreateError(null); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 8,
                background: "#0D0D0D",
                color: "#FFFFFF",
                border: "none",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.18s ease",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#2a2a2a"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#0D0D0D"; (e.currentTarget as HTMLElement).style.transform = ""; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Session
            </button>
          </div>

          {/* Body: two-panel layout */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* ── Left panel: Session list ──────────────────────────────────── */}
            <div
              style={{
                width: 300,
                borderRight: "1px solid #E4DDD4",
                display: "flex",
                flexDirection: "column",
                background: "#FFFFFF",
                flexShrink: 0,
              }}
            >
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #F0EAE1" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Recent Sessions
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                {sessions.length === 0 ? (
                  <div style={{ padding: "32px 20px", textAlign: "center" }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "rgba(232,86,27,0.08)",
                        border: "1px solid rgba(232,86,27,0.16)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8561B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: "#0D0D0D", marginBottom: 5 }}>No sessions yet</div>
                    <div style={{ fontSize: 12, color: "#9B9189", lineHeight: 1.5 }}>Create a session to run the pipeline in steps</div>
                  </div>
                ) : (
                  sessions.map((s) => {
                    const isSelected = s.session_id === selectedId;
                    return (
                      <button
                        key={s.session_id}
                        onClick={() => handleSelectSession(s.session_id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 14px",
                          background: isSelected ? "rgba(232,86,27,0.06)" : "transparent",
                          borderLeft: isSelected ? "2px solid #E8561B" : "2px solid transparent",
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          display: "block",
                        }}
                        onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.025)"; }}
                        onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#0D0D0D", fontFamily: "monospace" }}>
                            {shortId(s.session_id)}
                          </span>
                          <StatusBadge status={s.status} />
                        </div>
                        <div style={{ fontSize: 11.5, color: "#6B6B6B", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.project_id}
                        </div>
                        <div style={{ fontSize: 11, color: "#9B9189" }}>
                          {relativeTime(s.created_at)} · {s.user_id}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Right panel: Session detail ──────────────────────────────── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", minWidth: 0 }}>
              {!selectedId ? (
                /* Empty state */
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                    animation: "fadeUp 0.5s ease",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      background: "rgba(232,86,27,0.08)",
                      border: "1px solid rgba(232,86,27,0.18)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E8561B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "#0D0D0D", marginBottom: 6 }}>
                      Select a session
                    </div>
                    <div style={{ fontSize: 13.5, color: "#9B9189", lineHeight: 1.6 }}>
                      Choose from the list or create a new session<br />to run the pipeline step by step.
                    </div>
                  </div>
                </div>
              ) : isLoadingDetail ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 10 }}>
                  <span style={{ width: 18, height: 18, border: "2px solid #E4DDD4", borderTop: "2px solid #E8561B", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  <span style={{ fontSize: 13.5, color: "#9B9189" }}>Loading session…</span>
                </div>
              ) : (
                <div style={{ animation: "fadeUp 0.4s ease", maxWidth: 760 }}>

                  {/* Session header */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E4DDD4",
                      borderRadius: 14,
                      padding: "18px 22px",
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                          Session
                        </div>
                        <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: "#0D0D0D", letterSpacing: "0.02em" }}>
                          {selectedId}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {detail && <StatusBadge status={detail.session.status} />}
                        <button
                          onClick={() => loadDetail(selectedId)}
                          title="Refresh"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            border: "1px solid #E4DDD4",
                            background: "#F8F4EF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E8561B"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E4DDD4"; }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {detail && (
                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                        {[
                          { label: "Project", value: detail.session.project_id },
                          { label: "User", value: detail.session.user_id },
                          { label: "Created", value: relativeTime(detail.session.created_at) },
                          { label: "Updated", value: relativeTime(detail.session.updated_at) },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div style={{ fontSize: 10.5, color: "#9B9189", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 12.5, color: "#3a3530", fontWeight: 500 }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pipeline step tracker */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E4DDD4",
                      borderRadius: 14,
                      padding: "18px 22px",
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>
                      Pipeline Progress
                    </div>
                    <StepTracker statuses={stepStatuses} running={isRunning} />
                  </div>

                  {/* Run controls */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E4DDD4",
                      borderRadius: 14,
                      padding: "18px 22px",
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
                      Run Controls
                    </div>

                    {isSessionDone ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#15803D", fontSize: 13.5 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        Session completed — all steps finished successfully.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {/* Run All */}
                        <button
                          onClick={() => handleRun()}
                          disabled={isRunning || isSessionDone}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            padding: "8px 16px",
                            borderRadius: 9,
                            background: isRunning ? "#F0EAE1" : "#0D0D0D",
                            color: isRunning ? "#9B9189" : "#FFFFFF",
                            border: "none",
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: isRunning ? "not-allowed" : "pointer",
                            transition: "all 0.18s ease",
                          }}
                          onMouseEnter={(e) => { if (!isRunning) { (e.currentTarget as HTMLElement).style.background = "#2a2a2a"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; } }}
                          onMouseLeave={(e) => { if (!isRunning) { (e.currentTarget as HTMLElement).style.background = "#0D0D0D"; (e.currentTarget as HTMLElement).style.transform = ""; } }}
                        >
                          {isRunning ? (
                            <span style={{ width: 13, height: 13, border: "1.5px solid #C8C0B8", borderTop: "1.5px solid #E8561B", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          )}
                          {isRunning ? "Running…" : "Run All Steps"}
                        </button>

                        {/* Run Next Step */}
                        {nextStep && (
                          <button
                            onClick={() => handleRun(nextStep)}
                            disabled={isRunning}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                              padding: "8px 16px",
                              borderRadius: 9,
                              background: "#FFF7ED",
                              color: "#C2410C",
                              border: "1.5px solid #FED7AA",
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: isRunning ? "not-allowed" : "pointer",
                              transition: "all 0.18s ease",
                            }}
                            onMouseEnter={(e) => { if (!isRunning) { (e.currentTarget as HTMLElement).style.background = "#FFEDD5"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; } }}
                            onMouseLeave={(e) => { if (!isRunning) { (e.currentTarget as HTMLElement).style.background = "#FFF7ED"; (e.currentTarget as HTMLElement).style.transform = ""; } }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            Run Next: {PIPELINE_STEPS.find((s) => s.id === nextStep)?.label}
                          </button>
                        )}

                        {/* Individual step buttons */}
                        {PIPELINE_STEPS.filter((s) => stepStatuses[s.id] === "pending" || stepStatuses[s.id] === "failed").map((step) => (
                          step.id !== nextStep ? (
                            <button
                              key={step.id}
                              onClick={() => handleRun(step.id)}
                              disabled={isRunning}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "7px 12px",
                                borderRadius: 8,
                                background: stepStatuses[step.id] === "failed" ? "#FEF2F2" : "#F8F4EF",
                                color: stepStatuses[step.id] === "failed" ? "#B91C1C" : "#6B6B6B",
                                border: `1px solid ${stepStatuses[step.id] === "failed" ? "#FECACA" : "#E4DDD4"}`,
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: isRunning ? "not-allowed" : "pointer",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => { if (!isRunning) { (e.currentTarget as HTMLElement).style.borderColor = "#E8561B"; } }}
                              onMouseLeave={(e) => { if (!isRunning) { (e.currentTarget as HTMLElement).style.borderColor = stepStatuses[step.id] === "failed" ? "#FECACA" : "#E4DDD4"; } }}
                            >
                              {stepStatuses[step.id] === "failed" && (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                  <line x1="12" y1="9" x2="12" y2="13" />
                                </svg>
                              )}
                              Retry: {step.label}
                            </button>
                          ) : null
                        ))}
                      </div>
                    )}

                    {/* Run error */}
                    {runError && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: "10px 14px",
                          background: "#FEF2F2",
                          border: "1px solid #FECACA",
                          borderRadius: 8,
                          fontSize: 12.5,
                          color: "#B91C1C",
                          lineHeight: 1.5,
                        }}
                      >
                        {runError}
                      </div>
                    )}
                  </div>

                  {/* Input data — structured ingest form */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E4DDD4",
                      borderRadius: 14,
                      padding: "18px 22px",
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
                      Input Data
                    </div>

                    {/* Tabs */}
                    <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#F8F4EF", borderRadius: 9, padding: 3 }}>
                      {(["interview", "product_data"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          style={{
                            flex: 1,
                            padding: "6px 12px",
                            borderRadius: 7,
                            border: "none",
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: "pointer",
                            transition: "all 0.18s ease",
                            background: activeTab === tab ? "#FFFFFF" : "transparent",
                            color: activeTab === tab ? "#0D0D0D" : "#9B9189",
                            boxShadow: activeTab === tab ? "0 1px 4px rgba(13,13,13,0.08)" : "none",
                          }}
                        >
                          {tab === "interview" ? "Interview" : "Product Data"}
                        </button>
                      ))}
                    </div>

                    {activeTab === "interview" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <textarea
                          value={interviewContent}
                          onChange={(e) => setInterviewContent(e.target.value)}
                          placeholder="Paste interview notes, transcripts, or customer feedback…"
                          rows={5}
                          style={{ width: "100%", padding: "10px 12px", background: "#F8F4EF", border: "1.5px solid #E4DDD4", borderRadius: 9, fontSize: 13, color: "#0D0D0D", lineHeight: 1.6, resize: "vertical", fontFamily: "inherit" }}
                          onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E8561B"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                          onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E4DDD4"; (e.currentTarget as HTMLElement).style.background = "#F8F4EF"; }}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                          {[
                            { key: "user", label: "Interviewee", placeholder: "Sarah, PM at Acme" },
                            { key: "pain", label: "Pain Point", placeholder: "slow onboarding" },
                            { key: "context", label: "Context", placeholder: "enterprise trial user" },
                          ].map(({ key, label, placeholder }) => (
                            <div key={key}>
                              <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "#9B9189", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>{label}</label>
                              <input
                                type="text"
                                value={interviewMeta[key as keyof typeof interviewMeta]}
                                onChange={(e) => setInterviewMeta((prev) => ({ ...prev, [key]: e.target.value }))}
                                placeholder={placeholder}
                                style={{ width: "100%", padding: "7px 10px", background: "#F8F4EF", border: "1.5px solid #E4DDD4", borderRadius: 8, fontSize: 12.5, color: "#0D0D0D", fontFamily: "inherit" }}
                                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E8561B"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E4DDD4"; (e.currentTarget as HTMLElement).style.background = "#F8F4EF"; }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <textarea
                          value={productContent}
                          onChange={(e) => setProductContent(e.target.value)}
                          placeholder="Paste product analytics, logs, or raw usage data…"
                          rows={5}
                          style={{ width: "100%", padding: "10px 12px", background: "#F8F4EF", border: "1.5px solid #E4DDD4", borderRadius: 9, fontSize: 13, color: "#0D0D0D", lineHeight: 1.6, resize: "vertical", fontFamily: "inherit" }}
                          onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E8561B"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                          onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E4DDD4"; (e.currentTarget as HTMLElement).style.background = "#F8F4EF"; }}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {[
                            { key: "dropOffRate", label: "Drop-off Rate (%)", placeholder: "42" },
                            { key: "activeUsers", label: "Active Users", placeholder: "1200" },
                          ].map(({ key, label, placeholder }) => (
                            <div key={key}>
                              <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "#9B9189", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>{label}</label>
                              <input
                                type="number"
                                value={productMeta[key as keyof typeof productMeta]}
                                onChange={(e) => setProductMeta((prev) => ({ ...prev, [key]: e.target.value }))}
                                placeholder={placeholder}
                                style={{ width: "100%", padding: "7px 10px", background: "#F8F4EF", border: "1.5px solid #E4DDD4", borderRadius: 8, fontSize: 12.5, color: "#0D0D0D", fontFamily: "inherit" }}
                                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E8561B"; (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E4DDD4"; (e.currentTarget as HTMLElement).style.background = "#F8F4EF"; }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Outputs summary */}
                  {outputSummary.length > 0 && (
                    <div
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E4DDD4",
                        borderRadius: 14,
                        padding: "18px 22px",
                        marginBottom: 18,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                        Outputs
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {outputSummary.map((line) => (
                          <div
                            key={line}
                            style={{
                              padding: "5px 12px",
                              background: "#F0FDF4",
                              border: "1px solid #BBF7D0",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 500,
                              color: "#15803D",
                            }}
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Event log */}
                  {detail && detail.events.length > 0 && (
                    <div
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E4DDD4",
                        borderRadius: 14,
                        padding: "18px 22px",
                        marginBottom: 18,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                          Event Log
                        </div>
                        <span style={{ fontSize: 11, color: "#9B9189" }}>{detail.events.length} event{detail.events.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div>
                        {detail.events.map((event) => (
                          <EventLogRow key={event.id} event={event} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty event log notice */}
                  {detail && detail.events.length === 0 && (
                    <div style={{ padding: "20px 22px", background: "#FFFFFF", border: "1px solid #E4DDD4", borderRadius: 14, marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Event Log</div>
                      <div style={{ fontSize: 12.5, color: "#9B9189" }}>No events yet — run the pipeline to see activity.</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Create Session Modal ──────────────────────────────────────────────── */}
      {isCreating && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(13,13,13,0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            animation: "fadeUp 0.2s ease",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsCreating(false); }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              padding: "28px 28px 24px",
              width: 440,
              boxShadow: "0 24px 60px rgba(13,13,13,0.18), 0 4px 16px rgba(13,13,13,0.08)",
              border: "1px solid #E4DDD4",
            }}
          >
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "#0D0D0D", marginBottom: 5 }}>
                New Session
              </div>
              <div style={{ fontSize: 13, color: "#9B9189", lineHeight: 1.5 }}>
                Create a session to run the pipeline with resumable, step-by-step control.
              </div>
            </div>

            {[
              { label: "Project ID", placeholder: "e.g. my-product-q1", value: newProjectId, setter: setNewProjectId },
              { label: "User ID", placeholder: "e.g. user-123 or you@example.com", value: newUserId, setter: setNewUserId },
            ].map(({ label, placeholder, value, setter }) => (
              <div key={label} style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#3a3530", marginBottom: 6, letterSpacing: "0.02em" }}>
                  {label}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => { setter(e.target.value); setCreateError(null); }}
                  placeholder={placeholder}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "#F8F4EF",
                    border: "1.5px solid #E4DDD4",
                    borderRadius: 9,
                    fontSize: 13.5,
                    color: "#0D0D0D",
                    fontFamily: "'DM Sans', sans-serif",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E8561B"; (e.currentTarget as HTMLElement).style.background = "#FFFFFF"; }}
                  onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E4DDD4"; (e.currentTarget as HTMLElement).style.background = "#F8F4EF"; }}
                />
              </div>
            ))}

            {createError && (
              <div style={{ marginBottom: 14, padding: "9px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12.5, color: "#B91C1C" }}>
                {createError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                onClick={() => setIsCreating(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9,
                  background: "#F8F4EF",
                  color: "#6B6B6B",
                  border: "1px solid #E4DDD4",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F0EAE1"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F8F4EF"; }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreatingSession}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 20px",
                  borderRadius: 9,
                  background: isCreatingSession ? "#F0EAE1" : "#0D0D0D",
                  color: isCreatingSession ? "#9B9189" : "#FFFFFF",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: isCreatingSession ? "not-allowed" : "pointer",
                  transition: "all 0.18s ease",
                }}
                onMouseEnter={(e) => { if (!isCreatingSession) { (e.currentTarget as HTMLElement).style.background = "#2a2a2a"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; } }}
                onMouseLeave={(e) => { if (!isCreatingSession) { (e.currentTarget as HTMLElement).style.background = "#0D0D0D"; (e.currentTarget as HTMLElement).style.transform = ""; } }}
              >
                {isCreatingSession ? (
                  <>
                    <span style={{ width: 12, height: 12, border: "1.5px solid #C8C0B8", borderTop: "1.5px solid #E8561B", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                    Creating…
                  </>
                ) : "Create Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
