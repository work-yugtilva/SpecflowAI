import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const getActiveSessionIdMock = vi.fn();

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

vi.mock("@/lib/pipeline-input", () => ({
  getActiveSessionId: () => getActiveSessionIdMock(),
}));

const { default: SourcesPage } = await import("./page");

beforeEach(() => {
  activeSessionId = "session-1";
  vi.clearAllMocks();
  getActiveSessionIdMock.mockImplementation(() => activeSessionId);
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
    expect(screen.getByText(/uploading to session:/i)).toBeTruthy();
    expect(screen.getByText("session-")).toBeTruthy();
    await waitFor(() => expect(listSourcesMock).toHaveBeenCalledWith("session", "session-1"));
    await waitFor(() => expect(fetchResearchEntriesMock).toHaveBeenCalledWith("session", "session-1"));
  });

  it("uploads session-scoped files with the latest active session id", async () => {
    render(<SourcesPage />);

    const file = new File(["activation_rate,users\n0.38,10"], "usage.csv", {
      type: "text/csv",
    });
    fireEvent.change(screen.getByLabelText(/upload source files/i), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(uploadSourceFilesMock).toHaveBeenCalledWith([file], "session", "session-1");
    });
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
    expect(screen.getByText(/no active session/i)).toBeTruthy();
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
    expect(await screen.findByText(/research entry saved/i)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("New interview").length).toBeGreaterThan(0));
  });

  it("shows a stable research load error instead of falling back silently", async () => {
    fetchResearchEntriesMock.mockRejectedValueOnce(new Error("network down"));

    render(<SourcesPage />);

    expect(
      await screen.findByText("Failed to load research entries. Check your connection.")
    ).toBeTruthy();
    expect(screen.queryByText("Cursor for Product Managers")).toBeNull();
  });

  it("optimistically shows a new research entry while save is in flight", async () => {
    let resolveCreate!: (value: typeof researchRow) => void;
    createResearchEntryMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    render(<SourcesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /add research/i }));
    fireEvent.change(screen.getByPlaceholderText(/user interview with sarah/i), {
      target: { value: "Optimistic interview" },
    });
    fireEvent.change(screen.getByPlaceholderText(/summarize the research findings/i), {
      target: { value: "Customers want saved research to appear immediately." },
    });
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));

    expect((await screen.findAllByText("Optimistic interview")).length).toBeGreaterThan(0);
    expect(fetchResearchEntriesMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate({
        ...researchRow,
        id: "research-2",
        title: "Optimistic interview",
        content: "Customers want saved research to appear immediately.",
      });
      await Promise.resolve();
    });
  });

  it("rolls back an optimistic research add when the API save fails", async () => {
    let rejectCreate!: (error: Error) => void;
    createResearchEntryMock.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectCreate = reject;
      })
    );

    render(<SourcesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /add research/i }));
    fireEvent.change(screen.getByPlaceholderText(/user interview with sarah/i), {
      target: { value: "Rollback interview" },
    });
    fireEvent.change(screen.getByPlaceholderText(/summarize the research findings/i), {
      target: { value: "This optimistic row should disappear on failure." },
    });
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));

    expect((await screen.findAllByText("Rollback interview")).length).toBeGreaterThan(0);

    await act(async () => {
      rejectCreate(new Error("save failed"));
      await Promise.resolve();
    });

    expect(await screen.findByText(/save failed/i)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Rollback interview")).toBeNull());
  });

  it("rolls back an optimistic research delete when the API delete fails", async () => {
    deleteResearchEntryMock.mockRejectedValueOnce(new Error("delete failed"));

    render(<SourcesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /delete research cursor for product managers/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(deleteResearchEntryMock).toHaveBeenCalledWith("research-1"));
    expect(await screen.findByText(/delete failed/i)).toBeTruthy();
    expect(screen.getAllByText("Cursor for Product Managers").length).toBeGreaterThan(0);
  });

  it("disables the research save button while saving", async () => {
    let resolveCreate!: (value: typeof researchRow) => void;
    createResearchEntryMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    render(<SourcesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /add research/i }));
    fireEvent.change(screen.getByPlaceholderText(/user interview with sarah/i), {
      target: { value: "New interview" },
    });
    fireEvent.change(screen.getByPlaceholderText(/summarize the research findings/i), {
      target: { value: "Customers want clearer save confirmation after adding discovery inputs." },
    });
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));

    expect(await screen.findByRole("button", { name: /saving/i })).toHaveProperty("disabled", true);

    await act(async () => {
      resolveCreate({ ...researchRow, id: "research-2", title: "New interview" });
      await Promise.resolve();
    });
  });

  it("shows a visible Slack discovery error when channel loading fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Slack unavailable"));

    render(<SourcesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /import from slack/i }));

    expect(await screen.findByText(/failed to load slack channels/i)).toBeTruthy();
  });

  it("prevents duplicate source delete requests while deleting", async () => {
    let resolveDelete!: () => void;
    deleteSourceMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      })
    );

    render(<SourcesPage />);

    const deleteButton = await screen.findByRole("button", { name: /delete source usage.csv/i });
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    expect(deleteSourceMock).toHaveBeenCalledTimes(1);
    expect(deleteButton).toHaveProperty("disabled", true);

    await act(async () => {
      resolveDelete();
      await Promise.resolve();
    });
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

  it("shows an upload error when a returned source failed to parse", async () => {
    const failedSourceRow = {
      ...sourceRow,
      id: "source-failed",
      filename: "stripe_product_usage_analysis.pdf",
      fileType: "pdf" as const,
      status: "failed" as const,
      summary: "DOMMatrix is not defined",
      errorMessage: "DOMMatrix is not defined",
      evidenceCount: 0,
    };
    listSourcesMock.mockResolvedValueOnce([sourceRow]).mockResolvedValueOnce([failedSourceRow]);
    getSourceMock
      .mockResolvedValueOnce({
        source: { ...sourceRow, parsedText: "Rows: 3\nColumns: activation_rate" },
        evidence: [],
      })
      .mockResolvedValue({
        source: { ...failedSourceRow, parsedText: null },
        evidence: [],
      });
    uploadSourceFilesMock.mockResolvedValueOnce([{ source: failedSourceRow, evidenceCount: 0 }]);

    render(<SourcesPage />);

    const file = new File(["%PDF-1.7"], "stripe_product_usage_analysis.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText(/upload source files/i), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(uploadSourceFilesMock).toHaveBeenCalledWith([file], "session", "session-1");
      expect(listSourcesMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(/upload failed to parse/i)).toBeTruthy();
    expect(screen.getAllByText(/DOMMatrix is not defined/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/uploaded 1 file/i)).toBeNull();
  });
});
