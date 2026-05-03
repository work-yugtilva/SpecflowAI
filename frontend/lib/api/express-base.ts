/**
 * Base URL for the Node/Express API (`/api/context`, `/api/research`, etc.).
 * The Python FastAPI pipeline uses NEXT_PUBLIC_PIPELINE_URL — it has no /api/context
 * and returns {"detail":"Not Found"} if those routes are called there by mistake.
 */

function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}

function looksLikePipelinePort(base: string): boolean {
  try {
    const u = new URL(base);
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    return port === "8000" || port === "8001";
  } catch {
    return /:8000(\/|$)/i.test(base) || /:8001(\/|$)/i.test(base);
  }
}

/** Production Express deployment for https://specflowai.com (when env vars are unset). */
const SPECFLOW_PRODUCTION_EXPRESS_ORIGIN = "https://context.specflowai.com";

function isSpecflowProductionWebHost(hostname: string): boolean {
  return hostname === "specflowai.com" || hostname === "www.specflowai.com";
}

function resolveExpressApiBase(): string {
  const dedicated =
    process.env.NEXT_PUBLIC_EXPRESS_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_CONTEXT_API_URL?.trim();
  if (dedicated) return stripTrailingSlash(dedicated);

  const backend = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").trim();
  if (backend) {
    if (looksLikePipelinePort(backend)) {
      return "http://localhost:3001";
    }
    return stripTrailingSlash(backend);
  }

  if (typeof window !== "undefined" && isSpecflowProductionWebHost(window.location.hostname)) {
    return SPECFLOW_PRODUCTION_EXPRESS_ORIGIN;
  }

  return "http://localhost:3001";
}

export function getExpressApiBase(): string {
  const base = resolveExpressApiBase();
  // In the browser, never call localhost as the Express host (breaks production when
  // Express env vars were not inlined at build). Same-origin `/api/express` proxy
  // also avoids CORS to a separate Express deployment.
  if (typeof window !== "undefined") {
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base);
    if (isLocalhost) {
      return "/api/express";
    }
  }

  return base;
}
