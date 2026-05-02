// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const singleMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: (...args: unknown[]) => singleMock(...args),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  resolveSupabaseAnonKey: () => "anon-key",
  resolveSupabaseUrl: () => "https://example.supabase.co",
}));

const { middleware } = await import("../middleware");

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  singleMock.mockResolvedValue({ data: null, error: null });
});

describe("middleware onboarding gate", () => {
  it("still sends unauthenticated product context onboarding requests to login", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const request = new NextRequest("https://app.specflow.ai/context?onboarding=1");

    const response = await middleware(request);

    expect(response.headers.get("location")).toBe("https://app.specflow.ai/login?onboarding=1");
  });

  it("allows the product context onboarding step before the profile reads as completed", async () => {
    const request = new NextRequest("https://app.specflow.ai/context?onboarding=1");

    const response = await middleware(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("continues to gate other protected pages until onboarding is complete", async () => {
    const request = new NextRequest("https://app.specflow.ai/dashboard");

    const response = await middleware(request);

    expect(response.headers.get("location")).toBe("https://app.specflow.ai/onboarding");
  });
});
