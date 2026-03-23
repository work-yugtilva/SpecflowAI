import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createLocalSession,
  runLocalSession,
  getLocalSession,
} from "./local-session-pipeline";

// ─── localStorage mock ─────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
});
vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid-1234-5678-abcd-ef0123456789",
});

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

// ─── createLocalSession ────────────────────────────────────────────────────

describe("createLocalSession", () => {
  it("creates a session with correct shape", async () => {
    const result = await createLocalSession("My Session");
    expect(result.session_id).toMatch(/^session-/);
    expect(result.session_name).toBe("My Session");
    expect(result.status).toBe("active");
    expect(result.created_at).toBeTruthy();
  });

  it("stores session in localStorage", async () => {
    await createLocalSession("Stored Session");
    const raw = store["specflow_sessions"];
    expect(raw).toBeTruthy();
    const sessions = JSON.parse(raw) as Array<{ session_name: string }>;
    expect(sessions[0].session_name).toBe("Stored Session");
  });
});

// ─── runLocalSession — semantic filtering ─────────────────────────────────

describe("runLocalSession — semantic filtering", () => {
  it("uses content from ingest, not UUID/type/createdAt", async () => {
    const { session_id } = await createLocalSession("test");
    const input = {
      context: {},
      research: [],
      ingest: [
        {
          id: "bebc4a35-fake-uuid-0000-0000-000000000000",
          type: "interview",
          content: "Users struggle to find relevant products in the search results",
          metadata: { user: "Product Manager", pain: "search relevance" },
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    };

    const result = await runLocalSession(session_id, input, "problems");
    const problems = result.data.problems as Array<{ title: string; summary: string }>;

    expect(problems).toHaveLength(1);
    expect(problems[0].title).not.toMatch(/bebc4a35/i);
    expect(problems[0].title).not.toMatch(/^interview/i);
    expect(problems[0].title.length).toBeGreaterThan(5);
  });

  it("falls back to generic seeds when ingest has only ID/type/timestamp fields", async () => {
    const { session_id } = await createLocalSession("test");
    const input = {
      context: {},
      research: [],
      ingest: [
        {
          id: "abc-def-ghi",
          type: "product_data",
          content: "",
          metadata: {},
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    };

    const result = await runLocalSession(session_id, input, "problems");
    const problems = result.data.problems as Array<{ title: string }>;

    expect(problems.length).toBeGreaterThan(0);
    // Fallback seeds should produce coherent non-UUID titles
    expect(problems[0].title).not.toMatch(/^[a-f0-9-]{8,}/i);
  });

  it("features do not append 'Workspace' to titles", async () => {
    const { session_id } = await createLocalSession("test");
    const input = {
      context: {},
      research: [],
      ingest: [
        {
          id: "xyz",
          type: "interview",
          content: "Onboarding takes too long and users abandon the flow before completing setup",
          metadata: {},
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    };

    await runLocalSession(session_id, input, "problems");
    const result = await runLocalSession(session_id, input, "features");
    const features = result.data.features as Array<{ title: string }>;

    expect(features.length).toBeGreaterThan(0);
    features.forEach((f) => {
      expect(f.title).not.toMatch(/Workspace$/);
    });
  });

  it("throws for unknown pipeline step", async () => {
    const { session_id } = await createLocalSession("test");
    await expect(
      runLocalSession(session_id, { context: {}, research: [], ingest: [] }, "unknown_step")
    ).rejects.toThrow("Unknown pipeline step");
  });
});

// ─── getLocalSession ───────────────────────────────────────────────────────

describe("getLocalSession", () => {
  it("returns null state for a new session", async () => {
    const { session_id } = await createLocalSession("My Session");
    const detail = await getLocalSession(session_id);

    expect(detail.session.id).toBe(session_id);
    expect(detail.state).toBeNull();
    expect(detail.events).toHaveLength(0);
  });

  it("returns state and events after running a step", async () => {
    const { session_id } = await createLocalSession("test");
    await runLocalSession(
      session_id,
      { context: {}, research: [], ingest: [] },
      "problems"
    );
    const detail = await getLocalSession(session_id);

    expect(detail.state).not.toBeNull();
    expect(detail.state?.state.last_completed_step).toBe("problems");
    expect(detail.events.length).toBeGreaterThan(0);
  });

  it("tracks completed status after tasks step", async () => {
    const { session_id } = await createLocalSession("test");
    const input = { context: {}, research: [], ingest: [] };
    await runLocalSession(session_id, input, "problems");
    await runLocalSession(session_id, input, "features");
    await runLocalSession(session_id, input, "decompose");
    await runLocalSession(session_id, input, "tasks");

    const detail = await getLocalSession(session_id);
    expect(detail.session.status).toBe("completed");
  });
});
