"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import type { SessionDetail } from "@/lib/api/session";
import { PIPELINE_STEPS, computeStepStatuses, getNextStep } from "@/lib/pipeline-session";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionSummary {
  id: string;
  session_name: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

interface UserPlan {
  plan: string;
  plan_label: string;
  price_dollars: number;
  pipeline_runs_used: number;
  api_credit_used_cents: number;
  api_credit_used_dollars: number;
  limit_type: "runs" | "credit";
  // free
  max_pipeline_runs?: number;
  pipeline_runs_remaining?: number;
  // paid
  max_credit_cents?: number;
  max_credit_dollars?: number;
  credit_remaining_cents?: number;
  credit_remaining_dollars?: number;
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    fetch("/api/sessions", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then((r) => r.json())
      .then((body: { sessions?: SessionSummary[] }) => {
        clearTimeout(timeout);
        if (!cancelled) {
          setSessions(body.sessions ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        if (!cancelled) {
          setError("Could not load sessions.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return { sessions, loading, error };
}

function usePlan() {
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/plan", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((data: UserPlan) => {
        if (!cancelled) {
          setPlan(data);
          setPlanLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setPlanLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { plan, planLoading };
}

function useRecentSessionDetail(sessionId: string | null) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((data: SessionDetail) => {
        if (!cancelled) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  return { detail, loading };
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Shimmer({ width, height, radius = 4 }: { width: number | string; height: number; radius?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, #F0EAE1 25%, #F8F4EF 50%, #F0EAE1 75%)",
        backgroundSize: "800px 100%",
        animation: "shimmer 1.4s infinite linear",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Widgets ──────────────────────────────────────────────────────────────────

function QuickStartWidget() {
  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #0D0D0D",
      borderRadius: 16,
      padding: "40px 48px",
      display: "flex",
      flexDirection: "column",
      gap: 32,
      animation: "fadeUp 0.45s ease forwards",
    }}>
      <h2 style={{
        fontFamily: "var(--font-instrument), 'Instrument Serif', serif",
        fontSize: "2.5rem",
        fontWeight: 400,
        color: "#0D0D0D",
        margin: 0,
        lineHeight: 1.1,
      }}>
        Get started with SpecFlow
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
        <Link href="/sessions" style={{ textDecoration: "none" }}>
          <div style={{ padding: 24, border: "1px solid #E4DDD4", borderRadius: 12, height: "100%", transition: "border-color 0.2s" }}
               onMouseEnter={(e) => e.currentTarget.style.borderColor = "#0D0D0D"}
               onMouseLeave={(e) => e.currentTarget.style.borderColor = "#E4DDD4"}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E8561B", marginBottom: 12, fontFamily: "var(--font-dm-sans), sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>Step 1</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "#0D0D0D", marginBottom: 8, fontFamily: "var(--font-dm-sans), sans-serif" }}>Create a session</div>
            <div style={{ fontSize: 14, color: "#6B6B6B", fontFamily: "var(--font-dm-sans), sans-serif" }}>Start a new workspace for your product feature.</div>
          </div>
        </Link>
        <Link href="/sources" style={{ textDecoration: "none" }}>
          <div style={{ padding: 24, border: "1px solid #E4DDD4", borderRadius: 12, height: "100%", transition: "border-color 0.2s" }}
               onMouseEnter={(e) => e.currentTarget.style.borderColor = "#0D0D0D"}
               onMouseLeave={(e) => e.currentTarget.style.borderColor = "#E4DDD4"}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E8561B", marginBottom: 12, fontFamily: "var(--font-dm-sans), sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>Step 2</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "#0D0D0D", marginBottom: 8, fontFamily: "var(--font-dm-sans), sans-serif" }}>Upload a source document</div>
            <div style={{ fontSize: 14, color: "#6B6B6B", fontFamily: "var(--font-dm-sans), sans-serif" }}>Provide context like user interviews or raw notes.</div>
          </div>
        </Link>
        <Link href="/problems" style={{ textDecoration: "none" }}>
          <div style={{ padding: 24, border: "1px solid #E4DDD4", borderRadius: 12, height: "100%", transition: "border-color 0.2s" }}
               onMouseEnter={(e) => e.currentTarget.style.borderColor = "#0D0D0D"}
               onMouseLeave={(e) => e.currentTarget.style.borderColor = "#E4DDD4"}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E8561B", marginBottom: 12, fontFamily: "var(--font-dm-sans), sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>Step 3</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "#0D0D0D", marginBottom: 8, fontFamily: "var(--font-dm-sans), sans-serif" }}>Run the pipeline</div>
            <div style={{ fontSize: 14, color: "#6B6B6B", fontFamily: "var(--font-dm-sans), sans-serif" }}>Generate problems, features, and a PRD.</div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function SessionsWidget({ total, recentSession, loading }: { total: number, recentSession: SessionSummary | null, loading: boolean }) {
  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E4DDD4",
      borderRadius: 16,
      padding: 32,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      animation: "fadeUp 0.45s ease forwards",
      animationDelay: "0.05s",
      opacity: 0,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, fontFamily: "var(--font-dm-sans), sans-serif" }}>
          Sessions
        </div>
        {loading ? (
          <Shimmer width={80} height={48} />
        ) : (
          <div style={{
            fontFamily: "var(--font-instrument), 'Instrument Serif', serif",
            fontSize: "3.5rem",
            fontWeight: 400,
            color: "#0D0D0D",
            lineHeight: 1,
            marginBottom: 24,
          }}>
            {total}
          </div>
        )}
      </div>
      
      <div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            <Shimmer width={120} height={14} />
            <Shimmer width={180} height={14} />
          </div>
        ) : recentSession ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 4, fontFamily: "var(--font-dm-sans), sans-serif" }}>Last active session</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#0D0D0D", fontFamily: "var(--font-dm-sans), sans-serif" }}>{recentSession.session_name}</div>
            <div style={{ fontSize: 12, color: "#9E9E9E", marginTop: 4, fontFamily: "var(--font-dm-sans), sans-serif" }}>Updated {relativeTime(recentSession.updated_at)}</div>
          </div>
        ) : (
          <div style={{ marginBottom: 24, fontSize: 14, color: "#6B6B6B", fontFamily: "var(--font-dm-sans), sans-serif" }}>
            No sessions yet.
          </div>
        )}
        <Link href="/sessions" style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#E8561B",
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: 500,
          padding: "12px 24px",
          borderRadius: 8,
          textDecoration: "none",
          fontFamily: "var(--font-dm-sans), sans-serif",
          width: "100%",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "#c95215"}
        onMouseLeave={(e) => e.currentTarget.style.background = "#E8561B"}
        >
          New Session
        </Link>
      </div>
    </div>
  );
}

