import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8001";

export async function GET(
  _req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  try {
    const res = await fetch(`${BACKEND_URL}/session/${params.session_id}/prd`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
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
  try {
    const res = await fetch(`${BACKEND_URL}/session/${params.session_id}/prd`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Backend service is offline. Please start the backend server." },
      { status: 503 }
    );
  }
}
