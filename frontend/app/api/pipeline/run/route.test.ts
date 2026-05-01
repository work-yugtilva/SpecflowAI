import { afterEach, describe, expect, it, vi } from "vitest";

const DISABLED_BODY = {
  error: "Local pipeline is disabled. All pipeline execution routes through FastAPI.",
};

async function loadRoute() {
  vi.resetModules();
  return await import("./route");
}

describe("POST /api/pipeline/run", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 501 because local pipeline execution is disabled", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { POST } = await loadRoute();

    const response = await POST(
      new Request("http://localhost:3000/api/pipeline/run", { method: "POST" }) as never
    );

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual(DISABLED_BODY);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs a warning and returns 501 if reached in Vercel production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { POST } = await loadRoute();

    const response = await POST(
      new Request("https://app.specflow.ai/api/pipeline/run", { method: "POST" }) as never
    );

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual(DISABLED_BODY);
    expect(warn).toHaveBeenCalledWith(
      "[/api/pipeline/run] Disabled local pipeline route reached in production."
    );
  });
});
