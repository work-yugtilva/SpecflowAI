"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { PipelineStepper } from "@/components/pipeline/PipelineStepper";
import { getSession } from "@/lib/api/session";
import type { SessionDetail } from "@/lib/api/session";
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
import type { PipelineInput } from "@/lib/pipeline-types";
import dynamic from "next/dynamic";
const TextShimmer = dynamic(
  () => import("@/components/ui/text-shimmer").then((m) => m.TextShimmer)
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feature {
  id: string;
  title: string;
  description: string;
  linkedProblemId: string;
  linkedProblemTitle: string;
  impact: "High" | "Medium" | "Low";
  effort: "Low" | "Medium" | "High";
  confidence: number;
  score: number;
  reasoning: string;
  successMetrics: string[];
}

// ─── Pipeline Adapter ─────────────────────────────────────────────────────────

function numericToImpact(n: number): Feature["impact"] {
  if (n >= 70) return "High";
  if (n >= 40) return "Medium";
  return "Low";
}

function numericToEffort(n: number): Feature["effort"] {
  if (n >= 70) return "High";
  if (n >= 40) return "Medium";
  return "Low";
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isLikelySingleFeatureRecord(o: Record<string, unknown>): boolean {
  if ("error" in o) return false;
  const title = o.title ?? o.name;
  if (typeof title !== "string" || !title.trim()) return false;
  return [
    "description",
    "summary",
    "linked_problems",
    "linked_items",
    "priority_tier",
    "success_metrics",
    "attributes",
    "reasoning",
    "metadata",
  ].some((k) => k in o);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectListsOfObjects(node: unknown, depth: number, acc: any[][]): void {
  if (depth > 14) return;
  if (Array.isArray(node)) {
    if (
      node.length > 0 &&
      node.every((x) => isPlainObject(x)) &&
      !node.some((x) => "error" in x)
    ) {
      acc.push(node);
    }
    for (const x of node) {
      if (isPlainObject(x) || Array.isArray(x)) {
        collectListsOfObjects(x, depth + 1, acc);
      }
    }
    return;
  }
  if (isPlainObject(node)) {
    if ("error" in node) return;
    for (const v of Object.values(node)) {
      collectListsOfObjects(v, depth + 1, acc);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function discoverLongestObjectList(root: unknown): any[] {
  const buckets: any[][] = [];
  collectListsOfObjects(root, 0, buckets);
  if (buckets.length === 0) return [];
  return buckets.reduce((best, arr) => (arr.length > best.length ? arr : best));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstFeatureArray(...candidates: any[]): any[] | null {
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrapFeatureRows(raw: any, data: Record<string, unknown>): any[] {
  if (typeof raw === "string") {
    try {
      return unwrapFeatureRows(JSON.parse(raw), data);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    if (raw.length > 0 && raw.every((x: unknown) => typeof x === "string")) {
      return raw.map((s: string) => ({
        title: (s || "").slice(0, 240),
        description: s || "",
        linked_problems: [],
      }));
    }
    return raw;
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (isLikelySingleFeatureRecord(o)) return [o];
    const nested = firstFeatureArray(
      o.features,
      o.items,
      o.capabilities,
      o.results,
      o.product_features,
      o.data as unknown[],
      o.value
    );
    if (nested) return unwrapFeatureRows(nested, data);
    if (typeof o.data === "object" && o.data !== null && !Array.isArray(o.data)) {
      const d = o.data as Record<string, unknown>;
      const inner = firstFeatureArray(d.items, d.features);
      if (inner) return unwrapFeatureRows(inner, data);
    }
    const discovered = discoverLongestObjectList(raw);
    if (discovered.length > 0) return discovered;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dAny = data as any;
  const top = firstFeatureArray(dAny.features, dAny.items);
  return top ? unwrapFeatureRows(top, data) : [];
}

function coalesceFeaturesRaw(
  data: Record<string, unknown>,
  sessionState: Record<string, unknown> | null | undefined
): unknown {
  const fromData = data.features;
  const fromNested = (data as { outputs?: { features?: unknown } }).outputs
    ?.features;
  const fromSession =
    sessionState &&
    typeof sessionState === "object" &&
    (sessionState as { outputs?: { features?: unknown } }).outputs?.features;
  if (fromData !== undefined && fromData !== null) return fromData;
  if (fromNested !== undefined && fromNested !== null) return fromNested;
  if (fromSession !== undefined && fromSession !== null) return fromSession;
  return undefined;
}

function emptyFeaturesMessage(
  data: Record<string, unknown>,
  rawCoalesced: unknown
): string {
  const p = rawCoalesced !== undefined ? rawCoalesced : data.features;
  if (p && isPlainObject(p) && "error" in p) {
    const o = p as { error?: unknown; raw?: unknown };
    const tail = o.raw != null ? ` ${String(o.raw).slice(0, 280)}` : "";
    return `The model did not return valid JSON (${String(o.error)}).${tail}`;
  }
  if (Array.isArray(p) && p.length === 0) {
    return "The model returned an empty feature list. Run Problems for this session first, then try Features again.";
  }
  if (p === undefined || p === null) {
    return "No features output was found in the API response. Confirm NEXT_PUBLIC_PIPELINE_URL matches the workflow API.";
  }
  const keys = isPlainObject(p) ? Object.keys(p).slice(0, 12).join(", ") : "";
  return keys
    ? `Could not extract a list of features from the model output (saw keys: ${keys}).`
    : "Could not map features from the pipeline response.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptFeatures(
  data: Record<string, unknown>,
  sessionState?: Record<string, unknown> | null
): Feature[] {
  const rawFeatures = coalesceFeaturesRaw(data, sessionState);
  const merged =
    rawFeatures !== undefined
      ? { ...data, features: rawFeatures }
      : data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = unwrapFeatureRows(merged.features, merged);
  if (!Array.isArray(rows) || rows.length === 0) {
    const d = discoverLongestObjectList(merged.features);
    if (d.length > 0) rows = d;
  }
  if (!Array.isArray(rows)) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const problems: any[] = Array.isArray(merged.problems) ? merged.problems : [];

  return rows.map((item: any, idx: number) => {
    if (typeof item === "string") {
      const lp = problems[0] ?? {};
      return {
        id: `f${idx}`,
        title: item.slice(0, 120) || `Feature ${idx + 1}`,
        description: item,
        linkedProblemId: String(lp.id ?? "p0"),
        linkedProblemTitle: String(lp.title ?? lp.summary ?? ""),
        impact: "Medium" as const,
        effort: "Medium" as const,
        confidence: 70,
        score: 70,
        reasoning: item,
        successMetrics: [] as string[],
      };
    }

    const attrs = item.attributes ?? item;
    const reasoning = item.reasoning ?? {};
    const linkedItems: string[] = Array.isArray(item.linked_items)
      ? item.linked_items.map(String)
      : [];
    const linkedTitles: string[] = Array.isArray(item.linked_problems)
      ? item.linked_problems.map((x: unknown) => String(x))
      : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let linkedProblem: any = {};
    if (linkedTitles.length > 0) {
      const match = problems.find((pr: any) =>
        linkedTitles.includes(String(pr?.title ?? ""))
      );
      if (match) linkedProblem = match;
    }
    if (!linkedProblem?.title && problems[idx]) linkedProblem = problems[idx];
    if (!linkedProblem?.title && problems[0]) linkedProblem = problems[0];

    const impactRaw = attrs.impact ?? item.impact ?? item.priority ?? 50;
    const effortRaw = attrs.effort ?? item.effort ?? 50;
    const normalizeLevel = (s: string): string =>
      s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const impact: Feature["impact"] =
      typeof impactRaw === "string"
        ? (normalizeLevel(impactRaw) as Feature["impact"])
        : numericToImpact(Number(impactRaw));
    const effort: Feature["effort"] =
      typeof effortRaw === "string"
        ? (normalizeLevel(effortRaw) as Feature["effort"])
        : numericToEffort(Number(effortRaw));

    return {
      id: item.id ?? `f${idx}`,
      title: item.title ?? item.name ?? `Feature ${idx + 1}`,
      description: item.description ?? item.summary ?? "",
      linkedProblemId:
        linkedProblem?.id != null
          ? String(linkedProblem.id)
          : String(linkedItems[0] ?? `p${idx}`),
      linkedProblemTitle: String(
        linkedProblem.title ??
          linkedProblem.summary ??
          linkedItems[0] ??
          linkedTitles[0] ??
          ""
      ),
      impact,
      effort,
      confidence: Number(attrs.confidence ?? item.confidence ?? 70),
      score: Number(attrs.score ?? item.score ?? 70),
      reasoning:
        typeof reasoning === "string"
          ? reasoning
          : reasoning.why_it_matters ??
            reasoning.summary ??
            item.user_problem_it_solves ??
            item.reasoning ??
            "",
      successMetrics: Array.isArray(item.success_metrics)
        ? item.success_metrics.map(String)
        : Array.isArray(reasoning.tradeoffs)
          ? reasoning.tradeoffs.map(String)
          : [],
    };
  });
}

// ─── Badge configs ────────────────────────────────────────────────────────────

const IMPACT_STYLES: Record<Feature["impact"], { bg: string; color: string }> =
  {
    High: { bg: "#FEF2F2", color: "#EF4444" },
    Medium: { bg: "#FFF7ED", color: "#F59E0B" },
    Low: { bg: "#F0FDF4", color: "#22C55E" },
  };

const EFFORT_STYLES: Record<Feature["effort"], { bg: string; color: string }> =
  {
    Low: { bg: "#F0FDF4", color: "#22C55E" },
    Medium: { bg: "#FFF7ED", color: "#F59E0B" },
    High: { bg: "#FEF2F2", color: "#EF4444" },
  };

function Badge({
  label,
  styles,
  prefix,
}: {
  label: string;
  styles: { bg: string; color: string };
  prefix?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: styles.bg,
        color: styles.color,
        flexShrink: 0,
      }}
    >
      {prefix && (
        <span style={{ marginRight: 3, opacity: 0.7, fontWeight: 400 }}>
          {prefix}
        </span>
      )}
      {label}
    </span>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#6B6B6B",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

// ─── Features Page ────────────────────────────────────────────────────────────

export default function FeaturesPage() {
  const router = useRouter();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromSession, setFromSession] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const {
    showOrphanedModal,
    orphanedOutput,
    triggerOrphanedPrompt,
    closeOrphanedModal,
  } = useOrphanedPipeline();

  const { activeSessionId } = useActiveSession();
  const selectedFeature = features.find((f) => f.id === selectedId) ?? null;
  const stepStatuses = computeStepStatuses(sessionDetail);

  useEffect(() => {
    setFeatures([]);
    setSelectedId(null);
    setError(null);
    setFromSession(false);
    setSessionDetail(null);
    if (!activeSessionId) return;
    let cancelled = false;
    getSession(activeSessionId)
      .then((d) => {
        if (cancelled) return;
        setSessionDetail(d);
        const out = d.state?.state?.outputs as
          | Record<string, unknown>
          | undefined;
        if (out && out.features != null) {
          setFromSession(true);
          const adapted = adaptFeatures({
            ...out,
            features: out.features,
          } as Record<string, unknown>);
          if (adapted.length > 0) {
            setFeatures(adapted);
            setSelectedId(adapted[0].id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setSessionDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  async function handleGenerate() {
    setGenerating(true);
    setSelectedId(null);
    setError(null);
    setFromSession(false);
    setFeatures([]);
    const isAutorun = isAutorunPending(activeSessionId ?? undefined);
    try {
      const inputData: PipelineInput = buildPipelineInputFromStorage(
        activeSessionId ?? undefined
      );
      const result = await runPipelineStepOrFull(
        "features",
        inputData,
        activeSessionId
      );
      const { data, mode, sessionState } = result;
      setFromSession(mode === "session");
      if (mode === "orphaned" && result.orphanedOutput) {
        triggerOrphanedPrompt(result.orphanedOutput);
      }
      const rawCoalesced = coalesceFeaturesRaw(data, sessionState);
      const adapted = adaptFeatures(data, sessionState);
      if (adapted.length > 0) {
        setFeatures(adapted);
        setSelectedId(adapted[0].id);
      } else {
        setError(emptyFeaturesMessage(data, rawCoalesced));
      }
      if (activeSessionId) {
        try {
          setSessionDetail(await getSession(activeSessionId));
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      if (isAutorun) clearAutorunFlag(activeSessionId ?? undefined);
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (!activeSessionId || !isAutorunPending(activeSessionId)) return;
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      <Sidebar />

      {/* Main area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PipelineStepper
          currentStepId="features"
          stepStatuses={stepStatuses}
          sessionIdShort={activeSessionId ? activeSessionId.slice(0, 8).toUpperCase() : null}
          generating={generating}
          generatingStep="features"
        />
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 flex-shrink-0"
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 text-[13px]"
              style={{ color: "#6B6B6B" }}
            >
              <span>Signals</span>
              <span style={{ color: "#C0B8B0" }}>/</span>
              <span className="font-medium" style={{ color: "#0D0D0D" }}>
                Features
              </span>
            </div>
            {fromSession && (
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "rgba(232,86,27,0.10)", color: "#E8561B", letterSpacing: "0.03em" }}>
                From Session
              </span>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !activeSessionId}
            className="btn-dark"
            style={{
              fontSize: 13,
              padding: "0.45rem 1rem",
              opacity: generating || !activeSessionId ? 0.6 : 1,
              cursor: generating || !activeSessionId ? "not-allowed" : "pointer",
            }}
          >
            {generating ? (
              <TextShimmer duration={1.2}>Running…</TextShimmer>
            ) : !activeSessionId ? (
              "Select a session in Sessions"
            ) : (
              "Run Features (this step)"
            )}
          </button>
        </header>

        {/* Content */}
        {features.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex-1 flex flex-col items-center justify-center" style={{ padding: "2rem" }}>
            {generating ? (
              <div className="flex flex-col items-center gap-3">
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: "2.5px solid #E4DDD4",
                    borderTopColor: "#E8561B",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                <p style={{ fontSize: 13.5, color: "#6B6B6B" }}>
                  <TextShimmer duration={1.2}>Analysing problems…</TextShimmer>
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-4 text-center"
                style={{ maxWidth: 360 }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "rgba(232,86,27,0.08)",
                    border: "1px solid rgba(232,86,27,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#E8561B"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                  </svg>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "1rem",
                      fontWeight: 500,
                      color: error ? "#EF4444" : "#0D0D0D",
                      marginBottom: 6,
                    }}
                  >
                    {error ? "Pipeline error" : "No features generated yet."}
                  </p>
                  {error ? (
                    <p style={{ fontSize: 13.5, color: "#6B6B6B", lineHeight: 1.6 }}>
                      {error}
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!error && !activeSessionId}
                  className="btn-dark"
                  style={{
                    fontSize: 14,
                    padding: "0.65rem 1.5rem",
                    opacity: !error && !activeSessionId ? 0.6 : 1,
                    cursor: !error && !activeSessionId ? "not-allowed" : "pointer",
                  }}
                >
                  {error
                    ? "Retry"
                    : !activeSessionId
                      ? "Select a session in Sessions"
                      : "Run Features (this step)"}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Two-column layout ── */
          <div className="flex-1 flex min-h-0">
            {/* Left: Features list */}
            <div
              className="flex-shrink-0 flex flex-col overflow-y-auto"
              style={{
                width: 320,
                borderRight: "1px solid #E4DDD4",
                background: "#FFFFFF",
              }}
            >
              {/* List header */}
              <div
                style={{
                  padding: "14px 16px 10px",
                  borderBottom: "1px solid #F0EDE9",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#6B6B6B",
                  }}
                >
                  Features ({features.length})
                </span>
              </div>

              {/* Feature cards */}
              <div className="flex flex-col">
                {features.map((f) => {
                  const active = selectedId === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        borderBottom: "1px solid #F0EDE9",
                        borderLeft: active
                          ? "3px solid #E8561B"
                          : "3px solid transparent",
                        background: active
                          ? "rgba(232,86,27,0.04)"
                          : "transparent",
                        cursor: "pointer",
                        transition: "background 120ms ease, border-color 120ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.02)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {/* Row 1: badges + score */}
                      <div
                        className="flex items-center gap-1.5 flex-wrap"
                        style={{ marginBottom: 7 }}
                      >
                        <Badge
                          label={f.impact}
                          styles={IMPACT_STYLES[f.impact]}
                          prefix="Impact"
                        />
                        <Badge
                          label={f.effort}
                          styles={EFFORT_STYLES[f.effort]}
                          prefix="Effort"
                        />
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 11.5,
                            color: "#0D0D0D",
                            fontWeight: 600,
                          }}
                        >
                          <span style={{ color: "#9E9E9E", fontWeight: 400 }}>Score </span>
                          {f.score}
                        </span>
                      </div>

                      {/* Row 2: title */}
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: active ? 500 : 400,
                          color: "#0D0D0D",
                          lineHeight: 1.4,
                          marginBottom: 5,
                        }}
                      >
                        {f.title}
                      </div>

                      {/* Row 3: linked problem */}
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9E9E9E",
                          marginBottom: 8,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ↳{" "}
                        {f.linkedProblemTitle.length > 40
                          ? f.linkedProblemTitle.slice(0, 40) + "…"
                          : f.linkedProblemTitle}
                      </div>

                      {/* Row 4: confidence bar */}
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 11.5, color: "#6B6B6B" }}>
                          {f.confidence}% confidence
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 2,
                            background: "#F0EDE9",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${f.confidence}%`,
                              background: "#E8561B",
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Detail panel */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ background: "#F8F4EF" }}
            >
              {selectedFeature ? (
                <div style={{ padding: "24px 28px", maxWidth: 680 }}>
                  {/* Header */}
                  <div
                    className="flex items-start justify-between gap-4"
                    style={{ marginBottom: 12 }}
                  >
                    <h1
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 600,
                        color: "#0D0D0D",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.3,
                      }}
                    >
                      {selectedFeature.title}
                    </h1>
                    <button
                      style={{
                        flexShrink: 0,
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "#6B6B6B",
                        background: "transparent",
                        border: "1px solid #E4DDD4",
                        borderRadius: 8,
                        padding: "5px 12px",
                        cursor: "pointer",
                        transition: "border-color 150ms ease, color 150ms ease",
                        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#0D0D0D";
                        e.currentTarget.style.color = "#0D0D0D";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E4DDD4";
                        e.currentTarget.style.color = "#6B6B6B";
                      }}
                    >
                      Edit Feature
                    </button>
                  </div>

                  {/* Score + badges row */}
                  <div
                    className="flex items-center gap-3 flex-wrap"
                    style={{ marginBottom: 20 }}
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#9E9E9E",
                        }}
                      >
                        Score
                      </span>
                      <span
                        style={{
                          fontSize: "2rem",
                          fontWeight: 700,
                          color: "#0D0D0D",
                          letterSpacing: "-0.03em",
                          lineHeight: 1,
                        }}
                      >
                        {selectedFeature.score}
                      </span>
                    </div>
                    <div style={{ width: 1, height: 24, background: "#E4DDD4" }} />
                    <Badge
                      label={selectedFeature.impact}
                      styles={IMPACT_STYLES[selectedFeature.impact]}
                      prefix="Impact"
                    />
                    <Badge
                      label={selectedFeature.effort}
                      styles={EFFORT_STYLES[selectedFeature.effort]}
                      prefix="Effort"
                    />
                  </div>

                  {/* Description */}
                  <div
                    style={{
                      paddingTop: 18,
                      borderTop: "1px solid #E4DDD4",
                      marginBottom: 20,
                    }}
                  >
                    <SectionLabel>Description</SectionLabel>
                    <p
                      style={{
                        fontSize: 14,
                        color: "#3D3D3D",
                        lineHeight: 1.7,
                      }}
                    >
                      {selectedFeature.description}
                    </p>
                  </div>

                  {/* Linked Problem */}
                  <div
                    style={{
                      paddingTop: 18,
                      borderTop: "1px solid #E4DDD4",
                      marginBottom: 20,
                    }}
                  >
                    <SectionLabel>Linked Problem</SectionLabel>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 10px",
                        background: "#F3F4F6",
                        borderRadius: 8,
                        fontSize: 12.5,
                        color: "#3D3D3D",
                        fontWeight: 400,
                      }}
                    >
                      <span style={{ color: "#9E9E9E" }}>↳</span>
                      {selectedFeature.linkedProblemTitle}
                    </span>
                  </div>

                  {/* Reasoning */}
                  <div
                    style={{
                      paddingTop: 18,
                      borderTop: "1px solid #E4DDD4",
                      marginBottom: 20,
                    }}
                  >
                    <SectionLabel>Reasoning</SectionLabel>
                    <p
                      style={{
                        fontSize: 13.5,
                        color: "#3D3D3D",
                        lineHeight: 1.65,
                      }}
                    >
                      {selectedFeature.reasoning}
                    </p>
                  </div>

                  {/* Success Metrics */}
                  <div
                    style={{
                      paddingTop: 18,
                      borderTop: "1px solid #E4DDD4",
                      marginBottom: 28,
                    }}
                  >
                    <SectionLabel>Success Metrics</SectionLabel>
                    <div className="flex flex-col gap-2.5">
                      {selectedFeature.successMetrics.map((metric, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 13.5,
                            color: "#3D3D3D",
                            lineHeight: 1.6,
                            borderLeft: "2px solid #E4DDD4",
                            paddingLeft: 12,
                          }}
                        >
                          {metric}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => router.push("/decompose")}
                    className="btn-dark w-full"
                    style={{
                      fontSize: "0.9375rem",
                      padding: "0.75rem 1.5rem",
                      borderRadius: 10,
                    }}
                  >
                    Decompose Feature →
                  </button>
                </div>
              ) : (
                <div
                  className="flex-1 flex items-center justify-center h-full"
                  style={{ color: "#9E9E9E", fontSize: 13.5 }}
                >
                  Select a feature to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <OrphanedPipelineModal
        open={showOrphanedModal}
        onClose={closeOrphanedModal}
        pipelineOutput={orphanedOutput}
      />
    </div>
  );
}
