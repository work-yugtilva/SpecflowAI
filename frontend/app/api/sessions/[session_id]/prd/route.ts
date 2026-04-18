import { NextRequest, NextResponse } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";
import {
  getPipelineServerBaseUrl,
  pipelineServerMisconfiguredResponse,
} from "@/lib/server/pipeline-server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { session_id: string } }
  ) {
  const mis = pipelineServerMisconfiguredResponse();
  if (mis) return mis;
  try {
    const authHeaders = await getRequiredAuthHeader();
    const base = getPipelineServerBaseUrl();
    const res = await fetch(`${base}/session/${params.session_id}/prd`, {
      headers: authHeaders,
    });
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

export async function POST(
  req: NextRequest,
  { params }: { params: { session_id: string } }
  ) {
  const mis = pipelineServerMisconfiguredResponse();
  if (mis) return mis;
  try {
    const authHeaders = await getRequiredAuthHeader();
    const base = getPipelineServerBaseUrl();
    const res = await fetch(`${base}/session/${params.session_id}/prd`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
    });
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
