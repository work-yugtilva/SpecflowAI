/**
 * Single resolution path for the Express API origin (browser + server).
 *
 * Order:
 * 1. EXPRESS_API_URL — server-only; preferred for Route Handlers / SSR so secrets stay off the client bundle.
 * 2. NEXT_PUBLIC_EXPRESS_API_URL → NEXT_PUBLIC_CONTEXT_API_URL
 * 3. NEXT_PUBLIC_BACKEND_URL — unless it looks like the FastAPI pipeline (:8000/:8001), then loopback Express.
 * 4. On deployed hosts (Vercel / Railway) or browser on a non-loopback host: EXPRESS_FALLBACK_ORIGIN /
 *    NEXT_PUBLIC_EXPRESS_FALLBACK_ORIGIN, then SpecFlow default https://context.specflowai.com.
 * 5. Otherwise loopback http://127.0.0.1:3001 for local dev.
 */

export type ExpressResolveRuntime = "browser" | "server";

const LOOPBACK_EXPRESS = "http://127.0.0.1:3001";

/** SpecFlow production default when no fallback env is set (forks override via *_FALLBACK_ORIGIN). */
export const SPECFLOW_DEFAULT_EXPRESS_ORIGIN = "https://context.specflowai.com";

export function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}

export function looksLikePipelinePort(base: string): boolean {
  try {
    const u = new URL(base);
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    return port === "8000" || port === "8001";
  } catch {
    return /:8000(\/|$)/i.test(base) || /:8001(\/|$)/i.test(base);
  }
}

function isLoopbackExpressOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1") return false;
    const port = u.port || (u.protocol === "http:" ? "80" : u.protocol === "https:" ? "443" : "");
    return port === "3001";
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1):3001(\/|$)/i.test(origin);
  }
}

function getConfiguredFallbackOrigin(): string {
  const explicit =
    process.env.NEXT_PUBLIC_EXPRESS_FALLBACK_ORIGIN?.trim() ||
    process.env.EXPRESS_FALLBACK_ORIGIN?.trim();
  if (explicit) return stripTrailingSlash(explicit);
  return SPECFLOW_DEFAULT_EXPRESS_ORIGIN;
}

function isDeployedServerRuntime(): boolean {
  // `vercel dev` sets VERCEL=1 — keep loopback Express for local hybrid dev.
  if (process.env.VERCEL === "1") {
    return process.env.VERCEL_ENV !== "development";
  }
  return Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PUBLIC_DOMAIN);
}

function browserHostname(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.hostname.toLowerCase();
}

function isBrowserOnRemoteHost(): boolean {
  const h = browserHostname();
  if (!h) return false;
  return h !== "localhost" && h !== "127.0.0.1";
}

function resolveFromExplicitEnv(runtime: ExpressResolveRuntime): string | null {
  if (runtime === "server") {
    const serverOnly = process.env.EXPRESS_API_URL?.trim();
    if (serverOnly) return stripTrailingSlash(serverOnly);
  }

  const dedicated =
    process.env.NEXT_PUBLIC_EXPRESS_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_CONTEXT_API_URL?.trim();
  if (dedicated) return stripTrailingSlash(dedicated);

  const backend = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").trim();
  if (!backend) return null;
  if (looksLikePipelinePort(backend)) {
    return LOOPBACK_EXPRESS;
  }
  return stripTrailingSlash(backend);
}

/**
 * Resolved HTTPS (or loopback) origin for Express — no `/api/express` proxy suffix.
 */
export function resolveExpressOrigin(runtime: ExpressResolveRuntime): string {
  const explicit = resolveFromExplicitEnv(runtime);
  if (explicit && !isLoopbackExpressOrigin(explicit)) {
    return explicit;
  }

  let candidate = explicit ?? LOOPBACK_EXPRESS;

  const needsFallback =
    isLoopbackExpressOrigin(candidate) &&
    (isDeployedServerRuntime() || (runtime === "browser" && isBrowserOnRemoteHost()));

  if (needsFallback) {
    candidate = getConfiguredFallbackOrigin();
  }

  return candidate;
}
