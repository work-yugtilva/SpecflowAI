import { describe, expect, it } from "vitest";
import type { FeatureViewModel, ProblemViewModel } from "@/lib/pipeline-contracts";
import { deriveOpportunities } from "./opportunities";

function makeFeature(overrides: Partial<FeatureViewModel> = {}): FeatureViewModel {
  return {
    id: "f0",
    title: "Default Feature",
    description: "A feature description",
    linkedProblemId: "p0",
    linkedProblemTitle: "Default Problem",
    impact: "Medium",
    effort: "Medium",
    confidence: 70,
    score: 70,
    reasoning: "This solves user pain",
    successMetrics: [],
    source_ids: ["src-1"],
    citation_confidence: "medium",
    ...overrides,
  };
}

function makeProblem(overrides: Partial<ProblemViewModel> = {}): ProblemViewModel {
  return {
    id: "p0",
    title: "Default Problem",
    summary: "Users struggle with X",
    confidence: 80,
    impact: "High",
    frequency: 60,
    tags: [],
    signals: 3,
    evidence: ["Customer said X", "Survey showed Y"],
    rootCause: { primary: "Lack of tooling" },
    source_ids: ["src-2"],
    citation_confidence: "high",
    ...overrides,
  };
}

describe("deriveOpportunities", () => {
  it("returns [] for empty features input", () => {
    expect(deriveOpportunities({ problems: [], features: [] })).toEqual([]);
    expect(
      deriveOpportunities({ problems: [makeProblem()], features: [] })
    ).toEqual([]);
  });

  it("caps output at 3 even when more features are provided", () => {
    const features = [
      makeFeature({ id: "f0", title: "A" }),
      makeFeature({ id: "f1", title: "B" }),
      makeFeature({ id: "f2", title: "C" }),
      makeFeature({ id: "f3", title: "D" }),
      makeFeature({ id: "f4", title: "E" }),
    ];
    const result = deriveOpportunities({ problems: [], features });
    expect(result.length).toBe(3);
  });

  it("ranks high-impact + high-confidence + low-effort first", () => {
    const best = makeFeature({
      id: "f-best",
      title: "Best Feature",
      impact: "High",
      confidence: 95,
      effort: "Low",
      source_ids: ["src-a"],
      citation_confidence: "high",
    });
    const mid = makeFeature({
      id: "f-mid",
      title: "Mid Feature",
      impact: "Medium",
      confidence: 60,
      effort: "Medium",
    });
    const worst = makeFeature({
      id: "f-worst",
      title: "Worst Feature",
      impact: "Low",
      confidence: 30,
      effort: "High",
    });

    const result = deriveOpportunities({
      problems: [],
      features: [mid, worst, best],
    });

    expect(result[0].title).toBe("Best Feature");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("generates open question for missing source_ids", () => {
    const feature = makeFeature({ id: "f-nosrc", source_ids: [] });
    const [opp] = deriveOpportunities({ problems: [], features: [feature] });
    expect(opp.openQuestions).toContain("Which customer sources validate this?");
  });

  it("includes linked problem evidence in supportingEvidence", () => {
    const problem = makeProblem({
      id: "p0",
      evidence: ["Customer said X", "Survey showed Y"],
    });
    const feature = makeFeature({
      id: "f0",
      linkedProblemId: "p0",
      successMetrics: ["Metric A"],
    });

    const [opp] = deriveOpportunities({
      problems: [problem],
      features: [feature],
    });

    expect(opp.supportingEvidence).toContain("Customer said X");
    expect(opp.supportingEvidence).toContain("Survey showed Y");
    expect(opp.supportingEvidence).toContain("Metric A");
  });
});
