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

function statusColor(status: string): string {
  if (status === "completed") return "#3D6B5E";
  if (status === "active") return "#E8561B";
  if (status === "failed") return "#EF4444";
  return "#6B6B6B";
}

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  bg,
  textColor,
  hero,
  loading,
  thisWeek,
  delay,
}: {
  label: string;
  value: number;
  bg: string;
  textColor: string;
  hero: boolean;
  loading: boolean;
  thisWeek: number;
  delay: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bg,
        border: hero ? "none" : "1px solid #E4DDD4",
        borderRadius: 16,
        padding: 24,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: 0,
        animation: "fadeUp 0.45s ease forwards",
        animationDelay: delay,
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.08)" : "none",
        transition: "transform 200ms ease, box-shadow 200ms ease",
      }}
    >
      {hero && (
        <div style={{ position: "absolute", top: 20, right: 20 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </div>
      )}
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
        color: hero ? "rgba(255,255,255,0.7)" : "#6B6B6B",
        fontFamily: "var(--font-dm-sans), sans-serif",
      }}>
        {label}
      </div>
      {loading ? (
        <div style={{ height: 44, display: "flex", alignItems: "center" }}>
          <Shimmer width={56} height={36} radius={4} />
        </div>
      ) : (
        <div style={{
          fontFamily: "var(--font-instrument), 'Instrument Serif', serif",
          fontSize: "2.75rem",
          fontWeight: 400,
          letterSpacing: "-0.03em",
          color: textColor,
          lineHeight: 1,
        }}>
          {value}
        </div>
      )}
      <div style={{
        fontSize: 12,
        color: hero ? "rgba(255,255,255,0.65)" : "#6B6B6B",
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--font-dm-sans), sans-serif",
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
        +{thisWeek} this week
      </div>
    </div>
  );
}

function SessionRow({ session, onOpen }: { session: SessionSummary; onOpen: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const color = statusColor(session.status);
  const initials = session.session_name.slice(0, 2).toUpperCase();
  const statusLabel = session.status
    ? session.status.charAt(0).toUpperCase() + session.status.slice(1)
    : "—";

  return (
    <div
      onClick={() => onOpen(session.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 8px",
        borderRadius: 8,
        background: hovered ? "rgba(0,0,0,0.025)" : "transparent",
        cursor: "pointer",
        transition: "background 120ms ease",
      }}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: `${color}33`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        color,
        flexShrink: 0,
        fontFamily: "var(--font-dm-sans), sans-serif",
      }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: "#0D0D0D",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const,
          fontFamily: "var(--font-dm-sans), sans-serif",
        }}>
          {session.session_name}
        </div>
        <div style={{ fontSize: 11.5, color: "#6B6B6B", fontFamily: "var(--font-dm-sans), sans-serif" }}>
          Last updated {relativeTime(session.updated_at)}
        </div>
      </div>
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 99,
        background: `${color}26`,
        color,
        whiteSpace: "nowrap" as const,
        flexShrink: 0,
        fontFamily: "var(--font-dm-sans), sans-serif",
      }}>
        {statusLabel}
      </span>
    </div>
  );
}

