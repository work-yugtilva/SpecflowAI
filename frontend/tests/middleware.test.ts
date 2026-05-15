// @vitest-environment node

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isPublicMarketingPath } from "@/lib/is-public-marketing-path";
import { middleware } from "../middleware";

describe("isPublicMarketingPath", () => {
  it("treats landing and marketing sections as public", () => {
    expect(isPublicMarketingPath("/")).toBe(true);
    expect(isPublicMarketingPath("/pricing")).toBe(true);
    expect(isPublicMarketingPath("/pricing/team")).toBe(true);
    expect(isPublicMarketingPath("/opportunities")).toBe(true);
  });

  it("does not treat app or auth routes as public marketing", () => {
    expect(isPublicMarketingPath("/dashboard")).toBe(false);
    expect(isPublicMarketingPath("/login")).toBe(false);
    expect(isPublicMarketingPath("/api/health")).toBe(false);
  });
});

describe("middleware (context header only)", () => {
  it("forwards partial onboarding header for /context?onboarding=1", async () => {
    const request = new NextRequest("https://app.specflow.ai/context?onboarding=1");

    const response = await middleware(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("does not treat other paths specially (no redirect)", async () => {
    const request = new NextRequest("https://app.specflow.ai/context");

    const response = await middleware(request);

    expect(response.headers.get("location")).toBeNull();
  });
});
