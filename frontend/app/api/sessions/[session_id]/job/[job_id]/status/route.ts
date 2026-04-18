import { NextRequest } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";
import {
  getPipelineServerBaseUrl,
  pipelineServerMisconfiguredResponse,
} from "@/lib/server/pipeline-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { session_id: string; job_id: string } }
) {
  const mis = pipelineServerMisconfiguredResponse();
  if (mis) return mis;
  try {
    const authHeaders = await getRequiredAuthHeader();
    const base = getPipelineServerBaseUrl();
    const res = await fetch(
      `${base}/session/${params.session_id}/job/${params.job_id}/status`,
      { headers: authHeaders }
    );
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (error) {
    if (isMissingAuthSessionError(error)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Backend service is offline.";
    return Response.json({ error: message }, { status: 503 });
  }
}
