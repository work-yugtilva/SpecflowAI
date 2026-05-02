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

const researchRow = {
  id: "research-1",
  type: "Market Insight" as const,
  title: "Cursor for Product Managers",
  content:
    "There is an opportunity for an AI-native product management workspace that helps teams decide what to build, not only how to build it.",
  user: "Andrew Miklas",
  pain: "Product discovery context is scattered across tools.",
  context: "Article",
  tags: ["ai", "product"],
  scope: "session" as const,
  sessionId: "session-1",
  createdAt: "2026-04-24T00:00:00.000Z",
};

const listSourcesMock = vi.fn();
const getSourceMock = vi.fn();
const deleteSourceMock = vi.fn();
const uploadSourceFilesMock = vi.fn();
const fetchResearchEntriesMock = vi.fn();
const createResearchEntryMock = vi.fn();
const updateResearchEntryMock = vi.fn();
const deleteResearchEntryMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

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

vi.mock("@/lib/api/research", () => ({
  fetchResearchEntries: (...args: unknown[]) => fetchResearchEntriesMock(...args),
  createResearchEntry: (...args: unknown[]) => createResearchEntryMock(...args),
  updateResearchEntry: (...args: unknown[]) => updateResearchEntryMock(...args),
  deleteResearchEntry: (...args: unknown[]) => deleteResearchEntryMock(...args),
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
  fetchResearchEntriesMock.mockResolvedValue([researchRow]);
  createResearchEntryMock.mockResolvedValue({ ...researchRow, id: "research-2", title: "New article" });
  updateResearchEntryMock.mockResolvedValue(researchRow);
  deleteResearchEntryMock.mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ channels: [{ id: "C1", name: "product-feedback" }] }),
    })
  );
});

describe("SourcesPage", () => {
  it("renders upload UI", async () => {
    render(<SourcesPage />);

    expect(screen.getByRole("heading", { level: 1, name: /^sources$/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /references & links/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /research & articles/i })).toBeTruthy();
    expect(screen.getByLabelText(/upload source files/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /choose files/i })).toBeTruthy();
    await waitFor(() => expect(listSourcesMock).toHaveBeenCalledWith("session", "session-1"));
    await waitFor(() => expect(fetchResearchEntriesMock).toHaveBeenCalledWith("session", "session-1"));
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

    fireEvent.click(await screen.findByRole("button", { name: /delete source usage.csv/i }));

    await waitFor(() => {
      expect(deleteSourceMock).toHaveBeenCalledWith("source-1");
      expect(listSourcesMock).toHaveBeenCalledTimes(2);
    });
  });

  it("renders research entries and opens the add research modal", async () => {
    render(<SourcesPage />);

    await waitFor(() => expect(screen.getAllByText("Cursor for Product Managers").length).toBeGreaterThan(0));
    expect(screen.getAllByText(/ai-native product management workspace/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Andrew Miklas").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /import from slack/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /add research/i }));

    expect(screen.getByRole("heading", { name: /add research/i })).toBeTruthy();
    expect(screen.getByPlaceholderText(/user interview with sarah/i)).toBeTruthy();
  });

  it("refreshes research from the server and confirms after saving a new entry", async () => {
    const created = { ...researchRow, id: "research-2", title: "New interview" };
    fetchResearchEntriesMock
      .mockResolvedValueOnce([researchRow])
      .mockResolvedValueOnce([created, researchRow]);
    createResearchEntryMock.mockResolvedValue(created);

    render(<SourcesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /add research/i }));
    fireEvent.change(screen.getByPlaceholderText(/user interview with sarah/i), {
      target: { value: "New interview" },
    });
    fireEvent.change(screen.getByPlaceholderText(/summarize the research findings/i), {
      target: { value: "Customers want clearer save confirmation after adding discovery inputs." },
    });
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));

    await waitFor(() => expect(createResearchEntryMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchResearchEntriesMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/research entry saved/i)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("New interview").length).toBeGreaterThan(0));
  });

  it("confirms when a supported source file upload completes", async () => {
    render(<SourcesPage />);

    const file = new File(["hello from an interview"], "interview.txt", {
      type: "text/plain",
    });
    fireEvent.change(screen.getByLabelText(/upload source files/i), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(uploadSourceFilesMock).toHaveBeenCalledWith([file], "session", "session-1");
      expect(listSourcesMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(/uploaded 1 file/i)).toBeTruthy();
  });
});
