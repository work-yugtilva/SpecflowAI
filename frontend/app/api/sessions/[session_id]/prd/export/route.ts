import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/session/${params.session_id}/prd/export`
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
  } catch {
    return NextResponse.json(
      { error: "Backend service is offline. Please start the backend server." },
      { status: 503 }
    );
  }
}
