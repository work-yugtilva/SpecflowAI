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

export function getExpressApiBase(): string {
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

  return "http://localhost:3001";
}
