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

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mockGetRequiredAuthHeader.mockResolvedValue({ Authorization: "Bearer jwt-token" });
    mockIsMissingAuthSessionError.mockReturnValue(false);
    mockPipelineServerMisconfiguredResponse.mockReturnValue(null);
    mockGetPipelineServerBaseUrl.mockReturnValue("https://api.specflow.ai");
  });

  it("forwards auth and request body to FastAPI", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ url: "https://checkout.stripe.com/session" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const request = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({
        plan: "pro",
        success_url: "http://localhost:3000/dashboard?upgraded=true",
        cancel_url: "http://localhost:3000/pricing",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBe("https://checkout.stripe.com/session");
    expect(mockFetch).toHaveBeenCalledWith("https://api.specflow.ai/billing/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer jwt-token",
      },
      body: JSON.stringify({
        plan: "pro",
        success_url: "http://localhost:3000/dashboard?upgraded=true",
        cancel_url: "http://localhost:3000/pricing",
      }),
    });
  });

  it("preserves upstream error payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 400,
        json: () => Promise.resolve({ error: "Unsupported plan" }),
      })
    );

    const request = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({
        plan: "enterprise",
        success_url: "http://localhost:3000/dashboard?upgraded=true",
        cancel_url: "http://localhost:3000/pricing",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unsupported plan" });
  });
});
