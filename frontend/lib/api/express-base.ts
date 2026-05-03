/**
 * Base URL for the Node/Express API (`/api/context`, `/api/research`, etc.).
 * The Python FastAPI pipeline uses NEXT_PUBLIC_PIPELINE_URL — it has no /api/context
 * and returns {"detail":"Not Found"} if those routes are called there by mistake.
 */

import { resolveExpressOrigin } from "@/lib/api/express-origin";

export function getExpressApiBase(): string {
  const runtime = typeof window !== "undefined" ? "browser" : "server";
  const base = resolveExpressOrigin(runtime);

  // In the browser, never call loopback as the Express host (breaks production when
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
