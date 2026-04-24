import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchResearchEntriesMock = vi.fn();
const listSourceEvidenceMock = vi.fn();

vi.mock("@/lib/api/research", () => ({
  fetchResearchEntries: (...args: unknown[]) => fetchResearchEntriesMock(...args),
}));

vi.mock("@/lib/api/sources", () => ({
  listSourceEvidence: (...args: unknown[]) => listSourceEvidenceMock(...args),
}));

const { buildPipelineInputFromStorage } = await import("./pipeline-input");

describe("buildPipelineInputFromStorage source evidence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    fetchResearchEntriesMock.mockResolvedValue([{ id: "research-1" }]);
    listSourceEvidenceMock.mockResolvedValue([
      {
        id: "evidence-1",
        source_id: "source-1",
        source_title: "usage.csv",
        type: "metric",
        title: "Metric activation_rate",
        content: "activation_rate averaged 0.38.",
        metadata: {
          metric_name: "activation_rate",
          metric_value: 0.38,
        },
      },
    ]);
  });

  it("appends uploaded source evidence to ingest and emits analytics_context", async () => {
    localStorage.setItem(
      "specflow_s_session-1__pending_input",
      JSON.stringify({
        context: { productName: "SpecFlow" },
        ingest: [{ id: "pending-1", content: "Manual interview" }],
      })
    );

    const input = await buildPipelineInputFromStorage("session-1");

    expect(fetchResearchEntriesMock).toHaveBeenCalledWith("session", "session-1");
    expect(listSourceEvidenceMock).toHaveBeenCalledWith("session", "session-1");
    expect(input.ingest).toHaveLength(2);
    expect(input.ingest[1]).toMatchObject({
      id: "evidence-1",
      source_id: "source-1",
      type: "metric",
    });
    expect(input.analytics_context).toContain("METRIC: activation_rate");
    expect(input.analytics_context).toContain("Current: 0.38");
  });
});
