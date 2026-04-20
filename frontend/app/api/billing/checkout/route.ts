import { NextRequest, NextResponse } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";
import {
  getPipelineServerBaseUrl,
  pipelineServerMisconfiguredResponse,
} from "@/lib/server/pipeline-server";

function proxyErrorMessage(error: unknown): string {
  if (error instanceof SyntaxError) {
    return (
      "Pipeline API returned a non-JSON response (often wrong URL or a proxy/HTML error page). " +
      "Confirm NEXT_PUBLIC_PIPELINE_URL on Vercel points to FastAPI, e.g. https://api.specflowai.com"
    );
  }
  return "Backend service is offline. Please start the backend server.";
}

export async function POST(req: NextRequest) {
  const mis = pipelineServerMisconfiguredResponse();
  if (mis) return mis;

  try {
    const body = await req.json();
    const authHeaders = await getRequiredAuthHeader();
    const base = getPipelineServerBaseUrl();
    const res = await fetch(`${base}/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    if (isMissingAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: proxyErrorMessage(error) }, { status: 503 });
  }
}
