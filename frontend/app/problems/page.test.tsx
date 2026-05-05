import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const buildPipelineInputFromStorageMock = vi.fn();
const getSourceEvidencePayloadMock = vi.fn();
const runPipelineStepOrFullMock = vi.fn();
const setActiveSessionDetailMock = vi.fn();
const NO_SOURCE_EVIDENCE_ERROR =
  "No uploaded sources found for this session. Go to Sources and upload a document first, then re-run.";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}));

vi.mock("@/components/pipeline/PipelineStepper", () => ({
  PipelineStepper: () => <div>Pipeline stepper</div>,
}));

vi.mock("@/components/pipeline/QualityBadge", () => ({
  QualityBadge: () => <span>Quality badge</span>,
}));

vi.mock("@/components/pipeline/PipelineTrace", () => ({
  PipelineTrace: () => <div>Pipeline trace</div>,
}));

vi.mock("@/components/pipeline/CitationBadge", () => ({
  CitationBadge: () => <span>Citation badge</span>,
}));

vi.mock("@/components/pipeline/EvidencePanel", () => ({
  EvidencePanel: () => <div>Evidence panel</div>,
}));

vi.mock("@/components/ui/text-shimmer", () => ({
  TextShimmer: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/orphaned-pipeline-modal", () => ({
  OrphanedPipelineModal: () => null,
}));

vi.mock("@/components/ui/conversation-panel", () => ({
  ConversationPanel: () => null,
}));

vi.mock("@/lib/active-session-context", () => ({
  useActiveSession: () => ({ activeSessionId: "session-1" }),
}));

vi.mock("@/lib/store/session-store", () => ({
  useSessionStore: (selector: (state: { setActiveSessionDetail: typeof setActiveSessionDetailMock }) => unknown) =>
    selector({ setActiveSessionDetail: setActiveSessionDetailMock }),
}));

vi.mock("@/lib/api/session", () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args),
}));

vi.mock("@/lib/pipeline-input", () => ({
  buildPipelineInputFromStorage: (...args: unknown[]) => buildPipelineInputFromStorageMock(...args),
  clearAutorunFlag: vi.fn(),
  getSourceEvidencePayload: (...args: unknown[]) => getSourceEvidencePayloadMock(...args),
  isAutorunPending: () => false,
  NO_SOURCE_EVIDENCE_ERROR,
}));

vi.mock("@/lib/run-pipeline-client", () => ({
  runPipelineStepOrFull: (...args: unknown[]) => runPipelineStepOrFullMock(...args),
}));

vi.mock("@/lib/use-orphaned-pipeline", () => ({
  useOrphanedPipeline: () => ({
    showOrphanedModal: false,
    orphanedOutput: null,
    triggerOrphanedPrompt: vi.fn(),
    closeOrphanedModal: vi.fn(),
  }),
}));

const { default: ProblemsPage } = await import("./page");

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({
    session: {
      id: "session-1",
      session_name: "Activation sprint",
      status: "active",
      metadata: {},
      created_at: "2026-04-24T00:00:00.000Z",
      updated_at: "2026-04-24T00:00:00.000Z",
    },
    state: { state: { outputs: {}, regeneration_counts: {} } },
    events: [],
  });
  getSourceEvidencePayloadMock.mockResolvedValue([]);
  buildPipelineInputFromStorageMock.mockResolvedValue({ context: {}, ingest: [] });
  runPipelineStepOrFullMock.mockResolvedValue({
    data: { problems: [] },
    mode: "session",
    sessionState: null,
  });
});

describe("ProblemsPage source evidence guard", () => {
  it("blocks the run before building input when no uploaded source evidence exists", async () => {
    render(<ProblemsPage />);

    const runButtons = await screen.findAllByRole("button", { name: /run problems/i });
    fireEvent.click(runButtons[0]);

    expect(await screen.findByText(NO_SOURCE_EVIDENCE_ERROR)).toBeTruthy();
    expect(getSourceEvidencePayloadMock).toHaveBeenCalledWith("session-1");
    expect(buildPipelineInputFromStorageMock).not.toHaveBeenCalled();
    expect(runPipelineStepOrFullMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy());
  });
});
