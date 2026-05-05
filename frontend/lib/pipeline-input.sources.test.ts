import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchResearchEntriesMock = vi.fn();
const listSourceEvidenceMock = vi.fn();

vi.mock("@/lib/api/research", () => ({
  fetchResearchEntries: (...args: unknown[]) => fetchResearchEntriesMock(...args),
}));

vi.mock("@/lib/api/sources", () => ({
  listSourceEvidence: (...args: unknown[]) => listSourceEvidenceMock(...args),
}));

const { buildPipelineInputFromStorage, getSourceEvidencePayload } = await import("./pipeline-input");

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
    expect(listSourceEvidenceMock).not.toHaveBeenCalledWith("global");
    expect(input.ingest).toHaveLength(2);
    expect(input.ingest[1]).toMatchObject({
      id: "evidence-1",
      source_id: "source-1",
      type: "metric",
    });
    expect(input.analytics_context).toContain("METRIC: activation_rate");
    expect(input.analytics_context).toContain("Current: 0.38");
  });

  it("does not duplicate source evidence already present in pending ingest", async () => {
    localStorage.setItem(
      "specflow_s_session-1__pending_input",
      JSON.stringify({
        context: { productName: "SpecFlow" },
        ingest: [
          {
            id: "evidence-1",
            source_id: "source-1",
            source_title: "usage.csv",
            type: "metric",
            title: "Metric activation_rate",
            content: "activation_rate averaged 0.38.",
          },
        ],
      })
    );

    const input = await buildPipelineInputFromStorage("session-1");

    expect(input.ingest).toHaveLength(1);
    expect(input.ingest[0]).toMatchObject({ id: "evidence-1" });
  });

  it("falls back to global source evidence when session evidence is empty", async () => {
    listSourceEvidenceMock.mockImplementation((scope: string) => {
      if (scope === "session") return Promise.resolve([]);
      return Promise.resolve([
        {
          id: "global-evidence-1",
          source_id: "global-source-1",
          source_title: "global-notes.txt",
          type: "observation",
          title: "Uploaded source: global-notes.txt",
          content: "Global source evidence should still ground session runs.",
          metadata: {},
        },
      ]);
    });

    const input = await buildPipelineInputFromStorage("session-1");

    expect(listSourceEvidenceMock).toHaveBeenCalledWith("session", "session-1");
    expect(listSourceEvidenceMock).toHaveBeenCalledWith("global");
    expect(input.ingest).toHaveLength(1);
    expect(input.ingest[0]).toMatchObject({
      id: "global-evidence-1",
      source_id: "global-source-1",
    });
  });

  it("uses global source evidence directly when no session id is present", async () => {
    await getSourceEvidencePayload(null);

    expect(listSourceEvidenceMock).toHaveBeenCalledTimes(1);
    expect(listSourceEvidenceMock).toHaveBeenCalledWith("global");
  });

  it("allows downstream steps to build from session memory without fresh evidence", async () => {
    fetchResearchEntriesMock.mockResolvedValue([]);
    listSourceEvidenceMock.mockResolvedValue([]);
    localStorage.setItem(
      "specflow_s_session-1__context",
      JSON.stringify({ productName: "SpecFlow" })
    );

    const input = await buildPipelineInputFromStorage("session-1", {
      requireEvidence: false,
    });

    expect(input.context).toMatchObject({ productName: "SpecFlow" });
    expect(input.research).toEqual([]);
    expect(input.ingest).toEqual([]);
  });
});
