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
/** Allow long pipeline steps without the route cutting off the SSE proxy (e.g. Vercel). */
export const maxDuration = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: { session_id: string; job_id: string } }
) {
  const mis = pipelineServerMisconfiguredResponse();
  if (mis) return mis;
  try {
    const authHeaders = await getRequiredAuthHeader();
    const base = getPipelineServerBaseUrl();
    return await proxySse(
      `${base}/session/${params.session_id}/run/stream/${params.job_id}`,
      {
        headers: authHeaders,
      }
    );
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
