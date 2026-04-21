import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

const { POST } = await import("./route");

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function makeRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost:3000/api/pipeline/autosave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: "session-1",
      output_key: "prd",
      updated_content: { title: "Updated PRD" },
      ...overrides,
    }),
  });
}

function makeQuery(result: QueryResult) {
  const query = {
    select: vi.fn(() => query),
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return query;
}

function setupSupabase({
  sessionResult = { data: { id: "session-1" }, error: null },
  memoryResult = { data: { id: "memory-1" }, error: null },
  updateResult = { data: { id: "memory-1" }, error: null },
}: {
  sessionResult?: QueryResult;
  memoryResult?: QueryResult;
  updateResult?: QueryResult;
} = {}) {
  const sessionQuery = makeQuery(sessionResult);
  const memoryOwnershipQuery = makeQuery(memoryResult);
  const memoryUpdateQuery = makeQuery(updateResult);
  const memoryQueries = [memoryOwnershipQuery, memoryUpdateQuery];
  const from = vi.fn((table: string) => {
    if (table === "sessions") return sessionQuery;
    if (table === "memory_entries") {
      return memoryQueries.shift() ?? memoryUpdateQuery;
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from,
  });

  return {
    from,
    sessionQuery,
    memoryOwnershipQuery,
    memoryUpdateQuery,
  };
}

describe("POST /api/pipeline/autosave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters the session lookup by the authenticated user id", async () => {
    const { sessionQuery } = setupSupabase();

    const response = await POST(makeRequest() as never);

    expect(response.status).toBe(200);
    expect(sessionQuery.eq).toHaveBeenCalledWith("id", "session-1");
    expect(sessionQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("returns the existing session 404 when the session is missing or belongs to another user", async () => {
    const { from } = setupSupabase({
      sessionResult: { data: null, error: null },
    });

    const response = await POST(makeRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ success: false, error: "Session not found" });
    expect(from).not.toHaveBeenCalledWith("memory_entries");
  });

  it("checks memory ownership through the owning session before updating", async () => {
    const { memoryOwnershipQuery } = setupSupabase();

    const response = await POST(makeRequest() as never);

    expect(response.status).toBe(200);
    expect(memoryOwnershipQuery.select).toHaveBeenCalledWith("id, sessions!inner(id)");
    expect(memoryOwnershipQuery.eq).toHaveBeenCalledWith("session_id", "session-1");
    expect(memoryOwnershipQuery.eq).toHaveBeenCalledWith("memory_key", "prd");
    expect(memoryOwnershipQuery.eq).toHaveBeenCalledWith("sessions.user_id", "user-1");
  });

  it("returns the existing editable-content 404 when no owned memory row is found", async () => {
    const { memoryUpdateQuery } = setupSupabase({
      memoryResult: { data: null, error: null },
    });

    const response = await POST(makeRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ success: false, error: "Editable content not found" });
    expect(memoryUpdateQuery.update).not.toHaveBeenCalled();
  });

  it("updates only the verified memory row and preserves the response shape", async () => {
    const { memoryUpdateQuery } = setupSupabase();

    const response = await POST(makeRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(memoryUpdateQuery.update).toHaveBeenCalledWith({
      content: { title: "Updated PRD" },
    });
    expect(memoryUpdateQuery.eq).toHaveBeenCalledWith("id", "memory-1");
    expect(memoryUpdateQuery.eq).toHaveBeenCalledWith("session_id", "session-1");
    expect(memoryUpdateQuery.eq).toHaveBeenCalledWith("memory_key", "prd");
  });
});
