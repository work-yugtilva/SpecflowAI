import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (hoisted by Vitest) ───────────────────────────────────────────────

const mockExchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  }),
}));

// ─── Route under test ────────────────────────────────────────────────────────

const { GET } = await import("./route");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /auth/callback", () => {
  beforeEach(() => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null, data: {} });
  });

  it("redirects to /dashboard after successful code exchange", async () => {
    const req = new Request("http://localhost:3000/auth/callback?code=valid-code");
    const response = await GET(req);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("redirects to /login when no code is present", async () => {
    const req = new Request("http://localhost:3000/auth/callback");
    const response = await GET(req);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("redirects to /login with error param when exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      error: { message: "invalid_grant" },
      data: null,
    });

    const req = new Request("http://localhost:3000/auth/callback?code=bad-code");
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("error=auth_callback_failed");
  });

  it("respects custom next param on success", async () => {
    const req = new Request(
      "http://localhost:3000/auth/callback?code=valid-code&next=/onboarding"
    );
    const response = await GET(req);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/onboarding");
  });
});
