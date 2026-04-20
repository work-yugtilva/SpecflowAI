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

describe("POST /api/billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockGetRequiredAuthHeader.mockResolvedValue({ Authorization: "Bearer jwt-token" });
    mockIsMissingAuthSessionError.mockReturnValue(false);
    mockPipelineServerMisconfiguredResponse.mockReturnValue(null);
    mockGetPipelineServerBaseUrl.mockReturnValue("https://api.specflow.ai");
  });

  it("forwards auth and a server-generated return_url", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ url: "https://billing.stripe.com/session" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const request = new Request("https://app.specflow.ai/api/billing/portal", {
      method: "POST",
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBe("https://billing.stripe.com/session");
    expect(mockFetch).toHaveBeenCalledWith("https://api.specflow.ai/billing/portal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer jwt-token",
      },
      body: JSON.stringify({
        return_url: "https://app.specflow.ai/settings/billing",
      }),
    });
  });

  it("preserves upstream error payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 404,
        json: () => Promise.resolve({ error: "No billing account found" }),
      })
    );

    const request = new Request("https://app.specflow.ai/api/billing/portal", {
      method: "POST",
    });

    const response = await POST(request as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "No billing account found" });
  });
});
