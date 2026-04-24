"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import {
  createSession,
  runSession,
  getSession,
  getLastSessionMode,
  getHandoff,
  generateHandoff,
  exportHandoff,
  normalizeHandoffTasks,
} from "@/lib/api/session";
import type { SessionDetail, SessionEvent, AgentHandoff } from "@/lib/api/session";
import dynamic from "next/dynamic";
const TextShimmer = dynamic(
  () => import("@/components/ui/text-shimmer").then((m) => m.TextShimmer)
);
import {
  PIPELINE_STEPS,
  computeStepStatuses,
  getNextStep,
  type StepStatus,
} from "@/lib/pipeline-session";
import {
  buildPipelineInputFromStorage,
  getContextObject,
  LS_CONTEXT,
  setAutorunFlag,
} from "@/lib/pipeline-input";
import { useActiveSession } from "@/lib/active-session-context";
import {
  removeScopedRaw,
  writeScopedRaw,
} from "@/lib/session-scoped-storage";
import { importGlobalContextToSession } from "@/lib/api/context";
import type { MergedContextPayload } from "@/lib/api/context";
import { fetchResearchEntries } from "@/lib/api/research";
import { listSourceEvidence, listSources } from "@/lib/api/sources";
import { createClient } from "@/lib/supabase/client";
import { StepInspector } from "@/components/StepInspector";
import {
  getNextRecommendedAction,
  getSessionHomeSummary,
  type SessionHomeAction,
  type SourceReadinessCounts,
} from "@/lib/session-home";

const LS_KEY = "specflow_sessions";

