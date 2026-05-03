import { describe, expect, it } from "vitest";

import {
  SPECFLOW_DEFAULT_EXPRESS_ORIGIN,
  resolveExpressOrigin,
  stripTrailingSlash,
} from "@/lib/api/express-origin";

const KEYS = [
  "EXPRESS_API_URL",
  "EXPRESS_FALLBACK_ORIGIN",
  "NEXT_PUBLIC_EXPRESS_API_URL",
  "NEXT_PUBLIC_CONTEXT_API_URL",
  "NEXT_PUBLIC_BACKEND_URL",
  "NEXT_PUBLIC_EXPRESS_FALLBACK_ORIGIN",
  "VERCEL",
  "VERCEL_ENV",
  "RAILWAY_ENVIRONMENT",
  "RAILWAY_PUBLIC_DOMAIN",
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of KEYS) out[k] = process.env[k];
  return out;
}

function restoreEnv(saved: Record<string, string | undefined>) {
  for (const k of KEYS) {
    const v = saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("express-origin", () => {
  describe("resolveExpressOrigin", () => {
    it("server: EXPRESS_API_URL overrides NEXT_PUBLIC_*", () => {
      const snap = snapshotEnv();
      try {
        for (const k of KEYS) delete process.env[k];
        process.env.EXPRESS_API_URL = "https://express-server.example";
        process.env.NEXT_PUBLIC_EXPRESS_API_URL = "https://wrong.example";
        expect(resolveExpressOrigin("server")).toBe("https://express-server.example");
      } finally {
        restoreEnv(snap);
      }
    });

    it("browser: ignores EXPRESS_API_URL (not available on client bundle anyway)", () => {
      const snap = snapshotEnv();
      try {
        for (const k of KEYS) delete process.env[k];
        process.env.EXPRESS_API_URL = "https://express-server.example";
        process.env.NEXT_PUBLIC_EXPRESS_API_URL = "https://client-visible.example";
        expect(resolveExpressOrigin("browser")).toBe("https://client-visible.example");
      } finally {
        restoreEnv(snap);
      }
    });

    it("uses fallback on Vercel production when still on loopback Express", () => {
      const snap = snapshotEnv();
      try {
        for (const k of KEYS) delete process.env[k];
        process.env.VERCEL = "1";
        process.env.VERCEL_ENV = "production";
        expect(resolveExpressOrigin("server")).toBe(SPECFLOW_DEFAULT_EXPRESS_ORIGIN);
      } finally {
        restoreEnv(snap);
      }
    });

    it("does not use Vercel fallback when VERCEL_ENV is development (vercel dev)", () => {
      const snap = snapshotEnv();
      try {
        for (const k of KEYS) delete process.env[k];
        process.env.VERCEL = "1";
        process.env.VERCEL_ENV = "development";
        expect(resolveExpressOrigin("server")).toBe("http://127.0.0.1:3001");
      } finally {
        restoreEnv(snap);
      }
    });

    it("Railway: uses fallback when deployed", () => {
      const snap = snapshotEnv();
      try {
        for (const k of KEYS) delete process.env[k];
        process.env.RAILWAY_ENVIRONMENT = "production";
        expect(resolveExpressOrigin("server")).toBe(SPECFLOW_DEFAULT_EXPRESS_ORIGIN);
      } finally {
        restoreEnv(snap);
      }
    });

    it("respects NEXT_PUBLIC_EXPRESS_FALLBACK_ORIGIN over default", () => {
      const snap = snapshotEnv();
      try {
        for (const k of KEYS) delete process.env[k];
        process.env.VERCEL = "1";
        process.env.VERCEL_ENV = "production";
        process.env.NEXT_PUBLIC_EXPRESS_FALLBACK_ORIGIN = "https://custom-fallback.example";
        expect(resolveExpressOrigin("server")).toBe("https://custom-fallback.example");
      } finally {
        restoreEnv(snap);
      }
    });
  });

  describe("stripTrailingSlash", () => {
    it("removes one trailing slash", () => {
      expect(stripTrailingSlash("https://a.example/api/")).toBe("https://a.example/api");
    });
  });
});
