"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UIComponent {
  id: string;
  name: string;
  type: "Screen" | "Modal" | "Component" | "Form" | "Navigation";
  description: string;
  elements: string[];
}

interface DataField {
  name: string;
  type: string;
  required: boolean;
}

interface DataEntity {
  id: string;
  name: string;
  fields: DataField[];
}

interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  actor: "User" | "System" | "API" | "Background";
  outputs: string[];
}

interface Decomposition {
  featureTitle: string;
  linkedProblem: string;
  uiComponents: UIComponent[];
  dataEntities: DataEntity[];
  workflowSteps: WorkflowStep[];
}

// ─── Mock Generator ───────────────────────────────────────────────────────────

function generateMockDecomposition(): Decomposition {
  return {
    featureTitle: "Progressive onboarding with contextual defaults",
    linkedProblem: "Onboarding drop-off after step 2",
    uiComponents: [
      {
        id: "ui1",
        name: "OnboardingShell",
        type: "Screen",
        description:
          "Full-screen container managing step transitions and overall onboarding state.",
        elements: [
          "Progress indicator bar",
          "Back / Skip navigation",
          "Step content slot",
          "CTA footer",
        ],
      },
      {
        id: "ui2",
        name: "DefaultsSelector",
        type: "Component",
        description:
          "Pre-populated feature toggle group showing 2–3 recommended defaults. Users confirm or deselect before continuing.",
        elements: [
          "Feature pill (toggleable)",
          "Recommendation label",
          "'Why this?' tooltip",
          "Confirm button",
        ],
      },
      {
        id: "ui3",
        name: "ProgressStepper",
        type: "Navigation",
        description:
          "Horizontal step indicator showing current position within the onboarding flow. Supports 3–6 steps.",
        elements: [
          "Step dot (completed / active / pending)",
          "Step label (optional)",
          "Connector line",
        ],
      },
      {
        id: "ui4",
        name: "SettingsTourOverlay",
        type: "Modal",
        description:
          "Post-activation overlay that introduces advanced settings. Triggered once after first successful onboarding completion.",
        elements: [
          "Spotlight mask",
          "Tooltip card",
          "Next / Dismiss controls",
          "Progress counter",
        ],
      },
      {
        id: "ui5",
        name: "ConfirmationCard",
        type: "Component",
        description:
          "Summary card at final onboarding step showing selected features before activation.",
        elements: [
          "Selected feature list",
          "Edit link",
          "Activate button",
          "Skip for now link",
        ],
      },
    ],
    dataEntities: [
      {
        id: "d1",
        name: "OnboardingSession",
        fields: [
          { name: "id", type: "uuid", required: true },
          { name: "userId", type: "uuid", required: true },
          { name: "currentStep", type: "integer", required: true },
          { name: "totalSteps", type: "integer", required: true },
          { name: "selectedFeatures", type: "string[]", required: false },
          { name: "completedAt", type: "timestamp | null", required: false },
          { name: "createdAt", type: "timestamp", required: true },
        ],
      },
      {
        id: "d2",
        name: "UserPreferences",
        fields: [
          { name: "userId", type: "uuid", required: true },
          { name: "features", type: "Record<string, boolean>", required: true },
          { name: "tourSeen", type: "boolean", required: true },
          { name: "onboardingVersion", type: "string", required: true },
          { name: "updatedAt", type: "timestamp", required: true },
        ],
      },
      {
        id: "d3",
        name: "DefaultRecommendation",
        fields: [
          { name: "id", type: "uuid", required: true },
          { name: "featureKey", type: "string", required: true },
          { name: "label", type: "string", required: true },
          { name: "rationale", type: "string", required: false },
          { name: "enabled", type: "boolean", required: true },
          { name: "order", type: "integer", required: true },
        ],
      },
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Load onboarding context",
        description:
          "On first login, check if an active OnboardingSession exists. If not, create one with currentStep=1.",
        actor: "System",
        outputs: ["OnboardingSession created or resumed"],
      },
      {
        step: 2,
        title: "Fetch default recommendations",
        description:
          "Query DefaultRecommendation table ordered by `order` field. Return top 3 enabled recommendations.",
        actor: "API",
        outputs: ["DefaultRecommendation[]"],
      },
      {
        step: 3,
        title: "Present defaults to user",
        description:
          "Render DefaultsSelector with pre-checked toggles. User reviews and optionally deselects features.",
        actor: "User",
        outputs: ["Selected feature keys array"],
      },
      {
        step: 4,
        title: "Persist user selections",
        description:
          "On confirmation, write selected feature keys to UserPreferences.features. Advance session step.",
        actor: "System",
        outputs: [
          "UserPreferences updated",
          "OnboardingSession.currentStep incremented",
        ],
      },
      {
        step: 5,
        title: "Render ConfirmationCard",
        description:
          "Show summary of selected features. User can edit (go back) or activate.",
        actor: "User",
        outputs: ["Activation intent confirmed"],
      },
      {
        step: 6,
        title: "Activate feature set",
        description:
          "Apply selected features to the user account. Mark OnboardingSession.completedAt. Fire activation event.",
        actor: "System",
        outputs: [
          "Feature flags activated",
          "completedAt timestamp set",
          "onboarding_complete event fired",
        ],
      },
      {
        step: 7,
        title: "Trigger settings tour",
        description:
          "If UserPreferences.tourSeen is false, schedule SettingsTourOverlay after a 2s delay post-activation.",
        actor: "Background",
        outputs: ["Tour overlay displayed", "tourSeen set to true on dismiss"],
      },
    ],
  };
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const UI_TYPE_COLORS: Record<
  UIComponent["type"],
  { bg: string; color: string }
