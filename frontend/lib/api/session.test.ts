import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSession, runSession, getLastSessionMode } from "../api/session";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchNonOk(status = 503, body?: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: "Service Unavailable",
    json: () => Promise.resolve(body ?? {}),
  });
}

// ─── createSession ───────────────────────────────────────────────────────────

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns remote result when backend responds", async () => {
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

  it("throws when backend returns non-ok status", async () => {
    vi.stubGlobal("fetch", mockFetchNonOk(503, { detail: "Service Unavailable" }));

    await expect(createSession("test")).rejects.toThrow("Service Unavailable");
  });
});

// ─── runSession ──────────────────────────────────────────────────────────────

describe("runSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls Next.js proxy URL and passes step in request body", async () => {
    const mockFetch = mockFetchOk({
      success: true,
      data: {},
      session_state: null,
    });
    vi.stubGlobal("fetch", mockFetch);

    await runSession("session-123", { context: {}, research: [], ingest: [] }, "problems");

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/sessions/session-123/run");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.step).toBe("problems");
  });

  it("sets mode to 'remote' on success", async () => {
    vi.stubGlobal("fetch", mockFetchOk({ success: true, data: {}, session_state: null }));

    await runSession("session-123", {}, "features");

    expect(getLastSessionMode()).toBe("remote");
  });

  it("surfaces FastAPI detail field on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetchNonOk(404, { detail: "Session not found" }));

    await expect(runSession("bad-id", {}, "problems")).rejects.toThrow("Session not found");
  });

  it("surfaces custom error field on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetchNonOk(422, { error: "INCOMPLETE_CONTEXT", missing: ["ingest"] }));

    await expect(runSession("sess-1", {}, "problems")).rejects.toThrow("INCOMPLETE_CONTEXT");
  });

  it("falls back to statusText when body has no error or detail", async () => {
    vi.stubGlobal("fetch", mockFetchNonOk(500, {}));

    await expect(runSession("sess-1", {}, "problems")).rejects.toThrow("Service Unavailable");
  });
});
