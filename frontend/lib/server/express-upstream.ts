/**
 * Express origin for Next.js Route Handlers (e.g. `/api/express/*` proxy).
 * Uses the same rules as the browser via {@link resolveExpressOrigin}, but prefers
 * server-only `EXPRESS_API_URL` when set.
 */

import { resolveExpressOrigin } from "@/lib/api/express-origin";

export function resolveExpressUpstreamBase(): string {
  return resolveExpressOrigin("server");
}
