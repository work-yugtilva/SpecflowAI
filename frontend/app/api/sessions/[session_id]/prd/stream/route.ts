import { NextRequest } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";
import { proxySse } from "@/lib/server/proxy-sse";
import {
  getPipelineServerBaseUrl,
  pipelineServerMisconfiguredResponse,
} from "@/lib/server/pipeline-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  const mis = pipelineServerMisconfiguredResponse();
  if (mis) return mis;
  try {
    const authHeaders = await getRequiredAuthHeader();
    const body = await req.text();
    const jobId = new URL(req.url).searchParams.get("job_id");
    const base = getPipelineServerBaseUrl();
    const backendUrl = `${base}/session/${params.session_id}/prd/stream${jobId ? `?job_id=${encodeURIComponent(jobId)}` : ""}`;
    return await proxySse(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: body || undefined,
    });
  } catch (error) {
    if (isMissingAuthSessionError(error)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const message =
      error instanceof Error ? error.message : "Backend service is offline. Please start the backend server.";
    return new Response(JSON.stringify({ error: message }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
