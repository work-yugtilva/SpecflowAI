import { NextRequest } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8001";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { session_id: string; job_id: string } }
) {
  try {
    const authHeaders = await getRequiredAuthHeader();
    const res = await fetch(
      `${BACKEND_URL}/session/${params.session_id}/job/${params.job_id}/status`,
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
