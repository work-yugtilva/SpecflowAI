import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createSession,
  runSession,
  getSession,
  getHandoff,
  startSessionRunAsync,
  getLastSessionMode,
  normalizeHandoffTasks,
} from "../api/session";

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

// ─── getSession ──────────────────────────────────────────────────────────────

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns session detail on success", async () => {
    vi.stubGlobal("fetch", mockFetchOk({
      session: { id: "sess-abc", session_name: "My Session", status: "active",
                 metadata: {}, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
      state: null,
      events: [],
    }));

    const result = await getSession("sess-abc");
    expect(result.session.id).toBe("sess-abc");
  });

  it("throws when session not found", async () => {
    vi.stubGlobal("fetch", mockFetchNonOk(404, { detail: "Session not found" }));

    await expect(getSession("bad-id")).rejects.toThrow("Session not found");
  });
});

// ─── startSessionRunAsync ─────────────────────────────────────────────────────

describe("startSessionRunAsync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns job_id on 202 accepted", async () => {
    vi.stubGlobal("fetch", mockFetchOk({ job_id: "abc12345", status: "queued" }));

    const result = await startSessionRunAsync("sess-1", { context: {} }, "problems");
    expect(result.job_id).toBe("abc12345");
    expect(result.status).toBe("queued");
  });

  it("includes step in request body when provided", async () => {
    const mockFetch = mockFetchOk({ job_id: "j1", status: "queued" });
    vi.stubGlobal("fetch", mockFetch);

    await startSessionRunAsync("sess-1", {}, "features");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.step).toBe("features");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetchNonOk(503, { detail: "Service overloaded" }));

    await expect(startSessionRunAsync("sess-1", {})).rejects.toThrow("Service overloaded");
  });

  it("preserves NO_EVIDENCE code from 422 responses", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchNonOk(422, {
        code: "NO_EVIDENCE",
        message: "Upload at least one source document before running the pipeline.",
      })
    );

    await expect(startSessionRunAsync("sess-1", {}, "problems")).rejects.toMatchObject({
      code: "NO_EVIDENCE",
      status: 422,
      message: "NO_EVIDENCE: Upload at least one source document before running the pipeline.",
    });
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

// ─── Agent handoff — task list shape from API/LLM ───────────────────────────

describe("normalizeHandoffTasks", () => {
  it("returns a plain array as-is", () => {
    const a = [{ id: "1" }];
    expect(normalizeHandoffTasks(a)).toBe(a);
  });

  it("unwraps { data: [...] } and double-wrapped data", () => {
    const inner = [{ id: "t" }];
    expect(normalizeHandoffTasks({ data: { data: inner } })).toEqual(inner);
  });

  it("accepts { items: [...] } (export path parity with FastAPI)", () => {
    expect(
      normalizeHandoffTasks({ items: [{ id: "a", layer: "API" }] })
    ).toEqual([{ id: "a", layer: "API" }]);
  });

  it("returns [] for non-array object without items", () => {
    expect(normalizeHandoffTasks({})).toEqual([]);
  });
});

// ─── getHandoff (coercion) ──────────────────────────────────────────────────

describe("getHandoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("coerces tasks from { items: [...] } so UI always gets an array", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({
        handoff: {
          project_brief: "p",
          execution_order: [],
          needs_clarification_count: 0,
          architecture_notes: "",
          tasks: { items: [{ id: "1", title: "T", layer: "API" }] },
        },
      })
    );

    const r = await getHandoff("sess-1");
    expect(r.handoff.tasks).toHaveLength(1);
    expect(r.handoff.tasks[0].id).toBe("1");
  });
});