const CONTEXT_PREVIEW_CONFIG = {
  sectionTitle: "Context Preview",
  fields: [
    { key: "companyName" as keyof MergedContextPayload["merged"], label: "Company" },
    { key: "productName" as keyof MergedContextPayload["merged"], label: "Product" },
    {
      key: "productDescription" as keyof MergedContextPayload["merged"],
      label: "Product description",
    },
    { key: "targetUsers" as keyof MergedContextPayload["merged"], label: "Target Users" },
    { key: "goals" as keyof MergedContextPayload["merged"], label: "Goals" },
  ],
  readyMessage:    "Pipeline will use this context",
  notReadyMessage: "Complete your context before running",
  editLabel:       "Edit Context",
  memoryLabel:     "Already generated",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoredSession {
  session_id: string;
  session_name?: string;
  status: string;
  created_at: string | null;
}

const EMPTY_SOURCE_COUNTS: SourceReadinessCounts = { available: false };

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

/** Merge API merged context with session-scoped localStorage (same source as pipeline input). */
function mergedContextForSession(
  apiMerged: MergedContextPayload["merged"] | undefined,
  localContext: Record<string, unknown>
): Record<string, unknown> {
  const remote = (apiMerged ?? {}) as Record<string, unknown>;
  return { ...localContext, ...remote };
}

function isContextGateComplete(m: Record<string, unknown>): boolean {
  return !!(
    String(m.companyName ?? "").trim() &&
    String(m.productName ?? "").trim() &&
    String(m.productDescription ?? "").trim() &&
    String(m.targetUsers ?? "").trim() &&
    String(m.goals ?? "").trim()
  );
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
  const { selectSession } = useActiveSession();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [contextPreview, setContextPreview] = useState<{
    context: MergedContextPayload;
    memory_keys: string[];
    ready: boolean;
  } | null>(null);
  const [contextPreviewLoading, setContextPreviewLoading] = useState(false);
  const [localSessionContext, setLocalSessionContext] = useState<Record<string, unknown>>({});
  const [localResearchCount, setLocalResearchCount] = useState(0);
  const [localContextSaved, setLocalContextSaved] = useState(false);
  const [sourceCounts, setSourceCounts] = useState<SourceReadinessCounts>(EMPTY_SOURCE_COUNTS);

  const merged = contextPreview?.context?.merged;

  const refreshLocalSessionData = useCallback(
    async (sessionId: string | null) => {
      const nextContext = getContextObject(sessionId);
      setLocalSessionContext(nextContext);
      setLocalContextSaved(Object.keys(nextContext).length > 0);
      try {
        const entries = await fetchResearchEntries(
          sessionId ? "session" : "global",
          sessionId ?? undefined
        );
        setLocalResearchCount(entries.length);
      } catch {
        setLocalResearchCount(0);
      }
    },
    [setLocalSessionContext, setLocalResearchCount, setLocalContextSaved]
  );

  const refreshSourceCounts = useCallback(async (sessionId: string | null) => {
    if (!sessionId) {
      setSourceCounts(EMPTY_SOURCE_COUNTS);
      return;
    }

    const [sourcesResult, evidenceResult] = await Promise.allSettled([
      listSources("session", sessionId),
      listSourceEvidence("session", sessionId),
    ]);

    if (sourcesResult.status === "fulfilled" && evidenceResult.status === "fulfilled") {
      setSourceCounts({
        available: true,
        sourceCount: sourcesResult.value.length,
        evidenceCount: evidenceResult.value.length,
      });
      return;
    }

    setSourceCounts(EMPTY_SOURCE_COUNTS);
  }, []);

  const mergedForContextPanel = useMemo(
    () => mergedContextForSession(merged, localSessionContext),
    [merged, localSessionContext]
  );

  const contextGateReady = useMemo(
    () => isContextGateComplete(mergedForContextPanel),
    [mergedForContextPanel]
  );

  // Create form state
  const [newSessionName, setNewSessionName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [showContextBootstrap, setShowContextBootstrap] = useState(false);
  const [bootstrapSessionId, setBootstrapSessionId] = useState<string | null>(null);
  const [isApplyingBootstrap, setIsApplyingBootstrap] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<"remote" | "local" | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [sessionHandoff, setSessionHandoff] = useState<AgentHandoff | null>(null);
  const [handoffGenerating, setHandoffGenerating] = useState(false);
  const [handoffGenerateOk, setHandoffGenerateOk] = useState(false);
  const [handoffGenerateError, setHandoffGenerateError] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const handoffPanelRef = useRef<HTMLDivElement | null>(null);
  selectedIdRef.current = selectedId;

  const openCreateModal = useCallback(() => {
    setIsCreating(true);
    setCreateError(null);
  }, [setIsCreating, setCreateError]);

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
  }, [setSessions]);

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
      void getHandoff(id)
        .then((r) => {
          if (selectedIdRef.current !== id) return;
          setSessionHandoff(r.handoff);
        })
        .catch(() => {
          if (selectedIdRef.current === id) setSessionHandoff(null);
        });
    } catch (e) {
      if (e instanceof Error && (e.message.includes("offline") || e.message.includes("503") || e.message.includes("Failed to fetch"))) {
        setBackendOffline(true);
      }
      setDetail(null);
      setSessionHandoff(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [
    selectedIdRef,
    setIsLoadingDetail,
    setRunError,
    setDetail,
    setSessions,
    setSessionHandoff,
    setBackendOffline,
  ]);

  const handleSelectSession = useCallback(
    (id: string) => {
      setSelectedId(id);
      selectSession(id);
      setRunError(null);
      setSessionHandoff(null);
      setHandoffGenerateError(null);
      setHandoffGenerateOk(false);
      loadDetail(id);
    },
    [loadDetail, selectSession]
  );

  // Fetch context preview when a session is selected (Bearer required — Express /api/context/merged uses verifyAuth)
  useEffect(() => {
    void refreshLocalSessionData(selectedId);
    void refreshSourceCounts(selectedId);
  }, [selectedId, refreshLocalSessionData, refreshSourceCounts]);

  useEffect(() => {
    if (!selectedId) {
      setContextPreview(null);
      return;
    }
    const ac = new AbortController();
    let cancelled = false;

    (async () => {
      setContextPreviewLoading(true);
      try {
        const headers: Record<string, string> = {};
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        const r = await fetch(
          `/api/sessions/${encodeURIComponent(selectedId)}/context-preview`,
          { headers, signal: ac.signal }
        );
        const data = (await r.json()) as {
          context: MergedContextPayload;
          memory_keys: string[];
          ready: boolean;
        };
        if (!cancelled) setContextPreview(data);
      } catch (e) {
        if (!cancelled && (e as Error).name !== "AbortError") {
          setContextPreview(null);
        }
      } finally {
        if (!cancelled) setContextPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [selectedId, setContextPreview, setContextPreviewLoading]);

  // Refetch when returning from /context (same tab — storage does not fire)
  useEffect(() => {
    if (!selectedId) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        try {
          const headers: Record<string, string> = {};
          const supabase = createClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
          }
          const r = await fetch(
            `/api/sessions/${encodeURIComponent(selectedId)}/context-preview`,
            { headers }
          );
          const data = (await r.json()) as {
            context: MergedContextPayload;
            memory_keys: string[];
            ready: boolean;
          };
          setContextPreview(data);
        } catch {
          /* keep prior preview */
        } finally {
          void refreshLocalSessionData(selectedId);
          void refreshSourceCounts(selectedId);
        }
      })();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [selectedId, refreshLocalSessionData, refreshSourceCounts, setContextPreview]);

  // Create session
  const handleCreate = useCallback(async () => {
    if (!newSessionName.trim()) {
      setCreateError("Session name is required.");
      return;
    }
    setCreateError(null);
    setIsCreatingSession(true);
    try {
      const result = await createSession(newSessionName.trim());
      setSessionMode(getLastSessionMode());
      const stored: StoredSession = {
        session_id: result.session_id,
        session_name: result.session_name,
        status: result.status,
        created_at: result.created_at,
      };
      const updated = [stored, ...sessions];
      persistSessions(updated);
      setNewSessionName("");
      setIsCreating(false);
      setSelectedId(result.session_id);
      selectSession(result.session_id);
      loadDetail(result.session_id);
      setBootstrapSessionId(result.session_id);
      setBootstrapError(null);
      setShowContextBootstrap(true);
    } catch (e) {
      if (e instanceof Error && (e.message.includes("offline") || e.message.includes("503") || e.message.includes("Failed to fetch"))) {
        setBackendOffline(true);
      }
      setCreateError(String(e));
    } finally {
      setIsCreatingSession(false);
    }
  }, [
    newSessionName,
    sessions,
    persistSessions,
    loadDetail,
    selectSession,
    setCreateError,
    setIsCreatingSession,
    setSessionMode,
    setNewSessionName,
    setIsCreating,
    setSelectedId,
    setBootstrapSessionId,
    setBootstrapError,
    setShowContextBootstrap,
    setBackendOffline,
  ]);

  const handleBootstrapChoice = useCallback(
    async (mode: "import" | "fresh") => {
      if (!bootstrapSessionId) return;
      setBootstrapError(null);
      setIsApplyingBootstrap(true);
      try {
        if (mode === "import") {
          const globalRaw = localStorage.getItem(LS_CONTEXT);
          if (globalRaw) {
            writeScopedRaw(bootstrapSessionId, "context", globalRaw);
          }
          await importGlobalContextToSession(bootstrapSessionId).catch(() => {
            // Backend sync is best-effort here; local scoped copy remains source for immediate UX.
          });
        } else {
          removeScopedRaw(bootstrapSessionId, "context");
        }
        void refreshLocalSessionData(bootstrapSessionId);
        setShowContextBootstrap(false);
        setBootstrapSessionId(null);
        // Context editing is handled inline on the Sessions page
      } catch (e) {
        setBootstrapError(String(e));
      } finally {
        setIsApplyingBootstrap(false);
      }
    },
    [
      bootstrapSessionId,
      refreshLocalSessionData,
      setBootstrapError,
      setIsApplyingBootstrap,
      setShowContextBootstrap,
      setBootstrapSessionId,
    ]
  );

  // Build inputData for the pipeline (research + uploaded sources come from server-side APIs)
  const buildInputData = useCallback(
    async (sessionId: string): Promise<Record<string, unknown>> => {
      return (await buildPipelineInputFromStorage(sessionId)) as unknown as Record<string, unknown>;
    },
    []
  );

  // Run pipeline
  const handleRun = useCallback(
    async (step?: string) => {
      if (!selectedId) return;
      setRunError(null);

      const inputData = await buildInputData(selectedId);

      // Full run: save input for pipeline pages and navigate immediately
      if (!step) {
        try {
          selectSession(selectedId);
          writeScopedRaw(
            selectedId,
            "pending_input",
            JSON.stringify({
              context: inputData.context,
              ingest: inputData.ingest,
            })
          );
          setAutorunFlag(selectedId);
        } catch {
          /* ignore */
        }
        router.push("/problems");
        return;
      }

      // Single step run via session API
      setIsRunning(true);
      try {
        await runSession(selectedId, inputData, step);
        await loadDetail(selectedId);
      } catch (e) {
        if (e instanceof Error && (e.message.includes("offline") || e.message.includes("503") || e.message.includes("Failed to fetch"))) {
          setBackendOffline(true);
        }
        setRunError(String(e));
        await loadDetail(selectedId);
      } finally {
        setIsRunning(false);
      }
    },
    [selectedId, buildInputData, loadDetail, router, selectSession]
  );

  const handleGenerateHandoff = useCallback(async () => {
    if (!selectedId || handoffGenerating || isRunning) return;
    setHandoffGenerating(true);
    setHandoffGenerateError(null);
    setHandoffGenerateOk(false);
    try {
      const res = await generateHandoff(selectedId);
      setSessionHandoff(res.handoff);
      setHandoffGenerateOk(true);
    } catch (e) {
      setHandoffGenerateError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setHandoffGenerating(false);
    }
  }, [
    selectedId,
    handoffGenerating,
    isRunning,
    setHandoffGenerating,
    setHandoffGenerateError,
    setHandoffGenerateOk,
    setSessionHandoff,
  ]);

  useEffect(() => {
    if (!handoffGenerateOk) return;
    const t = setTimeout(() => setHandoffGenerateOk(false), 5000);
    return () => clearTimeout(t);
  }, [handoffGenerateOk, setHandoffGenerateOk]);

  const stepStatuses = computeStepStatuses(detail);
  const nextStep = getNextStep(stepStatuses);
  const isSessionDone = detail?.session.status === "completed";
  const isSessionFailed = detail?.session.status === "failed";
  const researchCount = localResearchCount;
  const contextSaved = localContextSaved;
  const sessionHomeSummary = useMemo(
    () =>
      getSessionHomeSummary({
        detail,
        context: mergedForContextPanel,
        researchCount,
        sourceCounts,
        hasHandoff: Boolean(sessionHandoff),
      }),
    [detail, mergedForContextPanel, researchCount, sourceCounts, sessionHandoff]
  );
  const primaryHomeAction = useMemo(
    () => getNextRecommendedAction(sessionHomeSummary),
    [sessionHomeSummary]
  );

  const runHomeAction = useCallback(
    (action: SessionHomeAction) => {
      if (action.type === "link" && action.href) {
        const href =
          action.href === "/context" && selectedId
            ? `/context?sessionId=${encodeURIComponent(selectedId)}`
            : action.href;
        router.push(href);
        return;
      }
      if (action.type === "run-step" && action.step && action.step !== "prd") {
        void handleRun(action.step);
        return;
      }
      if (action.type === "generate-handoff") {
        void handleGenerateHandoff();
        return;
      }
      if (action.type === "view-handoff") {
        handoffPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [handleGenerateHandoff, handleRun, router, selectedId]
  );

  return (
    <>
      <div style={{ display: "flex", height: "100vh", background: "#F8F4EF", fontFamily: "'DM Sans', sans-serif" }}>
        <Sidebar />

        {/* Main content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">

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
              position: "relative",
              zIndex: 5,
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
              type="button"
              onPointerDown={openCreateModal}
              onClick={openCreateModal}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openCreateModal();
              }}
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
                transition: "background 0.18s ease, transform 0.18s ease",
                letterSpacing: "0.01em",
                position: "relative",
                zIndex: 6,
                pointerEvents: "auto",
              }}
              aria-label="Open new session modal"
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

          {backendOffline && (
            <div style={{
              background: "#FFF7ED",
              borderBottom: "1px solid #E8561B",
              color: "#9A3412",
              padding: "12px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "Outfit, sans-serif",
              fontSize: 14,
            }}>
              <span>Backend service is offline. Please start the backend server.</span>
              <button
                onClick={() => setBackendOffline(false)}
                aria-label="Dismiss offline warning"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9A3412", fontWeight: 600 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Local Mode banner */}
          {sessionMode === "local" && (
            <div style={{
              background: "#FFF7ED",
              borderBottom: "1px solid #FED7AA",
              padding: "6px 20px",
              fontSize: 12,
              color: "#C2410C",
              fontWeight: 500,
              flexShrink: 0,
            }}>
              Local Mode — backend unreachable. Outputs are generated locally, not from the pipeline.
            </div>
          )}

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
                    <div style={{ fontSize: 12, color: "#9B9189", lineHeight: 1.5, marginBottom: 14 }}>
                      Create a session to start turning research into product decisions.
                    </div>
                    <div style={{ textAlign: "left", display: "grid", gap: 6 }}>
                      {["Create a session", "Add context", "Add research/sources", "Generate problems"].map((step, index) => (
                        <div key={step} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#6B6B6B" }}>
                          <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#F8F4EF", border: "1px solid #E4DDD4", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#E8561B", flexShrink: 0 }}>
                            {index + 1}
                          </span>
                          {step}
                        </div>
                      ))}
                    </div>
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
                          borderTop: "none",
                          borderRight: "none",
                          borderBottom: "none",
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
                          {s.session_name || `Session ${shortId(s.session_id)}`}
                        </div>
                        <div style={{ fontSize: 11, color: "#9B9189" }}>
                          {relativeTime(s.created_at)}
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
                      Create or select a session to start turning research into product decisions.
                    </div>
                    <button
                      type="button"
                      onPointerDown={openCreateModal}
                      onClick={openCreateModal}
                      style={{
                        marginTop: 14,
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: "#0D0D0D",
                        color: "#FFFFFF",
                        border: "none",
                        fontSize: 12.5,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      New Session
                    </button>
                  </div>
                </div>
              ) : isLoadingDetail ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 10 }}>
                  <span style={{ width: 18, height: 18, border: "2px solid #E4DDD4", borderTop: "2px solid #E8561B", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  <span style={{ fontSize: 13.5, color: "#9B9189" }}>Loading session…</span>
                </div>
              ) : (
                <div style={{ animation: "fadeUp 0.4s ease", maxWidth: 760 }}>

                  {/* Session Home overview */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E4DDD4",
                      borderRadius: 14,
                      padding: "18px 22px",
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#E8561B", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 5 }}>
                          Session Home
                        </div>
                        <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.12, color: "#0D0D0D", letterSpacing: 0 }}>
                          {sessionHomeSummary.sessionName}
                        </h2>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <span style={{ fontSize: 12, color: "#6B6B6B", fontFamily: "monospace", fontWeight: 600 }}>
                            {sessionHomeSummary.shortSessionId}
                          </span>
                          <StatusBadge status={sessionHomeSummary.status} />
                          <span style={{ fontSize: 12, color: "#9B9189" }}>
                            Created {relativeTime(sessionHomeSummary.createdAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => runHomeAction(primaryHomeAction)}
                        disabled={isRunning || handoffGenerating}
                        style={{
                          flexShrink: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "9px 15px",
                          borderRadius: 9,
                          border: "none",
                          background: isRunning || handoffGenerating ? "#F0EAE1" : "#0D0D0D",
                          color: isRunning || handoffGenerating ? "#9B9189" : "#FFFFFF",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: isRunning || handoffGenerating ? "not-allowed" : "pointer",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {primaryHomeAction.label}
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
                      {[
                        {
                          label: "Context",
                          value: sessionHomeSummary.contextReady ? "Complete" : "Incomplete",
                          tone: sessionHomeSummary.contextReady ? "good" : "warn",
                        },
                        {
                          label: "Research",
                          value: `${sessionHomeSummary.researchCount}`,
                          tone: sessionHomeSummary.researchCount > 0 ? "good" : "muted",
                        },
                        ...(sessionHomeSummary.sourceCounts.available
                          ? [
                              {
                                label: "Sources",
                                value: `${sessionHomeSummary.sourceCounts.sourceCount ?? 0}`,
                                tone: (sessionHomeSummary.sourceCounts.sourceCount ?? 0) > 0 ? "good" : "muted",
                              },
                              {
                                label: "Evidence",
                                value: `${sessionHomeSummary.sourceCounts.evidenceCount ?? 0}`,
                                tone: (sessionHomeSummary.sourceCounts.evidenceCount ?? 0) > 0 ? "good" : "muted",
                              },
                            ]
                          : []),
                        {
                          label: "Pipeline",
                          value: `${sessionHomeSummary.completedSteps}/${sessionHomeSummary.totalSteps}`,
                          tone: sessionHomeSummary.completedSteps > 0 ? "good" : "muted",
                        },
                      ].map((item) => {
                        const tone =
                          item.tone === "good"
                            ? { bg: "#F0FDF4", border: "#BBF7D0", color: "#15803D" }
                            : item.tone === "warn"
                            ? { bg: "#FFF7ED", border: "#FED7AA", color: "#C2410C" }
                            : { bg: "#F8F4EF", border: "#E4DDD4", color: "#6B6B6B" };
                        return (
                          <div
                            key={item.label}
                            style={{
                              border: `1px solid ${tone.border}`,
                              background: tone.bg,
                              borderRadius: 10,
                              padding: "10px 12px",
                            }}
                          >
                            <div style={{ fontSize: 10.5, color: "#9B9189", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                              {item.label}
                            </div>
                            <div style={{ fontSize: 15, color: tone.color, fontWeight: 700 }}>{item.value}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                      <div style={{ border: "1px solid #F0EAE1", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10.5, color: "#9B9189", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>
                          Next best action
                        </div>
                        <div style={{ fontSize: 13, color: "#0D0D0D", fontWeight: 600 }}>
                          {primaryHomeAction.label}
                        </div>
                        <div style={{ fontSize: 12, color: "#9B9189", marginTop: 3 }}>
                          Next step: {sessionHomeSummary.nextRecommendedStep}
                        </div>
                      </div>
                      <div style={{ border: "1px solid #F0EAE1", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10.5, color: "#9B9189", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>
                          Last generated artifact
                        </div>
                        <div style={{ fontSize: 13, color: "#0D0D0D", fontWeight: 600 }}>
                          {sessionHomeSummary.lastGeneratedArtifact ?? "None yet"}
                        </div>
                        {!sessionHomeSummary.contextReady && (
                          <div style={{ fontSize: 12, color: "#C2410C", marginTop: 3 }}>
                            Missing: {sessionHomeSummary.missingContextFields.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Evidence readiness */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E4DDD4",
                      borderRadius: 14,
                      padding: "16px 20px",
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                      Evidence Readiness
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                      {sessionHomeSummary.evidenceRows.map((row) => (
                        <div
                          key={row.label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "9px 10px",
                            borderRadius: 9,
                            border: "1px solid #F0EAE1",
                            background: row.ready ? "#FBFEFC" : "#FFFCF7",
                          }}
                        >
                          <span style={{ fontSize: 12.5, color: "#5C5248", fontWeight: 500 }}>{row.label}</span>
                          <span style={{ fontSize: 12.5, color: row.ready ? "#15803D" : "#C2410C", fontWeight: 700 }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E4DDD4",
                      borderRadius: 14,
                      padding: "16px 20px",
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                      Quick Actions
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                      {[
                        { label: "Edit Context", action: { label: "Edit Context", type: "link", href: "/context" } as SessionHomeAction },
                        { label: "Add Research", action: { label: "Add Research", type: "link", href: "/research" } as SessionHomeAction },
                        ...(sessionHomeSummary.sourceCounts.available
                          ? [{ label: "Upload Sources", action: { label: "Upload Sources", type: "link", href: "/sources" } as SessionHomeAction }]
                          : []),
                        { label: "View Problems", action: { label: "View Problems", type: "link", href: "/problems" } as SessionHomeAction },
                        { label: "View Features", action: { label: "View Features", type: "link", href: "/features" } as SessionHomeAction },
                        { label: "View Decomposition", action: { label: "View Decomposition", type: "link", href: "/decompose" } as SessionHomeAction },
                        { label: "View Tasks", action: { label: "View Tasks", type: "link", href: "/tasks" } as SessionHomeAction },
                        { label: "View PRD", action: { label: "View PRD", type: "link", href: "/prd" } as SessionHomeAction },
                        { label: "Generate Handoff", action: { label: "Generate Handoff", type: "generate-handoff" } as SessionHomeAction },
                      ].map(({ label, action }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => runHomeAction(action)}
                          disabled={(action.type === "generate-handoff" && (handoffGenerating || isRunning || !selectedId)) || (action.type === "run-step" && isRunning)}
                          style={{
                            padding: "9px 10px",
                            borderRadius: 9,
                            border: "1px solid #E4DDD4",
                            background: "#F8F4EF",
                            color: "#0D0D0D",
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recent outputs */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E4DDD4",
                      borderRadius: 14,
                      padding: "16px 20px",
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                      Recent Outputs
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {sessionHomeSummary.recentOutputs.map((row) => (
                        <div
                          key={row.key}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(120px, 1fr) auto auto",
                            alignItems: "center",
                            gap: 10,
                            padding: "9px 0",
                            borderBottom: row.key === "handoff" ? "none" : "1px solid #F0EAE1",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, color: "#0D0D0D", fontWeight: 600 }}>{row.label}</div>
                            <div style={{ fontSize: 11.5, color: "#9B9189", marginTop: 2 }}>
                              {row.available ? "Available" : "Not generated"}
                              {row.available && row.count > 1 ? ` · ${row.count} items` : ""}
                              {row.qualityScore != null ? ` · Quality ${Math.round(row.qualityScore * 100)}%` : ""}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: 20,
                              background: row.available ? "#F0FDF4" : "#F8F4EF",
                              border: `1px solid ${row.available ? "#BBF7D0" : "#E4DDD4"}`,
                              color: row.available ? "#15803D" : "#9B9189",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.available ? "Available" : "Not generated"}
                          </span>
                          <button
                            type="button"
                            onClick={() => runHomeAction(row.action)}
                            disabled={(row.action.type === "generate-handoff" && (handoffGenerating || isRunning || !selectedId)) || (row.action.type === "run-step" && isRunning)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #E4DDD4",
                              background: row.available ? "#F8F4EF" : "#FFF7ED",
                              color: row.available ? "#0D0D0D" : "#C2410C",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "'DM Sans', sans-serif",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.action.label}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

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
                          { label: "Session Name", value: detail.session.session_name },
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

                  {/* Next run input summary */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E4DDD4",
                      borderRadius: 14,
                      padding: "12px 16px",
                      marginBottom: 18,
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Next run includes
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        padding: "3px 10px",
                        borderRadius: 20,
                        border: `1px solid ${contextSaved ? "#BBF7D0" : "#E4DDD4"}`,
                        background: contextSaved ? "#F0FDF4" : "#F8F4EF",
                        color: contextSaved ? "#15803D" : "#9B9189",
                      }}
                    >
                      Context{contextSaved ? " ✓" : " —"}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        padding: "3px 10px",
                        borderRadius: 20,
                        border: `1px solid ${researchCount > 0 ? "#BBF7D0" : "#E4DDD4"}`,
                        background: researchCount > 0 ? "#F0FDF4" : "#F8F4EF",
                        color: researchCount > 0 ? "#15803D" : "#9B9189",
                      }}
                    >
                      Research ({researchCount}){researchCount > 0 ? " ✓" : ""}
                    </span>

                  </div>

                  {/* Research card */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E4DDD4",
                      borderRadius: 14,
                      padding: "18px 22px",
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        Research
                      </div>
                      {researchCount > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D" }}>
                          {researchCount} {researchCount === 1 ? "entry" : "entries"}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: "#5C5248", lineHeight: 1.55, margin: "0 0 14px" }}>
                      Add interviews, usage data, and market insights to power your pipeline.
                    </p>
                    <Link href="/research" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#E8561B", textDecoration: "none" }}>
                      Manage Research →
                    </Link>
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

                  {/* Context preview panel */}
                  {selectedId && (
                    <div
                      style={{
                        background: "#FFFFFF",
                        border: `1px solid ${
                          contextPreviewLoading
                            ? "#E4DDD4"
                            : contextGateReady
                            ? "#BBF7D0"
                            : "#FED7AA"
                        }`,
                        borderRadius: 14,
                        padding: "16px 20px",
                        marginBottom: 18,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: contextPreviewLoading ? 0 : 12,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#9B9189",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          {CONTEXT_PREVIEW_CONFIG.sectionTitle}
                        </span>
                        <a
                          href={`/context?sessionId=${selectedId}`}
                          style={{
                            fontSize: 12,
                            color: "#E8561B",
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                        >
                          {CONTEXT_PREVIEW_CONFIG.editLabel}
                        </a>
                      </div>

                      {contextPreviewLoading ? (
                        <div style={{ height: 14, background: "#F8F4EF", borderRadius: 4, width: "55%" }} />
                      ) : (
                        <>
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: 500,
                              color: contextGateReady ? "#15803D" : "#C2410C",
                              marginBottom: 10,
                            }}
                          >
                            {contextGateReady
                              ? "✓ " + CONTEXT_PREVIEW_CONFIG.readyMessage
                              : "⚠ " + CONTEXT_PREVIEW_CONFIG.notReadyMessage}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {CONTEXT_PREVIEW_CONFIG.fields.map(({ key, label }) => {
                              const value = mergedForContextPanel[key];
                              return (
                                <div key={key} style={{ display: "flex", gap: 8, fontSize: 12.5 }}>
                                  <span style={{ color: "#9B9189", minWidth: 88, flexShrink: 0 }}>
                                    {label}
                                  </span>
                                  <span
                                    style={{
                                      color: value ? "#0D0D0D" : "#C2410C",
                                      fontStyle: value ? "normal" : "italic",
                                    }}
                                  >
                                    {value ? String(value) : "missing"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {(contextPreview?.memory_keys?.length ?? 0) > 0 && (
                            <div style={{ marginTop: 10, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "#9B9189",
                                  fontWeight: 600,
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                }}
                              >
                                {CONTEXT_PREVIEW_CONFIG.memoryLabel}
                              </span>
                              {(contextPreview?.memory_keys ?? []).map((k) => (
                                <span
                                  key={k}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    padding: "2px 8px",
                                    borderRadius: 20,
                                    background: "#F0FDF4",
                                    border: "1px solid #BBF7D0",
                                    color: "#15803D",
                                  }}
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

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
                          disabled={isRunning || isSessionDone || !contextGateReady}
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
                            <TextShimmer duration={1.2}>Running…</TextShimmer>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          )}
                          {isRunning ? null : "Run full pipeline (Problems → Features → Decompose → Tasks)"}
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
                            Continue: run {PIPELINE_STEPS.find((s) => s.id === nextStep)?.label} only
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

                  {/* Coding Agent Handoff — only after tasks step completed */}
                  {stepStatuses.tasks === "completed" && selectedId && (
                    <div
                      ref={handoffPanelRef}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E4DDD4",
                        borderRadius: 14,
                        padding: "18px 22px",
                        marginBottom: 18,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#9B9189",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          Coding Agent Handoff
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {!sessionHandoff && (
                            <button
                              type="button"
                              onClick={() => void handleGenerateHandoff()}
                              disabled={isRunning || handoffGenerating || !selectedId}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 14px",
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: 600,
                                background: isRunning || handoffGenerating ? "#F0EAE1" : "#0D0D0D",
                                color: isRunning || handoffGenerating ? "#9B9189" : "#FFFFFF",
                                border: "none",
                                cursor: isRunning || handoffGenerating ? "not-allowed" : "pointer",
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              {handoffGenerating ? (
                                <>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" opacity="0.35" />
                                  </svg>
                                  Generating…
                                </>
                              ) : (
                                "Generate"
                              )}
                            </button>
                          )}
                          {sessionHandoff && sessionHandoff.needs_clarification_count > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "3px 10px",
                                borderRadius: 20,
                                background: "rgba(245,158,11,0.12)",
                                color: "#B45309",
                                whiteSpace: "nowrap",
                              }}
                            >
                              ⚠ {sessionHandoff.needs_clarification_count} gaps
                            </span>
                          )}
                          {sessionHandoff && sessionHandoff.needs_clarification_count === 0 && (
                            <span style={{ fontSize: 14, color: "#15803D", fontWeight: 600 }}>✓</span>
                          )}
                        </div>
                      </div>

                      {handoffGenerateOk && (
                        <div style={{ fontSize: 12.5, color: "#15803D", fontWeight: 500, marginBottom: 10 }}>
                          Handoff generated successfully.
                        </div>
                      )}
                      {handoffGenerateError && (
                        <div style={{ fontSize: 12.5, color: "#DC2626", marginBottom: 10, lineHeight: 1.5 }}>
                          {handoffGenerateError}
                        </div>
                      )}

                      {!sessionHandoff && (
                        <div style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.65 }}>
                          <p style={{ margin: "0 0 8px 0" }}>All pipeline steps complete.</p>
                          <p style={{ margin: 0 }}>
                            Generate a handoff package for Claude Code or Cursor.
                          </p>
                        </div>
                      )}

                      {sessionHandoff && sessionHandoff.needs_clarification_count === 0 && (
                        <>
                          <div style={{ fontSize: 13, color: "#3a3530", lineHeight: 1.6, marginBottom: 14 }}>
                            {sessionHandoff.estimated_sessions != null && (
                              <p style={{ margin: "0 0 6px 0" }}>
                                ~{sessionHandoff.estimated_sessions} coding session
                                {sessionHandoff.estimated_sessions !== 1 ? "s" : ""}
                              </p>
                            )}
                            <p style={{ margin: 0 }}>
                              {(() => {
                                const tasks = normalizeHandoffTasks(sessionHandoff.tasks);
                                return (
                                  <>
                                    {tasks.length} task{tasks.length !== 1 ? "s" : ""} across{" "}
                                    {Array.from(new Set(tasks.map((t) => t.layer))).join(", ") || "—"}
                                  </>
                                );
                              })()}
                            </p>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => exportHandoff(selectedId, "claude_md")}
                              style={{
                                padding: "7px 12px",
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: 500,
                                background: "#F8F4EF",
                                border: "1px solid #E4DDD4",
                                color: "#0D0D0D",
                                cursor: "pointer",
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              Export CLAUDE.md
                            </button>
                            <button
                              type="button"
                              onClick={() => exportHandoff(selectedId, "cursor_rules")}
                              style={{
                                padding: "7px 12px",
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: 500,
                                background: "#F8F4EF",
                                border: "1px solid #E4DDD4",
                                color: "#0D0D0D",
                                cursor: "pointer",
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              Export .cursorrules
                            </button>
                          </div>
                        </>
                      )}

                      {sessionHandoff && sessionHandoff.needs_clarification_count > 0 && (
                        <>
                          <div style={{ fontSize: 13, color: "#6B6B6B", lineHeight: 1.65, marginBottom: 14 }}>
                            {sessionHandoff.needs_clarification_count} task
                            {sessionHandoff.needs_clarification_count !== 1 ? "s" : ""} need clearer acceptance criteria
                            before handoff.
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => router.push("/tasks")}
                              style={{
                                padding: "7px 12px",
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: 500,
                                background: "#FFF7ED",
                                border: "1.5px solid #FED7AA",
                                color: "#C2410C",
                                cursor: "pointer",
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              View in Tasks →
                            </button>
                            <button
                              type="button"
                              onClick={() => exportHandoff(selectedId, "claude_md")}
                              style={{
                                padding: "7px 12px",
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: 500,
                                background: "#F8F4EF",
                                border: "1px solid #E4DDD4",
                                color: "#0D0D0D",
                                cursor: "pointer",
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              Export CLAUDE.md anyway
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Outputs inspector — per-step structured view */}
                  {detail?.state?.state?.outputs && Object.keys(detail.state.state.outputs).length > 0 && (
                    <div style={{ background: "#FFFFFF", border: "1px solid #E4DDD4", borderRadius: 14, padding: "18px 22px", marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                        Outputs
                      </div>
                      {(
                        [
                          { step: "problems", outputKey: "problems" },
                          { step: "features", outputKey: "features" },
                          { step: "decompose", outputKey: "decompositions" },
                          { step: "tasks", outputKey: "tasks" },
                        ] as const
                      ).map(({ step, outputKey }) => {
                        const items = detail.state?.state?.outputs?.[outputKey];
                        if (!Array.isArray(items) || items.length === 0) return null;
                        return (
                          <div key={step} style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#0D0D0D", marginBottom: 4, textTransform: "capitalize" }}>
                              {step}
                            </div>
                            <StepInspector
                              step={step}
                              items={items as Record<string, unknown>[]}
                            />
                          </div>
                        );
                      })}
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

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#3a3530", marginBottom: 6, letterSpacing: "0.02em" }}>
                Session Name
              </label>
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => { setNewSessionName(e.target.value); setCreateError(null); }}
                placeholder="e.g. q2-growth-hypotheses"
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

      {showContextBootstrap && bootstrapSessionId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(13,13,13,0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1010,
            animation: "fadeUp 0.2s ease",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              padding: "26px 28px 24px",
              width: 500,
              boxShadow: "0 24px 60px rgba(13,13,13,0.18), 0 4px 16px rgba(13,13,13,0.08)",
              border: "1px solid #E4DDD4",
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "#0D0D0D", marginBottom: 5 }}>
                Configure Session Context
              </div>
              <div style={{ fontSize: 13, color: "#9B9189", lineHeight: 1.6 }}>
                Pick how this new session should start. You can import the global workspace context
                or start with a fresh session-specific context.
              </div>
            </div>

            {bootstrapError && (
              <div style={{ marginBottom: 14, padding: "9px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12.5, color: "#B91C1C" }}>
                {bootstrapError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => handleBootstrapChoice("import")}
                disabled={isApplyingBootstrap}
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: "9px 14px",
                  borderRadius: 9,
                  background: "#0D0D0D",
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: isApplyingBootstrap ? "not-allowed" : "pointer",
                }}
              >
                Import Workspace Context
              </button>
              <button
                onClick={() => handleBootstrapChoice("fresh")}
                disabled={isApplyingBootstrap}
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: "9px 14px",
                  borderRadius: 9,
                  background: "#F8F4EF",
                  color: "#6B6B6B",
                  border: "1px solid #E4DDD4",
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: isApplyingBootstrap ? "not-allowed" : "pointer",
                }}
              >
                Start Fresh Context
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
