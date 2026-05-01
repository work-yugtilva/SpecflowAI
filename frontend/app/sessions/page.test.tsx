import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionDetail } from "@/lib/api/session";

const pushMock = vi.fn();
const selectSessionMock = vi.fn();
const getSessionMock = vi.fn();
const getHandoffMock = vi.fn();
const generateHandoffMock = vi.fn();
const exportHandoffMock = vi.fn();
const fetchResearchEntriesMock = vi.fn();
const listSourcesMock = vi.fn();
const listSourceEvidenceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/dynamic", () => ({
  default: () => function TextShimmerMock({ children }: { children: React.ReactNode }) {
    return <span>{children}</span>;
  },
}));

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}));

vi.mock("@/components/StepInspector", () => ({
  StepInspector: () => <div>Step inspector</div>,
}));

vi.mock("@/lib/active-session-context", () => ({
  useActiveSession: () => ({ selectSession: selectSessionMock }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }),
    },
  }),
}));

vi.mock("@/lib/api/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/session")>("@/lib/api/session");
  return {
    ...actual,
    createSession: vi.fn(),
    runSession: vi.fn(),
    getSession: (...args: unknown[]) => getSessionMock(...args),
    getLastSessionMode: () => "remote",
    getHandoff: (...args: unknown[]) => getHandoffMock(...args),
    generateHandoff: (...args: unknown[]) => generateHandoffMock(...args),
    exportHandoff: (...args: unknown[]) => exportHandoffMock(...args),
  };
});

vi.mock("@/lib/api/context", () => ({
  importGlobalContextToSession: vi.fn(),
}));

vi.mock("@/lib/api/research", () => ({
  fetchResearchEntries: (...args: unknown[]) => fetchResearchEntriesMock(...args),
}));

vi.mock("@/lib/api/sources", () => ({
  listSources: (...args: unknown[]) => listSourcesMock(...args),
  listSourceEvidence: (...args: unknown[]) => listSourceEvidenceMock(...args),
}));

const { default: SessionsPage } = await import("./page");

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

function seedSessions(metadata: Record<string, unknown> = {}) {
  window.localStorage.setItem(
    "specflow_sessions",
    JSON.stringify([
      {
        session_id: "session-123456789",
        session_name: "Activation sprint",
        status: "active",
        created_at: "2026-04-24T00:00:00.000Z",
        metadata,
      },
    ])
  );
}

async function selectSeededSession() {
  render(<SessionsPage />);
  fireEvent.click(await screen.findByText("Activation sprint"));
  await screen.findByText("Session Home");
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  getSessionMock.mockResolvedValue(makeDetail({ problems: [{ id: "p1" }] }));
  getHandoffMock.mockRejectedValue(new Error("No handoff"));
  generateHandoffMock.mockResolvedValue({ success: true, handoff: { tasks: [] } });
  fetchResearchEntriesMock.mockResolvedValue([{ id: "research-1" }]);
  listSourcesMock.mockResolvedValue([{ id: "source-1" }]);
  listSourceEvidenceMock.mockResolvedValue([{ id: "evidence-1" }]);
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        ready: true,
        memory_keys: [],
        context: {
          merged: {
            companyName: "Acme",
            productName: "SpecFlow",
            productDescription: "Discovery automation",
            targetUsers: "PMs",
            goals: "Ship better PRDs",
          },
        },
      }),
  } as Response);
});

describe("SessionsPage session home", () => {
  it("renders Session Home for a selected session", async () => {
    seedSessions();
    await selectSeededSession();

    expect(screen.getAllByText("Activation sprint").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Generate Features").length).toBeGreaterThan(0);
    expect(screen.getByText("Evidence Readiness")).toBeTruthy();
    expect(await screen.findByText("Source files")).toBeTruthy();
    expect(await screen.findByText("Evidence objects")).toBeTruthy();
  });

  it("shows a sources badge when session metadata includes a source count", async () => {
    seedSessions({ source_count: 3 });

    render(<SessionsPage />);

    expect(await screen.findByText("3 sources")).toBeTruthy();
  });

  it("shows generated and missing recent outputs", async () => {
    seedSessions();
    await selectSeededSession();

    expect(screen.getByText("Recent Outputs")).toBeTruthy();
    expect(screen.getAllByText("Problems").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not generated").length).toBeGreaterThan(0);
  });

  it("hides source rows when source APIs are unavailable", async () => {
    listSourcesMock.mockRejectedValue(new Error("unavailable"));
    listSourceEvidenceMock.mockRejectedValue(new Error("unavailable"));
    seedSessions();

    await selectSeededSession();

    await waitFor(() => expect(listSourcesMock).toHaveBeenCalledWith("session", "session-123456789"));
    expect(screen.queryByText("Source files")).toBeNull();
    expect(screen.queryByText("Evidence objects")).toBeNull();
  });

  it("renders the no selected session state", async () => {
    render(<SessionsPage />);

    expect(await screen.findByText("Create or select a session to start turning research into product decisions.")).toBeTruthy();
  });
});
