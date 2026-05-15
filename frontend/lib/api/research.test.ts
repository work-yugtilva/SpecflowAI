import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "token-1" } },
      }),
    },
  }),
}));

vi.mock("@/lib/api/express-base", () => ({
  getExpressApiBase: () => "/api/express",
}));

const { fetchResearchEntries } = await import("./research");

describe("research API client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("normalizes Express rows into the pipeline research schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: "research-1",
            type: "Interview",
            title: "Interview with Sarah",
            content: "Sarah cannot find prior discovery notes.",
            sessionId: "session-1",
            createdAt: "2026-04-24T00:00:00.000Z",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const entries = await fetchResearchEntries("session", "session-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/express/api/research?sessionId=session-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    expect(entries[0]).toMatchObject({
      id: "research-1",
      type: "Interview",
      title: "Interview with Sarah",
      content: "Sarah cannot find prior discovery notes.",
      summary: "Sarah cannot find prior discovery notes.",
      session_id: "session-1",
      created_at: "2026-04-24T00:00:00.000Z",
    });
  });
});
