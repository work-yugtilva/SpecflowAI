import { describe, it, expect } from "vitest";
import { computeStepStatuses, getNextStep, PIPELINE_STEPS } from "./pipeline-session";
import type { SessionDetail } from "@/lib/api/session";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDetail(
  status: string,
  lastCompleted: string | null = null
): SessionDetail {
  return {
    session: {
      id: "s1",
      session_name: "test",
      status,
      metadata: {},
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    state: lastCompleted
      ? { session_id: "s1", step: null, state: { last_completed_step: lastCompleted, outputs: {}, regeneration_counts: {} } }
      : null,
    events: [],
  };
}

// ---------------------------------------------------------------------------
// computeStepStatuses
// ---------------------------------------------------------------------------

describe("computeStepStatuses", () => {
  it("all pending when detail is null", () => {
    const statuses = computeStepStatuses(null);
    PIPELINE_STEPS.forEach((s) => expect(statuses[s.id]).toBe("pending"));
  });

  it("all pending when active with no completed steps", () => {
    const statuses = computeStepStatuses(makeDetail("active", null));
    PIPELINE_STEPS.forEach((s) => expect(statuses[s.id]).toBe("pending"));
  });

  it("all completed when session status is completed", () => {
    const statuses = computeStepStatuses(makeDetail("completed"));
    PIPELINE_STEPS.forEach((s) => expect(statuses[s.id]).toBe("completed"));
  });

  it("marks steps up to lastCompleted as completed", () => {
    const statuses = computeStepStatuses(makeDetail("active", "features"));
    expect(statuses["problems"]).toBe("completed");
    expect(statuses["features"]).toBe("completed");
    expect(statuses["decompose"]).toBe("pending");
    expect(statuses["tasks"]).toBe("pending");
  });

  it("marks only first step completed when last_completed is problems", () => {
    const statuses = computeStepStatuses(makeDetail("active", "problems"));
    expect(statuses["problems"]).toBe("completed");
    expect(statuses["features"]).toBe("pending");
  });

  it("marks next step as failed when session is failed mid-pipeline", () => {
    const statuses = computeStepStatuses(makeDetail("failed", "features"));
    expect(statuses["features"]).toBe("completed");
    expect(statuses["decompose"]).toBe("failed");
    expect(statuses["tasks"]).toBe("pending");
  });

  it("marks first step failed when session fails with no completed step", () => {
    const statuses = computeStepStatuses(makeDetail("failed", null));
    expect(statuses["problems"]).toBe("failed");
  });
});

// ---------------------------------------------------------------------------
// getNextStep
// ---------------------------------------------------------------------------

describe("getNextStep", () => {
  it("returns first pending step", () => {
    const statuses = computeStepStatuses(makeDetail("active", "problems"));
    expect(getNextStep(statuses)).toBe("features");
  });

  it("returns null when all steps are completed", () => {
    const statuses = computeStepStatuses(makeDetail("completed"));
    expect(getNextStep(statuses)).toBeNull();
  });

  it("returns problems when nothing is completed", () => {
    const statuses = computeStepStatuses(null);
    expect(getNextStep(statuses)).toBe("problems");
  });
});
