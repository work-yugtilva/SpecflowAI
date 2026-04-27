import type { FeatureViewModel, ProblemViewModel } from "@/lib/pipeline-contracts";

export interface Opportunity {
  id: string;
  title: string;
  customerProblem: string;
  recommendedSolution: string;
  linkedProblems: string[];
  supportingEvidence: string[];
  sourceIds: string[];
  targetPersona: string;
  expectedImpact: "High" | "Medium" | "Low";
  confidence: number;
  effort: "Low" | "Medium" | "High";
  riskLevel: "Low" | "Medium" | "High";
  openQuestions: string[];
  score: number;
  nextAction: "Generate PRD";
}

const IMPACT_SCORE: Record<string, number> = { High: 40, Medium: 25, Low: 10 };
const EFFORT_BONUS: Record<string, number> = { Low: 20, Medium: 10, High: 0 };
const RISK_PENALTY: Record<string, number> = { High: -10, Medium: -5, Low: 0 };

function deriveRiskLevel(
  effort: string,
  confidence: number
): "Low" | "Medium" | "High" {
  const highEffort = effort === "High";
  const lowConf = confidence < 50;
  if (highEffort && lowConf) return "High";
  if (highEffort || lowConf) return "Medium";
  return "Low";
}

function scoreOpportunity(
  feature: FeatureViewModel,
  linkedProblem?: ProblemViewModel
): number {
  let raw = 0;

  raw += IMPACT_SCORE[feature.impact] ?? 10;
  raw += Math.round((feature.confidence / 100) * 30);
  raw += EFFORT_BONUS[feature.effort] ?? 10;

  if ((feature.source_ids?.length ?? 0) > 0) raw += 10;
  if (feature.citation_confidence === "high") raw += 5;
  else if (feature.citation_confidence === "medium") raw += 2;

  // Boost if linked problem has source evidence
  if (linkedProblem && (linkedProblem.source_ids?.length ?? 0) > 0) raw += 5;

  const risk = deriveRiskLevel(feature.effort, feature.confidence);
  raw += RISK_PENALTY[risk];

  return Math.max(0, Math.min(100, raw));
}

function deriveOpenQuestions(feature: FeatureViewModel): string[] {
  const qs: string[] = [];
  if ((feature.source_ids?.length ?? 0) === 0)
    qs.push("Which customer sources validate this?");
  if (feature.confidence < 50)
    qs.push("What confidence score should this receive?");
  if (!feature.effort)
    qs.push("What is the implementation effort?");
  if (!feature.linkedProblemId)
    qs.push("Which problem does this solve?");
  return qs;
}

export function deriveOpportunities({
  problems,
  features,
}: {
  problems: ProblemViewModel[];
  features: FeatureViewModel[];
}): Opportunity[] {
  if (features.length === 0) return [];

  const problemMap = new Map<string, ProblemViewModel>(
    problems.map((p) => [p.id, p])
  );

  return features
    .map((feature, index): Opportunity => {
      const linkedProblem = problemMap.get(feature.linkedProblemId);
      const score = scoreOpportunity(feature, linkedProblem);

      const sourceIds = Array.from(
        new Set([
          ...(feature.source_ids ?? []),
          ...(linkedProblem?.source_ids ?? []),
        ])
      );

      return {
        id: `opp-${feature.id || index}`,
        title: feature.title,
        customerProblem:
          feature.reasoning ||
          linkedProblem?.summary ||
          "",
        recommendedSolution: feature.description,
        linkedProblems: linkedProblem ? [linkedProblem.title] : [],
        supportingEvidence: [
          ...(linkedProblem?.evidence ?? []),
          ...(feature.successMetrics ?? []),
        ],
        sourceIds,
        targetPersona: "",
        expectedImpact: feature.impact,
        confidence: feature.confidence,
        effort: feature.effort,
        riskLevel: deriveRiskLevel(feature.effort, feature.confidence),
        openQuestions: deriveOpenQuestions(feature),
        score,
        nextAction: "Generate PRD",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