> = {
  Screen: { bg: "#EFF6FF", color: "#3B82F6" },
  Modal: { bg: "#F5F3FF", color: "#7C3AED" },
  Component: { bg: "#F0FDF4", color: "#16A34A" },
  Form: { bg: "#FFF7ED", color: "#D97706" },
  Navigation: { bg: "#F8F4EF", color: "#9E9E9E" },
};

const ACTOR_COLORS: Record<
  WorkflowStep["actor"],
  { bg: string; color: string }
> = {
  User: { bg: "#EFF6FF", color: "#3B82F6" },
  System: { bg: "#F0FDF4", color: "#16A34A" },
  API: { bg: "#FFF7ED", color: "#D97706" },
  Background: { bg: "#F5F3FF", color: "#7C3AED" },
};

function TypeBadge({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: bg,
        color,
        letterSpacing: "0.01em",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#9E9E9E",
        marginBottom: 6,
        marginTop: 10,
      }}
    >
      {children}
    </div>
  );
}

// ─── Decompose Page ───────────────────────────────────────────────────────────

export default function DecomposePage() {
  const router = useRouter();
  const [decomposition, setDecomposition] = useState<Decomposition | null>(
    null
  );
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1400));
    setDecomposition(generateMockDecomposition());
    setGenerating(false);
  }

  const dm = decomposition;

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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
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
          {/* Left: breadcrumb + feature chip */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span
              style={{
                fontSize: 13,
                color: "#9E9E9E",
                fontWeight: 400,
                whiteSpace: "nowrap",
              }}
            >
              Signals
            </span>
            <span style={{ fontSize: 13, color: "#C8C2BB" }}>›</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#0D0D0D",
                whiteSpace: "nowrap",
              }}
            >
              Decompose
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 11,
                background: "#F3F4F6",
                color: "#3D3D3D",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 300,
              }}
            >
              ↳ Progressive onboarding with contextual defaults
            </span>
          </div>

          {/* Right: action buttons */}
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
          >
            {dm && (
              <button
                onClick={() => router.push("/tasks")}
                className="btn-dark"
                style={{ fontSize: "0.8125rem", padding: "0.4rem 0.875rem" }}
              >
                Generate Tasks →
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
                  Decomposing…
                </>
              ) : (
                "Generate Decomposition"
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        {!dm && !generating ? (
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
              {/* Layers / architecture icon */}
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
              >
                <rect x="4" y="5" width="20" height="5" rx="1.5" stroke="#E8561B" strokeWidth="1.5" />
                <rect x="4" y="12" width="20" height="5" rx="1.5" stroke="#E8561B" strokeWidth="1.5" />
                <rect x="4" y="19" width="20" height="5" rx="1.5" stroke="#E8561B" strokeWidth="1.5" />
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
                No decomposition generated yet.
              </p>
              <p
                style={{
                  fontSize: 12.5,
                  color: "#9E9E9E",
                  margin: "4px 0 0",
                  lineHeight: 1.5,
                }}
              >
                Break down a feature into UI, data, and workflow layers.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="btn-dark"
              style={{ fontSize: "0.8125rem", padding: "0.45rem 1rem", marginTop: 4 }}
            >
              Generate Decomposition
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
              Decomposing feature…
            </span>
          </div>
        ) : (
          // Three-column layout
          <div
            style={{
              flex: 1,
              display: "flex",
              overflow: "hidden",
            }}
          >
            {/* Column 1 — UI Proposals */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderRight: "1px solid #E4DDD4",
                overflow: "hidden",
              }}
            >
              {/* Column header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #E4DDD4",
                  background: "#FFFFFF",
                  position: "sticky",
                  top: 0,
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
                  UI Proposals
                </span>
                <span style={{ fontSize: 11, color: "#6B6B6B" }}>
                  {dm!.uiComponents.length} components
                </span>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: "auto", background: "#F8F4EF" }}>
                {dm!.uiComponents.map((comp) => {
                  const badge = UI_TYPE_COLORS[comp.type];
                  return (
                    <div
                      key={comp.id}
                      style={{
                        margin: 12,
                        padding: 14,
                        border: "1px solid #E4DDD4",
                        borderRadius: 8,
                        background: "#FFFFFF",
                      }}
                    >
                      {/* Name + type badge */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <TypeBadge
                          label={comp.type}
                          bg={badge.bg}
                          color={badge.color}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#0D0D0D",
                          }}
                        >
                          {comp.name}
                        </span>
                      </div>

                      {/* Description */}
                      <p
                        style={{
                          fontSize: 12,
                          color: "#6B6B6B",
                          lineHeight: 1.5,
                          margin: 0,
                        }}
                      >
                        {comp.description}
                      </p>

                      {/* Elements */}
                      <SectionLabel>Elements</SectionLabel>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 16,
                          listStyle: "disc",
                        }}
                      >
                        {comp.elements.map((el, i) => (
                          <li
                            key={i}
                            style={{ fontSize: 12, color: "#3D3D3D", lineHeight: 1.6 }}
                          >
                            {el}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 2 — Data Model */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderRight: "1px solid #E4DDD4",
                overflow: "hidden",
              }}
            >
              {/* Column header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #E4DDD4",
                  background: "#FFFFFF",
                  position: "sticky",
                  top: 0,
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
                  Data Model
                </span>
                <span style={{ fontSize: 11, color: "#6B6B6B" }}>
                  {dm!.dataEntities.length} entities
                </span>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: "auto", background: "#F8F4EF" }}>
                {dm!.dataEntities.map((entity) => (
                  <div
                    key={entity.id}
                    style={{
                      margin: 12,
                      padding: 14,
                      border: "1px solid #E4DDD4",
                      borderRadius: 8,
                      background: "#FFFFFF",
                    }}
                  >
                    {/* Entity name */}
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0D0D0D",
                        marginBottom: 10,
                        paddingBottom: 8,
                        borderBottom: "1px solid #E4DDD4",
                      }}
                    >
                      {entity.name}
                    </div>

                    {/* Fields table */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {entity.fields.map((field, i) => (
                        <div
                          key={field.name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "4px 0",
                            borderBottom:
                              i < entity.fields.length - 1
                                ? "1px solid #F0EDE9"
                                : "none",
                          }}
                        >
                          {/* Field name */}
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: "#0D0D0D",
                              flex: "0 0 110px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {field.name}
                          </span>
                          {/* Type */}
                          <span
                            style={{
                              fontSize: 11.5,
                              fontFamily:
                                "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
                              color: "#6B6B6B",
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {field.type}
                          </span>
                          {/* Required dot */}
                          {field.required && (
                            <span
                              title="Required"
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "#E8561B",
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Legend */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 10,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#E8561B",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 10.5, color: "#9E9E9E" }}>
                        required
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 3 — Workflow */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Column header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #E4DDD4",
                  background: "#FFFFFF",
                  position: "sticky",
                  top: 0,
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
                  Workflow
                </span>
                <span style={{ fontSize: 11, color: "#6B6B6B" }}>
                  {dm!.workflowSteps.length} steps
                </span>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: "auto", background: "#F8F4EF" }}>
                {dm!.workflowSteps.map((step, i) => {
                  const actorBadge = ACTOR_COLORS[step.actor];
                  return (
                    <div key={step.step}>
                      <div
                        style={{
                          margin: 12,
                          padding: 14,
                          border: "1px solid #E4DDD4",
                          borderRadius: 8,
                          background: "#FFFFFF",
                        }}
                      >
                        {/* Step number + title + actor */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#C8C2BB",
                              flexShrink: 0,
                              minWidth: 20,
                            }}
                          >
                            {String(step.step).padStart(2, "0")}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#0D0D0D",
                              flex: 1,
                            }}
                          >
                            {step.title}
                          </span>
                          <TypeBadge
                            label={step.actor}
                            bg={actorBadge.bg}
                            color={actorBadge.color}
                          />
                        </div>

                        {/* Description */}
                        <p
                          style={{
                            fontSize: 12,
                            color: "#6B6B6B",
                            lineHeight: 1.5,
                            margin: 0,
                          }}
                        >
                          {step.description}
                        </p>

                        {/* Outputs */}
                        {step.outputs.length > 0 && (
                          <>
                            <SectionLabel>Outputs</SectionLabel>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                              }}
                            >
                              {step.outputs.map((out, j) => (
                                <div
                                  key={j}
                                  style={{
                                    fontSize: 12,
                                    color: "#3D3D3D",
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 6,
                                  }}
                                >
                                  <span style={{ color: "#E8561B", flexShrink: 0 }}>
                                    →
                                  </span>
                                  {out}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