function PipelineRunsWidget({ plan, loading }: { plan: UserPlan | null, loading: boolean }) {
  const isFree = plan?.plan === "free";
  const used = plan?.pipeline_runs_used ?? 0;
  const max = plan?.max_pipeline_runs ?? 5;
  const percent = Math.min(100, (used / max) * 100);

  return (
    <div style={{
      background: "#0D0D0D",
      border: "1px solid #0D0D0D",
      borderRadius: 16,
      padding: 32,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      animation: "fadeUp 0.45s ease forwards",
      animationDelay: "0.1s",
      opacity: 0,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, fontFamily: "var(--font-dm-sans), sans-serif" }}>
          Pipeline Runs
        </div>
        {loading ? (
          <Shimmer width={120} height={48} />
        ) : (
          <div style={{
            fontFamily: "var(--font-instrument), 'Instrument Serif', serif",
            fontSize: "3.5rem",
            fontWeight: 400,
            color: "#FFFFFF",
            lineHeight: 1,
            marginBottom: 24,
          }}>
            {isFree ? `${used} / ${max}` : "Unlimited"}
          </div>
        )}
      </div>

      <div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Shimmer width="100%" height={4} />
            <Shimmer width={100} height={12} />
          </div>
        ) : isFree ? (
          <>
            <div style={{ height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
              <div style={{
                height: "100%",
                width: `${percent}%`,
                background: percent >= 100 ? "#EF4444" : "#E8561B",
                borderRadius: 99,
              }} />
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-dm-sans), sans-serif" }}>
              {used} runs used this month
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-dm-sans), sans-serif" }}>
            You have unlimited runs on the {plan?.plan_label || "Pro"} plan.
          </div>
        )}
      </div>
    </div>
  );
}

