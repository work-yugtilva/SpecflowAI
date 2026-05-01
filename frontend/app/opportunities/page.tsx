"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { QualityBadge } from "@/components/pipeline/QualityBadge";
import { getSession } from "@/lib/api/session";
import { useActiveSession } from "@/lib/active-session-context";
import { adaptProblems, adaptFeatures } from "@/lib/pipeline-contracts";
import { deriveOpportunities } from "@/lib/opportunities";
import type { Opportunity } from "@/lib/opportunities";

// ─── Badge helpers ────────────────────────────────────────────────────────────

const IMPACT_STYLES: Record<string, { bg: string; color: string }> = {
  High: { bg: "#FEF2F2", color: "#EF4444" },
  Medium: { bg: "#FFF7ED", color: "#F59E0B" },
  Low: { bg: "#F0FDF4", color: "#22C55E" },
};

const EFFORT_STYLES: Record<string, { bg: string; color: string }> = {
  Low: { bg: "#F0FDF4", color: "#22C55E" },
  Medium: { bg: "#FFF7ED", color: "#F59E0B" },
  High: { bg: "#FEF2F2", color: "#EF4444" },
};

const RISK_STYLES: Record<string, { bg: string; color: string }> = {
  Low: { bg: "#F0FDF4", color: "#22C55E" },
  Medium: { bg: "#FFF7ED", color: "#F59E0B" },
  High: { bg: "#FEF2F2", color: "#EF4444" },
};

