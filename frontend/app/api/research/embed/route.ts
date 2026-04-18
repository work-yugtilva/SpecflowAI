import { NextRequest, NextResponse } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";
import {
  getPipelineServerBaseUrl,
  pipelineServerMisconfiguredResponse,
} from "@/lib/server/pipeline-server";

export async function POST(req: NextRequest) {
  const mis = pipelineServerMisconfiguredResponse();
  if (mis) return mis;
  try {
    const body = await req.json();
    const authHeaders = await getRequiredAuthHeader();
    const base = getPipelineServerBaseUrl();
    const res = await fetch(`${base}/research/embed`, {
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
    console.error("[research/embed] bridge error:", error);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
