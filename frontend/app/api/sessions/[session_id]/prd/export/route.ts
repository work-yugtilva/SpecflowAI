import { NextRequest, NextResponse } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8001";

export async function GET(
  req: NextRequest,
  { params }: { params: { session_id: string } }
  ) {
  try {
    const authHeaders = await getRequiredAuthHeader();
    const res = await fetch(
      `${BACKEND_URL}/session/${params.session_id}/prd/export`,
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
