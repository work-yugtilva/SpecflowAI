import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetRequiredAuthHeader = vi.fn();
const mockIsMissingAuthSessionError = vi.fn();
const mockPipelineServerMisconfiguredResponse = vi.fn();
const mockGetPipelineServerBaseUrl = vi.fn();

vi.mock("@/lib/supabase/get-auth-header", () => ({
  getRequiredAuthHeader: mockGetRequiredAuthHeader,
  isMissingAuthSessionError: mockIsMissingAuthSessionError,
}));

vi.mock("@/lib/server/pipeline-server", () => ({
  pipelineServerMisconfiguredResponse: mockPipelineServerMisconfiguredResponse,
  getPipelineServerBaseUrl: mockGetPipelineServerBaseUrl,
}));

const { POST } = await import("./route");

describe("POST /api/sessions/[session_id]/run/async", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockGetRequiredAuthHeader.mockResolvedValue({ Authorization: "Bearer jwt-token" });
    mockIsMissingAuthSessionError.mockReturnValue(false);
    mockPipelineServerMisconfiguredResponse.mockReturnValue(null);
    mockGetPipelineServerBaseUrl.mockReturnValue("https://api.specflow.ai");
  });

  it("returns 422 NO_EVIDENCE without starting the pipeline when input has no sources or research", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const request = new Request(
      "http://localhost:3000/api/sessions/session-1/run/async",
      {
        method: "POST",
        body: JSON.stringify({
          input_data: { context: {}, ingest: [], research: [] },
          step: "problems",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await POST(request as never, {
      params: { session_id: "session-1" },
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      code: "NO_EVIDENCE",
      message: "Upload at least one source document before running the pipeline.",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("forwards the async run when research evidence exists", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 202,
      json: () => Promise.resolve({ job_id: "job-1", status: "queued" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const request = new Request(
      "http://localhost:3000/api/sessions/session-1/run/async",
      {
        method: "POST",
        body: JSON.stringify({
          input_data: { context: {}, ingest: [], research: [{ id: "r1" }] },
          step: "problems",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await POST(request as never, {
      params: { session_id: "session-1" },
    });

    expect(response.status).toBe(202);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.specflow.ai/session/session-1/run/async",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("allows downstream step runs to rely on persisted session memory", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 202,
      json: () => Promise.resolve({ job_id: "job-2", status: "queued" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const request = new Request(
      "http://localhost:3000/api/sessions/session-1/run/async",
      {
        method: "POST",
        body: JSON.stringify({
          input_data: { context: {}, ingest: [], research: [] },
          step: "features",
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await POST(request as never, {
      params: { session_id: "session-1" },
    });

    expect(response.status).toBe(202);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.specflow.ai/session/session-1/run/async",
      expect.objectContaining({ method: "POST" })
    );
  });
});
