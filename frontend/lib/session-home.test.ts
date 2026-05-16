import { describe, expect, it } from "vitest";
import type { SessionDetail } from "@/lib/api/session";
import {
  countOutputItems,
  getMissingContextFields,
  getNextRecommendedAction,
  getSessionHomeSummary,
} from "./session-home";

function makeDetail(outputs: Record<string, unknown> = {}): SessionDetail {
  return {
    session: {
      id: "session-123456789",
      session_name: "Activation sprint",
      status: "active",
      metadata: {},
      created_at: "2026-04-24T00:00:00.000Z",
      updated_at: "2026-04-24T01:00:00.000Z",
    },
    state: {
      session_id: "session-123456789",
      step: null,
      state: {
        last_completed_step: "problems",
        outputs,
        regeneration_counts: {},
      },
    },
    events: [],
  };
}

const completeContext = {
  companyName: "Acme",
  productName: "SpecFlow",
  productDescription: "Product discovery automation",
  targetUsers: "PMs",
  goals: "Ship better PRDs",
};

describe("session-home helpers", () => {
  it("reports missing context fields", () => {
    expect(
      getMissingContextFields({ companyName: "Acme", productName: "SpecFlow" })
    ).toEqual(["Product description", "Target users", "Goals"]);
    expect(getMissingContextFields(completeContext)).toEqual([]);
  });

  it("counts direct and wrapped output arrays", () => {
    expect(countOutputItems({ problems: [{ id: "p1" }] }, "problems")).toBe(1);
    expect(countOutputItems({ features: { data: [{ id: "f1" }, { id: "f2" }] } }, "features")).toBe(2);
    expect(countOutputItems({ tasks: { tasks: [{ id: "t1" }] } }, "tasks")).toBe(1);
    expect(countOutputItems({ prd: { title: "PRD" } }, "prd")).toBe(1);
    expect(countOutputItems({}, "problems")).toBe(0);
  });

  it("computes action progression from readiness and outputs", () => {
    const missingContext = getSessionHomeSummary({
      detail: makeDetail(),
      context: {},
      sourceCounts: { available: true, sourceCount: 0, evidenceCount: 0 },
      hasHandoff: false,
    });
    expect(getNextRecommendedAction(missingContext).label).toBe("Complete Context");

    const missingEvidence = getSessionHomeSummary({
      detail: makeDetail(),
      context: completeContext,
      sourceCounts: { available: true, sourceCount: 0, evidenceCount: 0 },
      hasHandoff: false,
    });
    expect(getNextRecommendedAction(missingEvidence).label).toBe("Add Sources");

    const readyForFeatures = getSessionHomeSummary({
      detail: makeDetail({ problems: [{ id: "p1" }] }),
      context: completeContext,
      sourceCounts: { available: true, sourceCount: 1, evidenceCount: 3 },
      hasHandoff: false,
    });
    expect(getNextRecommendedAction(readyForFeatures).label).toBe("Generate Features");

    const complete = getSessionHomeSummary({
      detail: makeDetail({
        problems: [{ id: "p1" }],
        features: [{ id: "f1" }],
        decompositions: [{ id: "d1" }],
        tasks: [{ id: "t1" }],
        prd: { title: "PRD" },
      }),
      context: completeContext,
      sourceCounts: { available: false },
      hasHandoff: true,
    });
    expect(getNextRecommendedAction(complete).label).toBe("View Handoff");
    expect(complete.evidenceRows.map((row) => row.label)).toEqual(["Context", "Research entries"]);
  });
});