function QuickActionRow({
  action,
  onNav,
  last,
}: {
  action: { label: string; route: string; color: string; icon: React.ReactNode };
  onNav: (r: string) => void;
  last: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onNav(action.route)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 8px",
        borderBottom: last ? "none" : "1px solid #F5F2EE",
        cursor: "pointer",
        borderRadius: 6,
        background: hovered ? "rgba(0,0,0,0.02)" : "transparent",
        transition: "background 120ms ease",
      }}
    >
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        background: `${action.color}1f`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: action.color,
      }}>
        {action.icon}
      </div>
      <div style={{
        flex: 1,
        fontSize: 13.5,
        fontWeight: 500,
        color: hovered ? action.color : "#0D0D0D",
        transition: "color 120ms ease",
        fontFamily: "var(--font-dm-sans), sans-serif",
      }}>
        {action.label}
      </div>
      <div style={{ fontSize: 11.5, color: "#6B6B6B", fontFamily: "var(--font-dm-sans), sans-serif" }}>
        → {action.route}
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { sessions, loading, error } = useSessions();
  const { plan, planLoading } = usePlan();

  // Derived stats
  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const active = sessions.filter((s) => s.status === "active").length;
  const thisWeek = sessions.filter(
    (s) => s.created_at && Date.now() - new Date(s.created_at).getTime() < 7 * 86400 * 1000
  ).length;

  // Recent sessions sorted by updated_at desc
  const recent = [...sessions]
    .sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5);

  // Bar chart — last 7 calendar days
  const today = new Date();
  const chartDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });
  const dayLabels = chartDays.map((d) => ["S", "M", "T", "W", "T", "F", "S"][d.getDay()]);
  const rawCounts = chartDays.map((d) => {
    const ds = d.toDateString();
    return sessions.filter(
      (s) => s.created_at && new Date(s.created_at).toDateString() === ds
    ).length;
  });
  const chartData = rawCounts.every((c) => c === 0) ? [2, 5, 3, 8, 4, 6, 1] : rawCounts;
  const maxCount = Math.max(...chartData, 1);
  const maxIdx = chartData.indexOf(Math.max(...chartData));

  // Plan usage %
  const usedPercent = plan
    ? plan.limit_type === "runs"
      ? Math.min(100, (plan.pipeline_runs_used / (plan.max_pipeline_runs ?? 2)) * 100)
      : Math.min(100, ((plan.api_credit_used_cents ?? 0) / (plan.max_credit_cents ?? 1)) * 100)
    : 0;

  const openSession = (id: string) => {
    localStorage.setItem("specflow_active_session_id", id);
    router.push("/sessions");
  };

  const showEmpty = !loading && sessions.length === 0 && !error;

  const quickActions = [
    {
      label: "New Session",
      route: "/sessions",
      color: "#E8561B",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
    },
    {
      label: "Surface Problems",
      route: "/problems",
      color: "#3D6B5E",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <circle cx="12" cy="16" r="0.5" fill="currentColor" />
        </svg>
      ),
    },
    {
      label: "Build Spec",
      route: "/prd",
      color: "#0D0D0D",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
        </svg>
      ),
    },
    {
      label: "Track tasks",
      route: "/tasks",
      color: "#F59E0B",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      ),
    },
  ];

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
            padding: "32px 40px 28px",
          }}>
            <div>
              <h1 style={{
                fontFamily: "var(--font-instrument), 'Instrument Serif', serif",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "#0D0D0D",
                lineHeight: 1.1,
                margin: 0,
              }}>
                Dashboard
              </h1>
              <p style={{ fontSize: 14, color: "#6B6B6B", margin: "6px 0 0", fontFamily: "var(--font-dm-sans), sans-serif" }}>
                Manage your AI pipeline runs.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              <Link href="/sessions" style={{
                fontSize: 13.5,
                fontWeight: 500,
                background: "#E8561B",
                color: "#FFFFFF",
                borderRadius: 8,
                padding: "10px 20px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-dm-sans), sans-serif",
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Session
              </Link>
              <Link href="/sessions" style={{
                fontSize: 13.5,
                fontWeight: 500,
                background: "transparent",
                color: "#0D0D0D",
                borderRadius: 8,
                padding: "10px 20px",
                border: "1px solid #E4DDD4",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                fontFamily: "var(--font-dm-sans), sans-serif",
              }}>
                Import Research
              </Link>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              margin: "0 40px 20px",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              background: "rgba(239,68,68,0.07)",
              color: "#EF4444",
              border: "1px solid rgba(239,68,68,0.15)",
              fontFamily: "var(--font-dm-sans), sans-serif",
            }}>
              {error}
            </div>
          )}

          {/* ── Row 1: Stat cards ─────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, padding: "0 40px 20px" }}>
            {[
              { label: "Total Sessions", value: total, bg: "#E8561B", textColor: "#FFFFFF", hero: true },
              { label: "Completed", value: completed, bg: "#FFFFFF", textColor: "#0D0D0D", hero: false },
              { label: "Active", value: active, bg: "#FFFFFF", textColor: "#0D0D0D", hero: false },
              { label: "PRDs Generated", value: completed, bg: "#FFFFFF", textColor: "#0D0D0D", hero: false },
            ].map((card, i) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                bg={card.bg}
                textColor={card.textColor}
                hero={card.hero}
                loading={loading}
                thisWeek={thisWeek}
                delay={`${0.05 + i * 0.05}s`}
              />
            ))}
          </div>

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {showEmpty ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 32,
              padding: "80px 40px",
              textAlign: "center",
            }}>
              <div>
                <h2 style={{
                  fontFamily: "var(--font-instrument), serif",
                  fontSize: "clamp(1.75rem, 3vw, 2.25rem)",
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: "#0D0D0D",
                  margin: "0 0 12px",
                }}>
                  Your first session awaits.
                </h2>
                <p style={{ fontSize: 14, color: "#6B6B6B", margin: 0, fontFamily: "var(--font-dm-sans), sans-serif" }}>
                  Paste your research, run the pipeline, and get a full PRD in minutes.
                </p>
              </div>
              <Link href="/sessions" className="btn-dark" style={{ fontSize: "0.9375rem", padding: "0.75rem 2.5rem" }}>
                Create your first session →
              </Link>
            </div>
          ) : (
            <>
              {/* ── Row 2: Pipeline Analytics + Activity + Plan ───────────── */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, padding: "0 40px 20px" }}>

                {/* Pipeline Analytics */}
                <div style={{ background: "#FFFFFF", border: "1px solid #E4DDD4", borderRadius: 16, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0D0D0D", fontFamily: "var(--font-dm-sans), sans-serif" }}>
                      Pipeline Analytics
                    </div>
                    <div style={{ fontSize: 12, color: "#6B6B6B", fontFamily: "var(--font-dm-sans), sans-serif" }}>
                      Last 7 days
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 200 }}>
                    {chartData.map((count, i) => {
                      const pct = (count / maxCount) * 100;
                      const barH = Math.max((pct / 100) * 160, 4);
                      const isMax = i === maxIdx;
                      const isSolid = i % 2 === 0;
                      const barBg = isMax
                        ? "#E8561B"
                        : isSolid
                        ? "#0D0D0D"
                        : "repeating-linear-gradient(45deg, #E4DDD4 0px, #E4DDD4 2px, transparent 2px, transparent 8px)";
                      return (
                        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end" }}>
                          {isMax ? (
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#E8561B", marginBottom: 4, fontFamily: "var(--font-dm-sans), sans-serif" }}>
                              {Math.round(pct)}%
                            </div>
                          ) : (
                            <div style={{ height: 19 }} />
                          )}
                          <div style={{
                            width: "100%",
                            maxWidth: 36,
                            height: barH,
                            background: barBg,
                            border: isMax || isSolid ? "none" : "1px solid #E4DDD4",
                            borderRadius: "6px 6px 0 0",
                          }} />
                          <div style={{ fontSize: 11, color: "#9E9E9E", marginTop: 6, fontFamily: "var(--font-dm-sans), sans-serif" }}>
                            {dayLabels[i]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right column: Recent Activity + Plan Usage */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Recent Activity */}
                  <div style={{ background: "#FFFFFF", border: "1px solid #E4DDD4", borderRadius: 16, padding: 20, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0D0D0D", marginBottom: 16, fontFamily: "var(--font-dm-sans), sans-serif" }}>
                      Recent Activity
                    </div>
                    {loading ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[0, 1, 2].map((j) => <Shimmer key={j} width="100%" height={12} />)}
                      </div>
                    ) : recent.slice(0, 3).length === 0 ? (
                      <p style={{ fontSize: 13, color: "#6B6B6B", margin: 0, fontFamily: "var(--font-dm-sans), sans-serif" }}>No activity yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {recent.slice(0, 3).map((s) => (
                          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(s.status), flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: "#0D0D0D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontFamily: "var(--font-dm-sans), sans-serif" }}>
                              {s.session_name}
                            </div>
                            <div style={{ fontSize: 11, color: "#6B6B6B", flexShrink: 0, fontFamily: "var(--font-dm-sans), sans-serif" }}>
                              {relativeTime(s.updated_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Plan Usage — dark accent card */}
                  <div style={{ background: "#0D0D0D", borderRadius: 12, padding: 20 }}>
                    <div style={{
                      fontFamily: "var(--font-instrument), 'Instrument Serif', serif",
                      fontSize: 16,
                      color: "#FFFFFF",
                      marginBottom: 14,
                    }}>
                      Plan Usage
                    </div>
                    {planLoading ? (
                      <div style={{ height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 99 }} />
                    ) : plan ? (
                      <>
                        <div style={{ height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 99, overflow: "hidden", marginBottom: 8 }}>
                          <div style={{
                            height: "100%",
                            width: `${usedPercent}%`,
                            background: usedPercent >= 90 ? "#EF4444" : "#E8561B",
                            borderRadius: 99,
                            transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                          }} />
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-dm-sans), sans-serif" }}>
                          {plan.limit_type === "runs"
                            ? `${plan.pipeline_runs_used} of ${plan.max_pipeline_runs} runs used`
                            : `$${(plan.api_credit_used_dollars ?? 0).toFixed(2)} of $${plan.max_credit_dollars?.toFixed(0)} used`}
                        </div>
                        {plan.plan !== "team" && (
                          <Link href="/pricing" style={{ fontSize: 12, fontWeight: 600, color: "#E8561B", textDecoration: "none", display: "inline-block", marginTop: 10, fontFamily: "var(--font-dm-sans), sans-serif" }}>
                            Upgrade plan →
                          </Link>
                        )}
                      </>
                    ) : (
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0, fontFamily: "var(--font-dm-sans), sans-serif" }}>
                        Could not load plan info.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Row 3: Recent Sessions + Quick Actions ────────────────── */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, padding: "0 40px" }}>

                {/* Recent Sessions */}
                <div style={{ background: "#FFFFFF", border: "1px solid #E4DDD4", borderRadius: 16, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0D0D0D", fontFamily: "var(--font-dm-sans), sans-serif" }}>
                      Recent Sessions
                    </div>
                    <Link href="/sessions" style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#0D0D0D",
                      border: "1px solid #E4DDD4",
                      borderRadius: 99,
                      padding: "4px 12px",
                      textDecoration: "none",
                      fontFamily: "var(--font-dm-sans), sans-serif",
                    }}>
                      + Add Session
                    </Link>
                  </div>

                  {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {[0, 1, 2, 3].map((j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Shimmer width={32} height={32} radius={99} />
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                            <Shimmer width={140} height={13} />
                            <Shimmer width={80} height={11} />
                          </div>
                          <Shimmer width={60} height={22} radius={99} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {recent.map((s) => (
                        <SessionRow key={s.id} session={s} onOpen={openSession} />
                      ))}
                      {recent.length > 0 && (
                        <button
                          onClick={() => router.push("/sessions")}
                          style={{
                            marginTop: 16,
                            fontSize: 12.5,
                            color: "#E8561B",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            fontFamily: "var(--font-dm-sans), sans-serif",
                          }}
                        >
                          View all sessions →
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Quick Actions */}
                <div style={{ background: "#FFFFFF", border: "1px solid #E4DDD4", borderRadius: 16, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0D0D0D", fontFamily: "var(--font-dm-sans), sans-serif" }}>
                      Quick Actions
                    </div>
                    <Link href="/sessions" style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#0D0D0D",
                      border: "1px solid #E4DDD4",
                      borderRadius: 99,
                      padding: "4px 12px",
                      textDecoration: "none",
                      fontFamily: "var(--font-dm-sans), sans-serif",
                    }}>
                      + New
                    </Link>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {quickActions.map((action, i) => (
                      <QuickActionRow
                        key={action.label}
                        action={action}
                        onNav={(r) => router.push(r)}
                        last={i === quickActions.length - 1}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
