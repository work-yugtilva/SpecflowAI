import { describe, expect, it } from "vitest";
import { adaptProblems } from "./pipeline-contracts";

describe("adaptProblems source citations", () => {
  it("uses source_ids and string research_evidence as visible source grounding", () => {
    const [problem] = adaptProblems({
      problems: [
        {
          id: "p1",
          title: "Developers lose transaction visibility",
          description: "Webhook failures hide payment confirmation state.",
          confidence: 0.95,
          severity: "high",
          source_ids: ["source-a", "source-b"],
          citation_confidence: "high",
          research_evidence:
            "[Source: stripe_product_usage_analysis.pdf] Webhook endpoint failures are the #1 source of support tickets at activation.",
        },
      ],
    });

    expect(problem.signals).toBe(2);
    expect(problem.evidence).toEqual(["source-a", "source-b"]);
    expect(problem.source_ids).toEqual(["source-a", "source-b"]);
    expect(problem.researchEvidence).toEqual([
      {
        title: "stripe_product_usage_analysis.pdf",
        source: "Uploaded source",
        content:
          "Webhook endpoint failures are the #1 source of support tickets at activation.",
      },
    ]);
  });
});
