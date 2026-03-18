"use client";

import { useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = "todo" | "in-progress" | "done";
type TaskType = "Frontend" | "Backend" | "API" | "Infrastructure";

interface TaskStep {
  id: string;
  title: string;
  done: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: "High" | "Medium" | "Low";
  steps: TaskStep[];
  dependencies: string[];
}

// ─── Mock Generator ───────────────────────────────────────────────────────────

function generateMockTasks(): Task[] {
  return [
    // FRONTEND (5)
    {
      id: "t1",
      title: "Build OnboardingShell screen",
      type: "Frontend",
      status: "todo",
      priority: "High",
      description:
        "Implement the full-screen container that manages step transitions and holds all onboarding sub-components. Supports forward/back navigation and a sticky CTA footer.",
      steps: [
        { id: "s1", title: "Create OnboardingShell layout component", done: false },
        { id: "s2", title: "Wire up step-transition animation (opacity + translateY)", done: false },
        { id: "s3", title: "Implement CTA footer with primary/skip actions", done: false },
        { id: "s4", title: "Add keyboard navigation (Enter to advance, Escape to skip)", done: false },
      ],
      dependencies: [],
    },
    {
      id: "t2",
      title: "Build DefaultsSelector component",
      type: "Frontend",
      status: "todo",
      priority: "High",
      description:
        "Pre-populated feature toggle group showing 2–3 recommended defaults. Users toggle pills and confirm before advancing.",
      steps: [
        { id: "s1", title: "Build FeaturePill toggle with active/inactive states", done: false },
        { id: "s2", title: "Render recommendation label and rationale tooltip", done: false },
        { id: "s3", title: "Connect to DefaultRecommendation API response", done: false },
      ],
      dependencies: ["GET /defaults/recommendations"],
    },
    {
      id: "t3",
      title: "Build ProgressStepper navigation",
      type: "Frontend",
      status: "todo",
      priority: "Medium",
      description:
        "Horizontal step indicator showing current position. Dots cycle through completed / active / pending states. Connector lines fill as steps complete.",
      steps: [
        { id: "s1", title: "Render step dots with 3 visual states", done: false },
        { id: "s2", title: "Animate connector line fill on step advance", done: false },
        { id: "s3", title: "Accept totalSteps + currentStep as props", done: false },
      ],
      dependencies: ["Build OnboardingShell screen"],
    },
    {
      id: "t4",
      title: "Build SettingsTourOverlay modal",
      type: "Frontend",
      status: "todo",
      priority: "Low",
      description:
        "Post-activation spotlight overlay introducing advanced settings. Appears once after first onboarding completion; dismissed by user or auto-dismissed after 10s.",
      steps: [
        { id: "s1", title: "Implement spotlight mask with target element cutout", done: false },
        { id: "s2", title: "Build tooltip card with Next/Dismiss controls", done: false },
        { id: "s3", title: "Set tourSeen flag on dismiss via PATCH /preferences", done: false },
      ],
      dependencies: ["Activate feature set endpoint", "UserPreferences model"],
    },
    {
      id: "t5",
      title: "Build ConfirmationCard component",
      type: "Frontend",
      status: "todo",
      priority: "Medium",
      description:
        "Final onboarding step summary card listing selected features before the user activates. Includes an Edit link to go back.",
      steps: [
        { id: "s1", title: "Render selected feature list with check icons", done: false },
        { id: "s2", title: "Wire Edit link to return to DefaultsSelector step", done: false },
        { id: "s3", title: "Trigger POST /onboarding/complete on Activate click", done: false },
      ],
      dependencies: ["Build DefaultsSelector component", "POST /onboarding/complete"],
    },

    // BACKEND (4)
    {
      id: "t6",
      title: "Create OnboardingSession model",
      type: "Backend",
      status: "todo",
      priority: "High",
      description:
        "Define the OnboardingSession table and ORM model. Includes userId, currentStep, totalSteps, selectedFeatures[], completedAt, and createdAt fields.",
      steps: [
        { id: "s1", title: "Write migration: create onboarding_sessions table", done: false },
        { id: "s2", title: "Define ORM model with field validations", done: false },
        { id: "s3", title: "Add userId foreign key constraint and index", done: false },
      ],
      dependencies: [],
    },
    {
      id: "t7",
      title: "Create UserPreferences model",
      type: "Backend",
      status: "todo",
      priority: "High",
      description:
        "Define UserPreferences table storing per-user feature flag map, tourSeen flag, and onboardingVersion. One row per user.",
      steps: [
        { id: "s1", title: "Write migration: create user_preferences table", done: false },
        { id: "s2", title: "Define ORM model and upsert method", done: false },
        { id: "s3", title: "Seed default row on user creation via post-signup hook", done: false },
      ],
      dependencies: [],
    },
    {
      id: "t8",
      title: "Seed DefaultRecommendation table",
      type: "Backend",
      status: "todo",
      priority: "Medium",
      description:
        "Write a seed script that populates the DefaultRecommendation table with the initial 3 recommended features, their labels, rationales, and ordering.",
      steps: [
        { id: "s1", title: "Create DefaultRecommendation migration", done: false },
        { id: "s2", title: "Write seed file with 3 default recommendations", done: false },
        { id: "s3", title: "Verify ordering by `order` field in query", done: false },
      ],
      dependencies: [],
    },
    {
      id: "t9",
      title: "Implement activate feature set logic",
      type: "Backend",
      status: "todo",
      priority: "High",
      description:
        "Business logic layer: on activation, write selected features to UserPreferences, mark OnboardingSession.completedAt, and fire onboarding_complete analytics event.",
      steps: [
        { id: "s1", title: "Write activateFeatureSet(userId, features) service function", done: false },
        { id: "s2", title: "Wrap in transaction: update prefs + session atomically", done: false },
        { id: "s3", title: "Emit onboarding_complete event to analytics queue", done: false },
      ],
      dependencies: ["OnboardingSession model", "UserPreferences model"],
    },

    // API (3)
    {
      id: "t10",
      title: "GET /onboarding/session",
      type: "API",
      status: "todo",
      priority: "High",
      description:
        "Returns or creates an OnboardingSession for the authenticated user. If no session exists, creates one with currentStep=1. Returns session state for the frontend to render the correct step.",
      steps: [
        { id: "s1", title: "Add route handler with auth middleware", done: false },
        { id: "s2", title: "Implement find-or-create session logic", done: false },
        { id: "s3", title: "Return { id, currentStep, totalSteps, selectedFeatures }", done: false },
      ],
      dependencies: ["OnboardingSession model"],
    },
    {
      id: "t11",
      title: "GET /defaults/recommendations",
      type: "API",
      status: "todo",
      priority: "High",
      description:
        "Returns the top 3 enabled DefaultRecommendation rows ordered by `order`. Used by DefaultsSelector to pre-populate feature toggles.",
      steps: [
        { id: "s1", title: "Add route handler", done: false },
        { id: "s2", title: "Query enabled=true ORDER BY order LIMIT 3", done: false },
        { id: "s3", title: "Return array of { id, featureKey, label, rationale }", done: false },
      ],
      dependencies: ["Seed DefaultRecommendation table"],
    },
    {
      id: "t12",
      title: "POST /onboarding/complete",
      type: "API",
      status: "todo",
      priority: "High",
      description:
        "Accepts { selectedFeatures: string[] } in request body. Calls activateFeatureSet service and returns { success: true, activatedFeatures }.",
      steps: [
        { id: "s1", title: "Add route with body validation (selectedFeatures required)", done: false },
        { id: "s2", title: "Call activateFeatureSet service", done: false },
        { id: "s3", title: "Return 200 with activated feature list", done: false },
      ],
      dependencies: ["Activate feature set logic"],
    },

    // INFRASTRUCTURE (3)
    {
      id: "t13",
      title: "Set up analytics event pipeline",
      type: "Infrastructure",
      status: "todo",
      priority: "Medium",
      description:
        "Configure the analytics event queue to handle the onboarding_complete event. Ensure the event schema includes userId, selectedFeatures[], and timestamp.",
      steps: [
        { id: "s1", title: "Define onboarding_complete event schema", done: false },
        { id: "s2", title: "Add queue consumer for the event type", done: false },
        { id: "s3", title: "Verify event appears in analytics dashboard", done: false },
      ],
      dependencies: [],
    },
    {
      id: "t14",
      title: "Configure feature flag service",
      type: "Infrastructure",
      status: "todo",
      priority: "High",
      description:
        "Ensure the feature flag service reads from UserPreferences.features at runtime. Add a helper that returns whether a given featureKey is enabled for a userId.",
      steps: [
        { id: "s1", title: "Create isFeatureEnabled(userId, featureKey) helper", done: false },
        { id: "s2", title: "Cache flag lookups with 60s TTL", done: false },
        { id: "s3", title: "Add cache invalidation on UserPreferences update", done: false },
      ],
      dependencies: ["UserPreferences model"],
    },
    {
      id: "t15",
      title: "Add viewport regression tests to CI",
      type: "Infrastructure",
      status: "todo",
      priority: "Low",
      description:
        "Add automated screenshot tests at 320px, 375px, and 414px viewports for all onboarding screens. Run on every PR. Fail build on visual diff > 2%.",
      steps: [
        { id: "s1", title: "Install playwright or percy in CI pipeline", done: false },
        { id: "s2", title: "Write viewport test suite for 3 breakpoints", done: false },
        { id: "s3", title: "Set visual diff threshold to 2% and wire to PR checks", done: false },
      ],
      dependencies: ["Build OnboardingShell screen", "Build DefaultsSelector component"],
    },
  ];
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

// ─── Tasks Page ───────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<TaskType>>(
    new Set<TaskType>(["Frontend", "Backend", "API", "Infrastructure"])
  );
  // Status overrides: user can change task status interactively
  const [statusMap, setStatusMap] = useState<Record<string, TaskStatus>>({});
  // Step done overrides: per-task, per-step
  const [stepsMap, setStepsMap] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;
  const effectiveStatus = (t: Task): TaskStatus => statusMap[t.id] ?? t.status;

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

  async function handleGenerate() {
    setGenerating(true);
    setSelectedId(null);
    setStatusMap({});
    setStepsMap({});
    await new Promise((r) => setTimeout(r, 1400));
    const mocks = generateMockTasks();
    setTasks(mocks);
    setSelectedId(mocks[0].id);
    setGenerating(false);
  }

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
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <Sidebar />

      {/* Main */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "hidden",
        }}
      >
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
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {tasks.length > 0 && (
              <button
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
                  color: "#6B6B6B",
                  cursor: "pointer",
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
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
                Export
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0.4rem 0.875rem",
                borderRadius: 8,
                fontSize: "0.8125rem",
                fontWeight: 500,
                background: generating ? "#F8F4EF" : "#FFFFFF",
                border: "1.5px solid #E4DDD4",
                color: generating ? "#9E9E9E" : "#0D0D0D",
                cursor: generating ? "not-allowed" : "pointer",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
            >
              {generating ? (
                <>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: "1.5px solid #E4DDD4",
                      borderTopColor: "#E8561B",
                      display: "inline-block",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  Generating…
                </>
              ) : (
                "Generate Tasks"
              )}
            </button>
          </div>
        </header>

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
              <p
                style={{
                  fontSize: 12.5,
                  color: "#9E9E9E",
                  margin: "4px 0 0",
                  lineHeight: 1.5,
                }}
              >
                Generate an execution plan from your decomposition.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="btn-dark"
              style={{
                fontSize: "0.8125rem",
                padding: "0.45rem 1rem",
                marginTop: 4,
              }}
            >
              Generate Tasks
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
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "2px solid #E4DDD4",
                borderTopColor: "#E8561B",
                display: "inline-block",
                animation: "spin 0.7s linear infinite",
              }}
            />
            <span style={{ fontSize: 13, color: "#9E9E9E" }}>
              Generating tasks…
            </span>
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
    </div>
  );
}
