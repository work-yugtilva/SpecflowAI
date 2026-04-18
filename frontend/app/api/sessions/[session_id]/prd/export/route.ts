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
    const view = req.nextUrl.searchParams.get("view") ?? "full";
    const base = getPipelineServerBaseUrl();
    const res = await fetch(
      `${base}/session/${params.session_id}/prd/export?view=${view}`,
      { headers: authHeaders }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      return NextResponse.json(data, { status: res.status });
    }
    const md = await res.text();
    const disposition = res.headers.get("Content-Disposition") ?? `attachment; filename="prd.md"`;
    return new NextResponse(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": disposition,
      },
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
