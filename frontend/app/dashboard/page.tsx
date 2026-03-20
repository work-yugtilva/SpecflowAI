"use client";

import Link from "next/link";
import { Sidebar } from "@/components/ui/sidebar";

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  trend,
  trendUp,
  icon,
  accent,
}: {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: React.ReactNode;
  accent: string;
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
        <span className="text-[13px] font-medium" style={{ color: "#6B6B6B" }}>{label}</span>
        <div
          className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: `${accent}1a` }}
        >
          <div style={{ color: accent }}>{icon}</div>
        </div>
      </div>
      <div>
        <div className="text-[1.75rem] font-semibold tracking-tight" style={{ color: "#0D0D0D", letterSpacing: "-0.03em" }}>
          {value}
        </div>
        <div className="text-[12px] mt-1 flex items-center gap-1" style={{ color: trendUp ? "#22C55E" : "#6B6B6B" }}>
          {trendUp ? "↑" : "→"} {trend}
        </div>
      </div>
    </div>
  );
}

// ─── Activity Item ────────────────────────────────────────────────────────────

function ActivityItem({
  title,
  sub,
  time,
  dot,
}: {
  title: string;
  sub: string;
  time: string;
  dot: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid #F0EAE1" }}>
      <div
        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
        style={{ background: dot }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-medium truncate" style={{ color: "#0D0D0D" }}>{title}</p>
        <p className="text-[12px] mt-0.5 truncate" style={{ color: "#6B6B6B" }}>{sub}</p>
      </div>
      <span className="text-[11.5px] flex-shrink-0" style={{ color: "#9a9085" }}>{time}</span>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F8F4EF", fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
      {/* Sidebar */}
      <div className="h-full relative flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 flex-shrink-0"
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
          }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[13px]" style={{ color: "#6B6B6B" }}>
            <span className="font-medium" style={{ color: "#0D0D0D" }}>Dashboard</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/sessions"
              className="text-[13px] font-medium px-3 py-1.5 rounded-lg transition-colors duration-150"
              style={{ color: "#E8561B" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(232,86,27,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Sessions
            </Link>
            {/* Search */}
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150"
              style={{ color: "#6B6B6B" }}
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
              className="w-8 h-8 flex items-center justify-center rounded-lg relative transition-colors duration-150"
              style={{ color: "#6B6B6B" }}
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
              className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors duration-150"
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                style={{ background: "#E8561B" }}
              >
                Y
              </div>
              <span className="text-[13px] font-medium hidden sm:block" style={{ color: "#0D0D0D" }}>Yug</span>
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* Page heading */}
          <div className="mb-6">
            <h1
              className="font-display"
              style={{
                fontSize: "1.625rem",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "#0D0D0D",
                lineHeight: 1.2,
              }}
            >
              Good morning, Yug.{" "}
              <span style={{ color: "#E8561B", fontStyle: "italic" }}>Here&apos;s your overview.</span>
            </h1>
            <p className="text-[13.5px] mt-1" style={{ color: "#6B6B6B" }}>
              Track your specs, reviews, and team progress in one place.
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Specs"
              value="142"
              trend="12 this week"
              trendUp={true}
              accent="#E8561B"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              }
            />
            <StatCard
              label="AI Reviews"
              value="8"
              trend="Pending review"
              trendUp={false}
              accent="#8B5CF6"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              }
            />
            <StatCard
              label="Test Coverage"
              value="84%"
              trend="+3% from last sprint"
              trendUp={true}
              accent="#22C55E"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              }
            />
            <StatCard
              label="Active Tasks"
              value="23"
              trend="5 due today"
              trendUp={false}
              accent="#F59E0B"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              }
            />
          </div>

          {/* Bottom row: Recent Activity + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recent Activity */}
            <div
              className="lg:col-span-2 rounded-2xl p-5"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E4DDD4",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[14px] font-semibold" style={{ color: "#0D0D0D" }}>
                  Recent Activity
                </h2>
                <button className="text-[12px] font-medium" style={{ color: "#E8561B" }}>
                  View all
                </button>
              </div>
              <div>
                <ActivityItem
                  title="Payment Flow Spec updated"
                  sub="Solution › Spec"
                  time="2m ago"
                  dot="#E8561B"
                />
                <ActivityItem
                  title="Root Cause Analysis complete"
                  sub="Problem › Root Cause"
                  time="34m ago"
                  dot="#8B5CF6"
                />
                <ActivityItem
                  title="AI Review: Onboarding PRD"
                  sub="Documents › PRDs"
                  time="1h ago"
                  dot="#22C55E"
                />
                <ActivityItem
                  title="Go-To-Market strategy drafted"
                  sub="Growth › Go-To-Market"
                  time="3h ago"
                  dot="#F59E0B"
                />
                <ActivityItem
                  title="Release checklist v2.1 ready"
                  sub="Build › Release"
                  time="5h ago"
                  dot="#06B6D4"
                />
              </div>
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
              <h2 className="text-[14px] font-semibold" style={{ color: "#0D0D0D" }}>
                Quick Actions
              </h2>

              {[
                { label: "New Spec", sub: "Start from a prompt", color: "#E8561B" },
                { label: "AI Review", sub: "Submit a spec for review", color: "#8B5CF6" },
                { label: "Add Task", sub: "Create in active sprint", color: "#F59E0B" },
                { label: "Invite Teammate", sub: "Grow your workspace", color: "#22C55E" },
              ].map((action) => (
                <button
                  key={action.label}
                  className="flex items-center gap-3 p-3 rounded-xl text-left w-full transition-colors duration-150"
                  style={{ border: "1px solid #E4DDD4" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${action.color}1a` }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: action.color }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: "#0D0D0D" }}>{action.label}</p>
                    <p className="text-[11.5px]" style={{ color: "#6B6B6B" }}>{action.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
