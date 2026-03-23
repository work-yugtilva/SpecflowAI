import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSession, runSession, getLastSessionMode } from "../api/session";

// ─── Mock local pipeline ────────────────────────────────────────────────────

vi.mock("@/lib/local-session-pipeline", () => ({
  createLocalSession: vi.fn().mockResolvedValue({
    session_id: "local-session-123",
    session_name: "test",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
  }),
  runLocalSession: vi.fn().mockResolvedValue({
    success: true,
    data: { problems: [] },
    session_state: null,
  }),
  getLocalSession: vi.fn().mockResolvedValue({
    session: {
      id: "local-session-123",
      session_name: "test",
      status: "active",
      metadata: {},
      created_at: "",
      updated_at: "",
    },
    state: null,
    events: [],
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new Error("ERR_CONNECTION_REFUSED"));
}

function mockFetchNonOk(status = 503) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve("Service Unavailable"),
    statusText: "Service Unavailable",
  });
}

// ─── createSession ───────────────────────────────────────────────────────────

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns remote result and sets mode to 'remote' when backend responds", async () => {
    vi.stubGlobal("fetch", mockFetchOk({
      session_id: "remote-session-456",
      session_name: "test",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
    }));

    const result = await createSession("test");

    expect(result.session_id).toBe("remote-session-456");
    expect(getLastSessionMode()).toBe("remote");
  });

  it("falls back to local and sets mode to 'local' when backend is unreachable", async () => {
    vi.stubGlobal("fetch", mockFetchNetworkError());

    const result = await createSession("test");

    expect(result.session_id).toBe("local-session-123");
    expect(getLastSessionMode()).toBe("local");
  });

  it("falls back to local when backend returns non-ok status", async () => {
    vi.stubGlobal("fetch", mockFetchNonOk(503));

    const result = await createSession("test");

    expect(result.session_id).toBe("local-session-123");
    expect(getLastSessionMode()).toBe("local");
  });
});

// ─── runSession ──────────────────────────────────────────────────────────────

describe("runSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("passes step parameter to backend in request body", async () => {
    const mockFetch = mockFetchOk({
      success: true,
      data: {},
      session_state: null,
    });
    vi.stubGlobal("fetch", mockFetch);

    await runSession("session-123", { context: {}, research: [], ingest: [] }, "problems");

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/session/session-123/run");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.step).toBe("problems");
  });

  it("sets mode to 'remote' on success", async () => {
    vi.stubGlobal("fetch", mockFetchOk({ success: true, data: {}, session_state: null }));

    await runSession("session-123", {}, "features");

    expect(getLastSessionMode()).toBe("remote");
  });

  it("falls back to local on network error", async () => {
    vi.stubGlobal("fetch", mockFetchNetworkError());

    const result = await runSession("local-session-123", {}, "problems");

    expect(result.success).toBe(true);
    expect(getLastSessionMode()).toBe("local");
  });
});
