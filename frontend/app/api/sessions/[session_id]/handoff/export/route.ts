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
  req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  const mis = pipelineServerMisconfiguredResponse();
  if (mis) return mis;
  try {
    const authHeaders = await getRequiredAuthHeader();
    const format = req.nextUrl.searchParams.get("format") ?? "claude_md";
    const base = getPipelineServerBaseUrl();
    const res = await fetch(
      `${base}/session/${params.session_id}/agent_handoff/export?format=${format}`,
      { headers: authHeaders }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      return NextResponse.json(data, { status: res.status });
    }
    const text = await res.text();
    const contentType = res.headers.get("Content-Type") ?? "text/markdown";
    const disposition =
      res.headers.get("Content-Disposition") ?? 'attachment; filename="CLAUDE.md"';
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": contentType, "Content-Disposition": disposition },
    });
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
