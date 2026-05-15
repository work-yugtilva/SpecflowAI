import { NextRequest, NextResponse } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";
import {
  getPipelineServerBaseUrl,
  pipelineServerMisconfiguredResponse,
} from "@/lib/server/pipeline-server";
import {
  hasPipelineEvidence,
  NO_EVIDENCE_CODE,
  NO_EVIDENCE_HTTP_MESSAGE,
} from "@/lib/pipeline-evidence";

export async function POST(
  req: NextRequest,
  { params }: { params: { session_id: string } }
  ) {
  const mis = pipelineServerMisconfiguredResponse();
  if (mis) return mis;
  try {
    const body = await req.json();
    const step = typeof body?.step === "string" ? body.step : undefined;
    if (
      (!step || step === "problems") &&
      !hasPipelineEvidence((body?.input_data ?? {}) as Record<string, unknown>)
    ) {
      return NextResponse.json(
        { code: NO_EVIDENCE_CODE, message: NO_EVIDENCE_HTTP_MESSAGE },
        { status: 422 }
      );
    }
    const authHeaders = await getRequiredAuthHeader();
    const base = getPipelineServerBaseUrl();
    const res = await fetch(
      `${base}/session/${params.session_id}/run/async`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    if (isMissingAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Backend service is offline. Please start the backend server." },
      { status: 503 }
    );
  }
}