function LastPipelineRunWidget({ recentSession, detail, loading }: { recentSession: SessionSummary | null, detail: SessionDetail | null, loading: boolean }) {
  const router = useRouter();
  
  let stepLabel = "Not started";
  let stepRoute = "/problems"; // default to first step

  if (detail) {
    const statuses = computeStepStatuses(detail);
    const lastCompleted = PIPELINE_STEPS.slice().reverse().find(s => statuses[s.id] === "completed");
    if (lastCompleted) {
      stepLabel = `Completed ${lastCompleted.label}`;
      const next = getNextStep(statuses);
      if (next) {
        stepRoute = `/${next}`;
      } else {
        stepRoute = `/${lastCompleted.id}`;
      }
    }
  }

  const handleContinue = () => {
    if (recentSession) {
      localStorage.setItem("specflow_active_session_id", recentSession.id);
      router.push(stepRoute);
    }
  };

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E4DDD4",
      borderRadius: 16,
      padding: 32,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      animation: "fadeUp 0.45s ease forwards",
      animationDelay: "0.15s",
      opacity: 0,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, fontFamily: "var(--font-dm-sans), sans-serif" }}>
          Last Pipeline Run
        </div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Shimmer width="80%" height={32} />
            <Shimmer width={120} height={16} />
          </div>
        ) : recentSession ? (
          <>
            <div style={{
              fontFamily: "var(--font-instrument), 'Instrument Serif', serif",
              fontSize: "2.5rem",
              fontWeight: 400,
              color: "#0D0D0D",
              lineHeight: 1.1,
              marginBottom: 12,
              wordBreak: "break-word",
            }}>
              {recentSession.session_name}
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#F8F4EF", padding: "6px 12px", borderRadius: 99 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3D6B5E", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#3D6B5E", fontFamily: "var(--font-dm-sans), sans-serif" }}>
                {stepLabel}
              </span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 15, color: "#6B6B6B", fontFamily: "var(--font-dm-sans), sans-serif" }}>
            No runs recorded.
          </div>
        )}
      </div>

      <div style={{ marginTop: 32 }}>
        {loading ? (
          <Shimmer width="100%" height={44} />
        ) : recentSession ? (
          <button onClick={handleContinue} style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            color: "#0D0D0D",
            border: "1px solid #0D0D0D",
            fontSize: 14,
            fontWeight: 500,
            padding: "11px 24px",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "var(--font-dm-sans), sans-serif",
            width: "100%",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#0D0D0D"; e.currentTarget.style.color = "#FFFFFF"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#0D0D0D"; }}
          >
            Continue Run →
          </button>
        ) : (
          <Link href="/sessions" style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            color: "#6B6B6B",
            border: "1px solid #E4DDD4",
            fontSize: 14,
            fontWeight: 500,
            padding: "11px 24px",
            borderRadius: 8,
            textDecoration: "none",
            fontFamily: "var(--font-dm-sans), sans-serif",
            width: "100%",
          }}>
            Start a run
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { sessions, loading: sessionsLoading, error } = useSessions();
  const { plan, planLoading } = usePlan();

  // Recent session
  const recentSession = sessions.length > 0 
    ? [...sessions].sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tb - ta;
      })[0] 
    : null;

  const { detail, loading: detailLoading } = useRecentSessionDetail(recentSession?.id ?? null);

  const loading = sessionsLoading || planLoading;
  const showQuickStart = !loading && sessions.length === 0;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F8F4EF" }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Sidebar />

      <div className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <header style={{
          height: 60,
          flexShrink: 0,
          background: "#FFFFFF",
          borderBottom: "1px solid #E4DDD4",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
        }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <svg
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9E9E9E", pointerEvents: "none" }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              readOnly
              placeholder="Search sessions..."
              style={{
                width: 220,
                height: 34,
                borderRadius: 8,
                border: "1px solid #E4DDD4",
                background: "#F8F4EF",
                fontSize: 13,
                color: "#6B6B6B",
                paddingLeft: 32,
                paddingRight: 12,
                outline: "none",
                cursor: "default",
                fontFamily: "var(--font-dm-sans), sans-serif",
              }}
            />
          </div>

          {/* Avatar + name */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#E8561B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#FFFFFF",
              flexShrink: 0,
              fontFamily: "var(--font-dm-sans), sans-serif",
            }}>
              SF
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#0D0D0D", lineHeight: 1.3, fontFamily: "var(--font-dm-sans), sans-serif" }}>
                SpecFlow
              </div>
              <div style={{ fontSize: 11, color: "#6B6B6B", lineHeight: 1.3, fontFamily: "var(--font-dm-sans), sans-serif" }}>
                AI Product Manager
              </div>
            </div>
          </div>
        </header>

        {/* ── Scrollable body ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 48 }}>

          {/* Title section */}
          <div style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: "48px 48px 32px",
          }}>
            <div>
              <h1 style={{
                fontFamily: "var(--font-instrument), 'Instrument Serif', serif",
                fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "#0D0D0D",
                lineHeight: 1.1,
                margin: 0,
              }}>
                Dashboard
              </h1>
            </div>
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              <Link href="/sessions" style={{
                fontSize: 14,
                fontWeight: 500,
                background: "#E8561B",
                color: "#FFFFFF",
                borderRadius: 8,
                padding: "10px 20px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-dm-sans), sans-serif",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#c95215"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#E8561B"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Session
              </Link>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              margin: "0 48px 24px",
              padding: "12px 16px",
              borderRadius: 8,
              fontSize: 14,
              background: "rgba(239,68,68,0.07)",
              color: "#EF4444",
              border: "1px solid rgba(239,68,68,0.15)",
              fontFamily: "var(--font-dm-sans), sans-serif",
            }}>
              {error}
            </div>
          )}

          <div style={{ padding: "0 48px" }}>
            {showQuickStart ? (
              <QuickStartWidget />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                <SessionsWidget total={sessions.length} recentSession={recentSession} loading={loading} />
                <PipelineRunsWidget plan={plan} loading={loading} />
                <LastPipelineRunWidget recentSession={recentSession} detail={detail} loading={loading || detailLoading} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
