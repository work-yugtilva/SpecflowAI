"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { runPipeline } from "@/lib/api/pipeline";

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

// ─── Pipeline Adapter ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findArrayIn(obj: any, keywords: string[]): any[] | null {
  if (!obj || typeof obj !== "object") return null;
  for (const key of Object.keys(obj)) {
    if (
      keywords.some((k) => key.toLowerCase().includes(k)) &&
      Array.isArray(obj[key])
    ) {
      return obj[key];
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUIComponent(item: any, idx: number): UIComponent {
  const validTypes: UIComponent["type"][] = [
    "Screen",
    "Modal",
    "Component",
    "Form",
    "Navigation",
  ];
  return {
    id: item.id ?? `ui${idx}`,
    name: item.name ?? item.title ?? item.component ?? `Component ${idx + 1}`,
    type: validTypes.includes(item.type) ? item.type : "Component",
    description: item.description ?? item.summary ?? "",
    elements: Array.isArray(item.elements)
      ? item.elements
      : Array.isArray(item.behaviors)
      ? item.behaviors
      : [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDataEntity(item: any, idx: number): DataEntity {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFields = item.fields ?? item.attributes ?? item.properties ?? [];
  return {
    id: item.id ?? `d${idx}`,
    name: item.name ?? item.entity ?? item.model ?? `Entity ${idx + 1}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: Array.isArray(rawFields)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawFields.map((f: any) => ({
          name: typeof f === "string" ? f : f.name ?? "field",
          type: typeof f === "string" ? "string" : f.type ?? "string",
          required: f.required ?? false,
        }))
      : [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toWorkflowStep(item: any, idx: number): WorkflowStep {
  const validActors: WorkflowStep["actor"][] = [
    "User",
    "System",
    "API",
    "Background",
  ];
  return {
    step: item.step ?? idx + 1,
    title: item.title ?? item.name ?? item.action ?? `Step ${idx + 1}`,
    description: item.description ?? item.action ?? "",
    actor: validActors.includes(item.actor) ? item.actor : "System",
    outputs: Array.isArray(item.outputs)
      ? item.outputs
      : typeof item.output === "string"
      ? [item.output]
      : [],
  };
}

function adaptPipelineResult(data: Record<string, unknown>): Decomposition {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features = (data.features as any[]) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const problems = (data.problems as any[]) ?? [];
  // Decompose step runs in parallel — result is array of arrays or objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawDecomps = (data.decompositions as any[]) ?? [];
  const allDecomps = rawDecomps.flat();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstDecomp: any = allDecomps[0] ?? {};

  const uiArr =
    findArrayIn(firstDecomp, ["ui", "component", "screen", "interface", "frontend", "view"]) ??
    findArrayIn(firstDecomp?.structure, ["element", "ui", "component"]) ??
    [];

  const dataArr =
    findArrayIn(firstDecomp, ["data", "model", "entity", "schema", "table", "database"]) ??
    findArrayIn(firstDecomp?.structure, ["data", "model", "entity"]) ??
    [];

  const flowArr =
    findArrayIn(firstDecomp, ["workflow", "step", "flow", "process", "action", "behavior"]) ??
    findArrayIn(firstDecomp?.structure, ["behavior", "step", "flow"]) ??
    [];

  return {
    featureTitle:
      features[0]?.title ?? features[0]?.name ?? firstDecomp?.title ?? "Generated Feature",
    linkedProblem: problems[0]?.title ?? problems[0]?.summary ?? "",
    uiComponents: uiArr.slice(0, 8).map(toUIComponent),
    dataEntities: dataArr.slice(0, 6).map(toDataEntity),
    workflowSteps: flowArr.slice(0, 8).map(toWorkflowStep),
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
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const ctx = JSON.parse(localStorage.getItem("specflow_context") ?? "{}");
      console.log("[decompose] Starting pipeline run", { context: ctx });
      const { data } = await runPipeline({ context: ctx, research: [], ingest: [] });
      console.log("[decompose] Pipeline response", data);
      setDecomposition(adaptPipelineResult(data));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      console.error("[decompose] Pipeline error", msg);
      setError(msg);
    } finally {
      setGenerating(false);
    }
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
            {dm && (
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
                ↳ {dm.featureTitle}
              </span>
            )}
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
                background: error ? "rgba(239,68,68,0.08)" : "rgba(232,86,27,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {error ? (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="10" stroke="#EF4444" strokeWidth="1.5" />
                  <path d="M14 9v6" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="14" cy="18.5" r="1" fill="#EF4444" />
                </svg>
              ) : (
                /* Layers / architecture icon */
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect x="4" y="5" width="20" height="5" rx="1.5" stroke="#E8561B" strokeWidth="1.5" />
                  <rect x="4" y="12" width="20" height="5" rx="1.5" stroke="#E8561B" strokeWidth="1.5" />
                  <rect x="4" y="19" width="20" height="5" rx="1.5" stroke="#E8561B" strokeWidth="1.5" />
                </svg>
              )}
            </div>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: error ? "#EF4444" : "#0D0D0D",
                  margin: 0,
                }}
              >
                {error ? "Pipeline error" : "No decomposition generated yet."}
              </p>
              <p
                style={{
                  fontSize: 12.5,
                  color: "#9E9E9E",
                  margin: "4px 0 0",
                  lineHeight: 1.5,
                  maxWidth: 320,
                }}
              >
                {error ?? "Break down a feature into UI, data, and workflow layers."}
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="btn-dark"
              style={{ fontSize: "0.8125rem", padding: "0.45rem 1rem", marginTop: 4 }}
            >
              {error ? "Retry" : "Generate Decomposition"}
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
