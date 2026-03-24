import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/sessions`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Backend service is offline. Please start the backend server." },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/session/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
