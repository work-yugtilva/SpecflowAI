import { NextRequest } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";
import { proxySse } from "@/lib/server/proxy-sse";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8001";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { session_id: string; job_id: string } }
) {
  try {
    const authHeaders = await getRequiredAuthHeader();
    return await proxySse(
      `${BACKEND_URL}/session/${params.session_id}/run/stream/${params.job_id}`,
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
