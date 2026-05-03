/**
 * PRODUCTION SETUP REQUIRED:
 * In Vercel → Project Settings → Environment Variables, set:
 *   NEXT_PUBLIC_PIPELINE_URL = https://<your-railway-app>.railway.app
 * Without this, all pipeline proxy routes return 503 on Vercel.
 */
import { NextResponse } from "next/server";

/**
 * FastAPI pipeline base URL for Next.js Route Handlers (Node server only).
 * On Vercel, set NEXT_PUBLIC_PIPELINE_URL or PIPELINE_SERVER_URL to the public
 * API origin (no trailing slash), e.g. https://api.specflowai.com
 */
export function getPipelineServerBaseUrl(): string {
  const a = process.env.PIPELINE_SERVER_URL?.trim();
  const b = process.env.NEXT_PUBLIC_PIPELINE_URL?.trim();
  const raw = (a || b || "").replace(/\/$/, "");
  return raw || "http://localhost:8000";
}

const VERCEL_DEPLOY =
  process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);

function isLocalPipelinePlaceholder(url: string): boolean {
  return (
    url === "http://localhost:8001" ||
    url.startsWith("http://localhost:") ||
    url.startsWith("http://127.0.0.1:")
  );
}

/** True when this function runs on Vercel but pipeline URL was never configured. */
export function isPipelineUrlMissingOnVercel(): boolean {
  if (!VERCEL_DEPLOY) return false;
  return isLocalPipelinePlaceholder(getPipelineServerBaseUrl());
}

export const PIPELINE_URL_MISSING_ON_VERCEL_MESSAGE =
  "Pipeline API URL is not configured for this deployment. In Vercel → Settings → Environment Variables, set NEXT_PUBLIC_PIPELINE_URL (or PIPELINE_SERVER_URL) to your FastAPI base URL (for example https://api.specflowai.com), then redeploy.";

export function pipelineServerMisconfiguredResponse(): NextResponse | null {
  if (!isPipelineUrlMissingOnVercel()) return null;
  return NextResponse.json(
    { error: PIPELINE_URL_MISSING_ON_VERCEL_MESSAGE },
    { status: 503 }
  );
}