function InlineBadge({
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

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? "#22C55E" : pct >= 45 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 4,
          background: "#F0EDE9",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }}
        />
      </div>
      <span style={{ fontSize: 11, color: "#6B6B6B", width: 32, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  icon: string;
  title: string;
  description?: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  const router = useRouter();
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 40,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "rgba(232,86,27,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: "#0D0D0D", textAlign: "center" }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 13, color: "#6B6B6B", textAlign: "center", maxWidth: 320 }}>
          {description}
        </div>
      )}
      <button
        className="btn-dark"
        onClick={() => router.push(ctaHref)}
        style={{
          marginTop: 4,
          padding: "7px 18px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          background: "#0D0D0D",
          color: "#fff",
          border: "none",
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

// ─── Opportunity Card (left panel) ────────────────────────────────────────────

function OpportunityCard({
  opp,
  rank,
  isActive,
  onClick,
}: {
  opp: Opportunity;
  rank: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid #F0EDE9",
        cursor: "pointer",
        background: isActive ? "rgba(232,86,27,0.04)" : "#FFFFFF",
        borderLeft: isActive ? "3px solid #E8561B" : "3px solid transparent",
        transition: "background 120ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <span
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 6,
            background: isActive ? "rgba(232,86,27,0.12)" : "#F0EDE9",
            color: isActive ? "#E8561B" : "#6B6B6B",
            fontSize: 11,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {rank}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#0D0D0D",
              lineHeight: 1.35,
              marginBottom: 6,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
            }}
          >
            {opp.title}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            <InlineBadge label={opp.expectedImpact} styles={IMPACT_STYLES[opp.expectedImpact]} prefix="Impact" />
            <InlineBadge label={opp.effort} styles={EFFORT_STYLES[opp.effort]} prefix="Effort" />
            <InlineBadge label={opp.riskLevel} styles={RISK_STYLES[opp.riskLevel]} prefix="Risk" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#9E9E9E" }}>Score</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: opp.score >= 70 ? "#15803D" : opp.score >= 50 ? "#D97706" : "#DC2626",
              }}
            >
              {opp.score}
            </span>
            <span style={{ fontSize: 11, color: "#9E9E9E" }}>/100</span>
          </div>
        </div>
      </div>
      <ConfidenceBar value={opp.confidence} />
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ opp }: { opp: Opportunity }) {
  const router = useRouter();

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        background: "#F8F4EF",
      }}
    >
      {/* Detail header */}
      <div
        style={{
          padding: "20px 28px 16px",
          background: "#FFFFFF",
          borderBottom: "1px solid #E4DDD4",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-instrument)",
            fontSize: 22,
            fontWeight: 400,
            color: "#0D0D0D",
            margin: 0,
            marginBottom: 12,
            lineHeight: 1.3,
          }}
        >
          {opp.title}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: opp.score >= 70 ? "#15803D" : opp.score >= 50 ? "#D97706" : "#DC2626",
              lineHeight: 1,
            }}
          >
            {opp.score}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#0D0D0D" }}>/100</div>
            <div style={{ fontSize: 11, color: "#9E9E9E" }}>Recommendation score based on session evidence</div>
          </div>
          <div style={{ marginLeft: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <InlineBadge label={opp.expectedImpact} styles={IMPACT_STYLES[opp.expectedImpact]} prefix="Impact" />
            <InlineBadge label={opp.effort} styles={EFFORT_STYLES[opp.effort]} prefix="Effort" />
            <InlineBadge label={opp.riskLevel} styles={RISK_STYLES[opp.riskLevel]} prefix="Risk" />
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ padding: "20px 28px", flex: 1 }}>
        {/* Confidence */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Confidence</SectionLabel>
          <ConfidenceBar value={opp.confidence} />
        </div>

        {/* Metrics grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginBottom: 22,
          }}
        >
          {(
            [
              ["Impact", opp.expectedImpact, IMPACT_STYLES[opp.expectedImpact]],
              ["Effort", opp.effort, EFFORT_STYLES[opp.effort]],
              ["Risk", opp.riskLevel, RISK_STYLES[opp.riskLevel]],
            ] as const
          ).map(([label, value, styles]) => (
            <div
              key={label}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "#FFFFFF",
                border: "1px solid #E4DDD4",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9E9E9E", marginBottom: 4 }}>
                {label}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: styles.color }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Customer Problem */}
        {opp.customerProblem && (
          <div style={{ paddingTop: 18, borderTop: "1px solid #E4DDD4", marginBottom: 20 }}>
            <SectionLabel>Customer Problem</SectionLabel>
            <p style={{ fontSize: 13.5, color: "#0D0D0D", lineHeight: 1.65, margin: 0 }}>
              {opp.customerProblem}
            </p>
          </div>
        )}

        {/* Recommended Solution */}
        {opp.recommendedSolution && (
          <div style={{ paddingTop: 18, borderTop: "1px solid #E4DDD4", marginBottom: 20 }}>
            <SectionLabel>Recommended Solution</SectionLabel>
            <p style={{ fontSize: 13.5, color: "#0D0D0D", lineHeight: 1.65, margin: 0 }}>
              {opp.recommendedSolution}
            </p>
          </div>
        )}

        {/* Linked Problems */}
        {opp.linkedProblems.length > 0 && (
          <div style={{ paddingTop: 18, borderTop: "1px solid #E4DDD4", marginBottom: 20 }}>
            <SectionLabel>Linked Problems</SectionLabel>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {opp.linkedProblems.map((p, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 13.5,
                    color: "#0D0D0D",
                    paddingLeft: 12,
                    borderLeft: "2px solid #E8561B",
                  }}
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Supporting Evidence */}
        {opp.supportingEvidence.length > 0 && (
          <div style={{ paddingTop: 18, borderTop: "1px solid #E4DDD4", marginBottom: 20 }}>
            <SectionLabel>Supporting Evidence</SectionLabel>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {opp.supportingEvidence.map((e, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 13,
                    color: "#5f5750",
                    paddingLeft: 12,
                    borderLeft: "2px solid #E4DDD4",
                    lineHeight: 1.5,
                  }}
                >
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Source IDs */}
        {opp.sourceIds.length > 0 && (
          <div style={{ paddingTop: 18, borderTop: "1px solid #E4DDD4", marginBottom: 20 }}>
            <SectionLabel>Sources</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {opp.sourceIds.map((id, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "rgba(61,107,94,0.08)",
                    color: "#3D6B5E",
                    fontFamily: "Courier New, monospace",
                  }}
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Open Questions */}
        {opp.openQuestions.length > 0 && (
          <div style={{ paddingTop: 18, borderTop: "1px solid #E4DDD4", marginBottom: 20 }}>
            <SectionLabel>Open Questions</SectionLabel>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {opp.openQuestions.map((q, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 13.5,
                    color: "#5f5750",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "#F59E0B", flexShrink: 0 }}>?</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Spacer for sticky CTA */}
        <div style={{ height: 80 }} />
      </div>

      {/* Sticky CTA bar */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "#FFFFFF",
          borderTop: "1px solid #E4DDD4",
          padding: "12px 28px",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => router.push("/prd")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            background: "#0D0D0D",
            color: "#fff",
            border: "none",
          }}
        >
          Generate PRD
        </button>
        <button
          onClick={() => router.push("/features")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            background: "transparent",
            color: "#0D0D0D",
            border: "1px solid #E4DDD4",
          }}
        >
          View Features
        </button>
        <button
          onClick={() => router.push("/problems")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            background: "transparent",
            color: "#0D0D0D",
            border: "1px solid #E4DDD4",
          }}
        >
          View Problems
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OpportunitiesPage() {
  const router = useRouter();
  const { activeSessionId } = useActiveSession();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProblems, setHasProblems] = useState(false);
  const [hasFeatures, setHasFeatures] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [qualityScore, setQualityScore] = useState<{
    score: number;
    passed: boolean;
  } | null>(null);

  const selectedOpp =
    opportunities.find((o) => o.id === selectedId) ?? null;

  useEffect(() => {
    setOpportunities([]);
    setSelectedId(null);
    setError(null);
    setHasProblems(false);
    setHasFeatures(false);
    setSessionLoaded(false);
    setQualityScore(null);

    if (!activeSessionId) return;

    let cancelled = false;
    setLoading(true);

    getSession(activeSessionId)
      .then((d) => {
        if (cancelled) return;
        setSessionLoaded(true);

        const out = d.state?.state?.outputs as
          | Record<string, unknown>
          | undefined;

        const problems = out?.problems != null ? adaptProblems(out) : [];
        const features = out?.features != null ? adaptFeatures(out) : [];

        setHasProblems(problems.length > 0);
        setHasFeatures(features.length > 0);

        const fq = out?.features_quality as
          | { score: number; passed: boolean }
          | undefined;
        if (fq) setQualityScore(fq);

        const opps = deriveOpportunities({ problems, features });
        setOpportunities(opps);
        if (opps.length > 0) setSelectedId(opps[0].id);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load session data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const shortId = activeSessionId?.slice(0, 8) ?? null;

  const renderContent = () => {
    if (!activeSessionId) {
      return (
        <EmptyState
          icon="◎"
          title="No session selected"
          description="Select a session to view opportunities."
          ctaLabel="Go to Sessions"
          ctaHref="/sessions"
        />
      );
    }

    if (loading) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9E9E9E",
            fontSize: 13,
            gap: 10,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              border: "2px solid #E4DDD4",
              borderTopColor: "#E8561B",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          Loading…
        </div>
      );
    }

    if (error) {
      return (
        <EmptyState
          icon="⚠"
          title="Could not load session"
          description={error}
          ctaLabel="Go to Sessions"
          ctaHref="/sessions"
        />
      );
    }

    if (sessionLoaded && !hasProblems) {
      return (
        <EmptyState
          icon="◈"
          title="Generate problems first"
          description="Opportunities are derived from your problems and features. Run the problems step first."
          ctaLabel="Go to Problems"
          ctaHref="/problems"
        />
      );
    }

    if (sessionLoaded && hasProblems && !hasFeatures) {
      return (
        <EmptyState
          icon="◈"
          title="Generate features first"
          description="Opportunities require feature output. Run the features step first."
          ctaLabel="Go to Features"
          ctaHref="/features"
        />
      );
    }

    if (sessionLoaded && hasFeatures && opportunities.length === 0) {
      return (
        <EmptyState
          icon="○"
          title="No opportunities derived"
          description="The current features could not be scored into opportunities. Try regenerating features."
          ctaLabel="Go to Features"
          ctaHref="/features"
        />
      );
    }

    if (opportunities.length === 0) return null;

    return (
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left list */}
        <div
          style={{
            width: 320,
            background: "#FFFFFF",
            borderRight: "1px solid #E4DDD4",
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          {opportunities.map((opp, i) => (
            <OpportunityCard
              key={opp.id}
              opp={opp}
              rank={i + 1}
              isActive={opp.id === selectedId}
              onClick={() => setSelectedId(opp.id)}
            />
          ))}
        </div>

        {/* Right detail */}
        {selectedOpp ? (
          <DetailPanel opp={selectedOpp} />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9E9E9E",
              fontSize: 13,
            }}
          >
            Select an opportunity to view details
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#F8F4EF", fontFamily: "var(--font-dm-sans)" }}
    >
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#9E9E9E" }}>Signals</span>
            <span style={{ fontSize: 13, color: "#9E9E9E" }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#0D0D0D" }}>
              Opportunities
            </span>
            {shortId && (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: "rgba(232,86,27,0.08)",
                  color: "#E8561B",
                  fontFamily: "Courier New, monospace",
                  fontWeight: 600,
                }}
              >
                {shortId}
              </span>
            )}
            {opportunities.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: "#F0EDE9",
                  color: "#5f5750",
                  fontWeight: 500,
                }}
              >
                {opportunities.length}{" "}
                {opportunities.length === 1 ? "opportunity" : "opportunities"}
              </span>
            )}
            {qualityScore && (
              <QualityBadge
                score={qualityScore.score}
                passed={qualityScore.passed}
              />
            )}
          </div>

          <button
            onClick={() => router.push("/features")}
            style={{
              padding: "6px 14px",
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 500,
              cursor: "pointer",
              background: "transparent",
              color: "#5f5750",
              border: "1px solid #E4DDD4",
            }}
          >
            ← Back to Features
          </button>
        </header>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {renderContent()}
        </div>
      </div>

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
