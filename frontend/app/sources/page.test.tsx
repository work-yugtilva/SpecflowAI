import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let activeSessionId: string | null = "session-1";

const sourceRow = {
  id: "source-1",
  userId: "user-1",
  scope: "session" as const,
  scopeKey: "session:session-1",
  sessionId: "session-1",
  filename: "usage.csv",
  fileType: "csv" as const,
  fileSizeBytes: 128,
  status: "processed" as const,
  summary: "usage.csv: parsed 3 CSV rows.",
  evidenceCount: 2,
  createdAt: "2026-04-24T00:00:00.000Z",
};

const listSourcesMock = vi.fn();
const getSourceMock = vi.fn();
const deleteSourceMock = vi.fn();
const uploadSourceFilesMock = vi.fn();

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}));

vi.mock("@/lib/active-session-context", () => ({
  useActiveSession: () => ({ activeSessionId, selectSession: vi.fn() }),
}));

vi.mock("@/lib/api/sources", () => ({
  listSources: (...args: unknown[]) => listSourcesMock(...args),
  getSource: (...args: unknown[]) => getSourceMock(...args),
  deleteSource: (...args: unknown[]) => deleteSourceMock(...args),
  uploadSourceFiles: (...args: unknown[]) => uploadSourceFilesMock(...args),
}));

const { default: SourcesPage } = await import("./page");

beforeEach(() => {
  activeSessionId = "session-1";
  vi.clearAllMocks();
  listSourcesMock.mockResolvedValue([sourceRow]);
  getSourceMock.mockResolvedValue({
    source: { ...sourceRow, parsedText: "Rows: 3\nColumns: activation_rate" },
    evidence: [
      {
        id: "evidence-1",
        sourceFileId: "source-1",
        userId: "user-1",
        scope: "session",
        scopeKey: "session:session-1",
        evidenceType: "metric",
        title: "Metric activation_rate",
        content: "activation_rate averaged 0.38.",
        metadata: {},
      },
    ],
  });
  deleteSourceMock.mockResolvedValue(undefined);
  uploadSourceFilesMock.mockResolvedValue([{ source: sourceRow, evidenceCount: 2 }]);
});

describe("SourcesPage", () => {
  it("renders upload UI", async () => {
    render(<SourcesPage />);

    expect(screen.getByRole("heading", { name: /upload source evidence/i })).toBeTruthy();
    expect(screen.getByLabelText(/upload source files/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /choose files/i })).toBeTruthy();
    await waitFor(() => expect(listSourcesMock).toHaveBeenCalledWith("session", "session-1"));
  });

  it("renders source list and detail evidence", async () => {
    render(<SourcesPage />);

    await waitFor(() => expect(screen.getAllByText("usage.csv").length).toBeGreaterThan(0));
    expect(await screen.findByText("Metric activation_rate")).toBeTruthy();
    expect(screen.getByText(/activation_rate averaged 0.38/i)).toBeTruthy();
  });

  it("disables session-scoped upload when no active session exists", async () => {
    activeSessionId = null;

    render(<SourcesPage />);

    expect(screen.getByRole("button", { name: "Session" })).toHaveProperty("disabled", true);
    await waitFor(() => expect(listSourcesMock).toHaveBeenCalledWith("global", undefined));
  });

  it("delete action calls API and refreshes list", async () => {
    render(<SourcesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(deleteSourceMock).toHaveBeenCalledWith("source-1");
      expect(listSourcesMock).toHaveBeenCalledTimes(2);
    });
  });
});
