"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";

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

// ─── Data hook ────────────────────────────────────────────────────────────────

function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sessions", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((body: { sessions?: SessionSummary[] }) => {
        if (!cancelled) {
          setSessions(body.sessions ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load sessions.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { sessions, loading, error };
}

// ─── Plan hook ────────────────────────────────────────────────────────────────

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

// ─── Plan Usage Card ──────────────────────────────────────────────────────────

function PlanUsageCard({ plan, loading }: { plan: UserPlan | null; loading: boolean }) {
  const PLAN_COLORS: Record<string, string> = {
    free: "#6B6B6B",
    pro: "#E8561B",
    unlimited: "#3D6B5E",
  };
  const accent = plan ? (PLAN_COLORS[plan.plan] ?? "#6B6B6B") : "#6B6B6B";

  const usedPercent = plan
    ? plan.limit_type === "runs"
      ? Math.min(100, ((plan.pipeline_runs_used) / (plan.max_pipeline_runs ?? 2)) * 100)
      : Math.min(100, ((plan.api_credit_used_cents ?? 0) / (plan.max_credit_cents ?? 1)) * 100)
    : 0;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4DDD4",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2
            className="text-[14px] font-semibold"
            style={{ color: "#0D0D0D", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
          >
            Plan &amp; Usage
          </h2>
          {!loading && plan && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                background: `${accent}1a`,
                color: accent,
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                textTransform: "uppercase",
              }}
            >
              {plan.plan_label}
            </span>
          )}
        </div>
        <Link
          href="/pricing"
          className="text-[12px] font-medium"
          style={{ color: "#E8561B", textDecoration: "none" }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
        >
          {plan?.plan === "unlimited" ? "View plans" : "Upgrade"}
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton h-2.5 w-full rounded-full" />
          <div className="skeleton h-3 w-32 rounded" />
        </div>
      ) : plan ? (
        <div className="flex flex-col gap-3">
          {/* Progress bar */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                height: 6,
                background: "#F0EAE1",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${usedPercent}%`,
                  background: usedPercent >= 90 ? "#EF4444" : accent,
                  borderRadius: 99,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>

          {/* Usage text */}
          {plan.limit_type === "runs" ? (
            <div className="flex items-center justify-between">
              <span className="text-[12.5px]" style={{ color: "#6B6B6B", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
                <strong style={{ color: "#0D0D0D" }}>{plan.pipeline_runs_used}</strong> of{" "}
                {plan.max_pipeline_runs} full pipeline runs used
              </span>
              <span className="text-[12px]" style={{ color: plan.pipeline_runs_remaining === 0 ? "#EF4444" : "#9E9E9E", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
                {plan.pipeline_runs_remaining} remaining
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[12.5px]" style={{ color: "#6B6B6B", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
                <strong style={{ color: "#0D0D0D" }}>${plan.api_credit_used_dollars.toFixed(2)}</strong> of{" "}
                ${plan.max_credit_dollars?.toFixed(0)} API credit used
              </span>
              <span className="text-[12px]" style={{ color: "#9E9E9E", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
                ${plan.credit_remaining_dollars?.toFixed(2)} left
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12.5px]" style={{ color: "#9E9E9E" }}>
          Could not load plan info. Make sure the backend is running.
        </p>
      )}
    </div>
  );
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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
  loading,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  accent: string;
  loading: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-3 p-5 rounded-2xl"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4DDD4",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium" style={{ color: "#6B6B6B", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
          {label}
        </span>
        <div
          className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: `${accent}1a` }}
        >
          <div style={{ color: accent }}>{icon}</div>
        </div>
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          <div className="skeleton h-8 w-16 rounded-lg" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
      ) : (
        <div>
          <div
            className="text-[1.75rem] font-semibold tracking-tight"
            style={{ color: "#0D0D0D", letterSpacing: "-0.03em", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
          >
            {value}
          </div>
          <div className="text-[12px] mt-1" style={{ color: "#9E9E9E", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
            {sub}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    completed: { bg: "rgba(61,107,94,0.1)", color: "#3D6B5E", label: "Completed" },
    active:    { bg: "rgba(232,86,27,0.1)", color: "#E8561B", label: "Active" },
    failed:    { bg: "rgba(239,68,68,0.1)", color: "#EF4444", label: "Failed" },
  };
  const s = map[status] ?? { bg: "rgba(107,107,107,0.1)", color: "#6B6B6B", label: status };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        background: s.bg,
        color: s.color,
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
        textTransform: "capitalize",
      }}
    >
      {s.label}
    </span>
  );
}

// ─── Session Row ──────────────────────────────────────────────────────────────

function SessionRow({ session }: { session: SessionSummary }) {
  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ borderBottom: "1px solid #F0EAE1" }}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
        style={{
          background:
            session.status === "completed" ? "#3D6B5E"
            : session.status === "active" ? "#E8561B"
            : "#6B6B6B",
        }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-[13.5px] font-medium truncate"
          style={{ color: "#0D0D0D", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
        >
          {session.session_name}
        </p>
        <StatusBadge status={session.status} />
      </div>
      <span
        className="text-[11.5px] flex-shrink-0"
        style={{ color: "#9a9085", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
      >
        {relativeTime(session.created_at)}
      </span>
    </div>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid #F0EAE1" }}>
      <div className="skeleton w-2 h-2 rounded-full flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="skeleton h-3.5 w-40 rounded" />
        <div className="skeleton h-3 w-16 rounded" />
      </div>
      <div className="skeleton h-3 w-10 rounded flex-shrink-0" />
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-14 gap-4"
      style={{ color: "#6B6B6B", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E4DDD4" strokeWidth="1.4" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
      <div className="text-center">
        <p className="text-[14px] font-medium" style={{ color: "#0D0D0D" }}>No sessions yet</p>
        <p className="text-[13px] mt-1" style={{ color: "#6B6B6B" }}>
          Create your first session to start the pipeline.
        </p>
      </div>
      <Link
        href="/sessions"
        className="text-[13px] font-medium px-4 py-2 rounded-lg transition-colors duration-150"
        style={{
          background: "#E8561B",
          color: "#FFFFFF",
          textDecoration: "none",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#D04A14"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "#E8561B"; }}
      >
        Go to Sessions
      </Link>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { sessions, loading, error } = useSessions();
  const { plan, planLoading } = usePlan();

  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const active = sessions.filter((s) => s.status === "active").length;
  const stepsRun = completed * 4;

  const recent = [...sessions]
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5);

  const quickActions = [
    {
      label: "New Session",
      sub: "Start the pipeline",
      color: "#E8561B",
      onClick: () => router.push("/sessions"),
    },
    {
      label: "View Problems",
      sub: "Surface pain points",
      color: "#3D6B5E",
      onClick: () => router.push("/problems"),
    },
    {
      label: "Generate Tasks",
      sub: "Create action items",
      color: "#F59E0B",
      onClick: () => router.push("/tasks"),
    },
    {
      label: "Build PRD",
      sub: "Export a full spec",
      color: "#0D0D0D",
      onClick: () => router.push("/prd"),
    },
  ];

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position:  400px 0 }
        }
        .skeleton {
          background: linear-gradient(90deg, #F0EAE1 25%, #F8F4EF 50%, #F0EAE1 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite linear;
        }
      `}</style>

      <div
        className="flex h-screen overflow-hidden"
        style={{ background: "#F8F4EF", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
      >
        <Sidebar />

        {/* Main area */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header
            className="flex items-center justify-between px-6 flex-shrink-0"
            style={{
              height: 52,
              background: "#FFFFFF",
              borderBottom: "1px solid #E4DDD4",
            }}
          >
            <div className="flex items-center gap-1.5 text-[13px]" style={{ color: "#6B6B6B" }}>
              <span className="font-medium" style={{ color: "#0D0D0D" }}>Dashboard</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/sessions"
                className="text-[13px] font-medium px-3 py-1.5 rounded-lg transition-colors duration-150"
                style={{ color: "#E8561B", textDecoration: "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(232,86,27,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                Sessions
              </Link>
              {/* Search */}
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150"
                style={{ color: "#6B6B6B" }}
                onClick={() => router.push("/research")}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                aria-label="Search"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </button>

              {/* Bell */}
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-lg relative transition-colors duration-150"
                style={{ color: "#6B6B6B" }}
                onClick={() => router.push("/sessions")}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                aria-label="Notifications"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                <span
                  className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: "#E8561B" }}
                />
              </button>

              {/* Divider */}
              <div style={{ width: 1, height: 20, background: "#E4DDD4" }} />

              {/* User avatar */}
              <button
                type="button"
                className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors duration-150"
                onClick={() => router.push("/sessions")}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                  style={{ background: "#E8561B" }}
                >
                  S
                </div>
              </button>
            </div>
          </header>

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto px-6 py-6">
            {/* Page heading */}
            <div className="mb-6">
              <h1
                style={{
                  fontFamily: "var(--font-instrument), 'Instrument Serif', serif",
                  fontSize: "1.625rem",
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  color: "#0D0D0D",
                  lineHeight: 1.2,
                }}
              >
                Good morning.{" "}
                <span style={{ color: "#E8561B", fontStyle: "italic" }}>Here&apos;s your overview.</span>
              </h1>
              <p className="text-[13.5px] mt-1" style={{ color: "#6B6B6B" }}>
                Track your sessions and pipeline progress in one place.
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div
                className="mb-5 px-4 py-3 rounded-xl text-[13px]"
                style={{ background: "rgba(239,68,68,0.07)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.15)" }}
              >
                {error}
              </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Total Sessions"
                value={total}
                sub="All time"
                loading={loading}
                accent="#E8561B"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                }
              />
              <StatCard
                label="Completed"
                value={completed}
                sub="Pipeline finished"
                loading={loading}
                accent="#3D6B5E"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                }
              />
              <StatCard
                label="Active"
                value={active}
                sub="In progress"
                loading={loading}
                accent="#F59E0B"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                }
              />
              <StatCard
                label="Pipeline Steps Run"
                value={stepsRun}
                sub="~4 steps per session"
                loading={loading}
                accent="#0D0D0D"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                }
              />
            </div>

            {/* Plan & Usage */}
            <div className="mb-4">
              <PlanUsageCard plan={plan} loading={planLoading} />
            </div>

            {/* Bottom row: Recent Sessions + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Recent Sessions */}
              <div
                className="lg:col-span-2 rounded-2xl p-5"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E4DDD4",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <h2
                    className="text-[14px] font-semibold"
                    style={{ color: "#0D0D0D", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                  >
                    Recent Sessions
                  </h2>
                  <button
                    type="button"
                    className="text-[12px] font-medium"
                    style={{ color: "#E8561B" }}
                    onClick={() => router.push("/sessions")}
                  >
                    View all
                  </button>
                </div>

                {loading ? (
                  <div>
                    {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
                  </div>
                ) : sessions.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div>
                    {recent.map((s) => (
                      <SessionRow key={s.id} session={s} />
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E4DDD4",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <h2
                  className="text-[14px] font-semibold"
                  style={{ color: "#0D0D0D", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                >
                  Quick Actions
                </h2>

                {quickActions.map((action) => (
                  <button
                    type="button"
                    key={action.label}
                    className="flex items-center gap-3 p-3 rounded-xl text-left w-full transition-colors duration-150"
                    style={{ border: "1px solid #E4DDD4" }}
                    onClick={action.onClick}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${action.color}1a` }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ background: action.color }} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-[13px] font-medium"
                        style={{ color: "#0D0D0D", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                      >
                        {action.label}
                      </p>
                      <p
                        className="text-[11.5px]"
                        style={{ color: "#6B6B6B", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                      >
                        {action.sub}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
