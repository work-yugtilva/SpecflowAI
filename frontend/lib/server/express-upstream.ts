/**
 * Resolve the Express API origin for server-side calls (e.g. Next.js route handlers
 * that proxy browser traffic). Prefer server-only EXPRESS_API_URL on Vercel so
 * the browser can use same-origin `/api/express/*` without exposing a second public URL.
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

const SPECFLOW_PRODUCTION_EXPRESS_ORIGIN = "https://context.specflowai.com";

function resolveSpecflowUpstreamFromSiteEnv(): string | null {
  const site = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!site) return null;
  try {
    const host = new URL(site).hostname;
    if (host === "specflowai.com" || host === "www.specflowai.com") {
      return SPECFLOW_PRODUCTION_EXPRESS_ORIGIN;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Resolved Express origin for server-side proxy calls. Defaults to localhost for local dev.
 */
export function resolveExpressUpstreamBase(): string {
  const serverOnly = process.env.EXPRESS_API_URL?.trim();
  if (serverOnly) return stripTrailingSlash(serverOnly);

  const dedicated =
    process.env.NEXT_PUBLIC_EXPRESS_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_CONTEXT_API_URL?.trim();
  if (dedicated) return stripTrailingSlash(dedicated);

  const backend = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").trim();
  if (backend) {
    if (looksLikePipelinePort(backend)) {
      return "http://127.0.0.1:3001";
    }
    return stripTrailingSlash(backend);
  }

  const specflow = resolveSpecflowUpstreamFromSiteEnv();
  if (specflow) return specflow;

  return "http://127.0.0.1:3001";
}
