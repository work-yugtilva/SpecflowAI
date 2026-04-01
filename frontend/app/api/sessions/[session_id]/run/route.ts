import { NextRequest, NextResponse } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8001";

export async function POST(
  req: NextRequest,
  { params }: { params: { session_id: string } }
  ) {
  try {
    const body = await req.json();
    const authHeaders = await getRequiredAuthHeader();
    const res = await fetch(`${BACKEND_URL}/session/${params.session_id}/run`, {
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
    return NextResponse.json(
      { error: "Backend service is offline. Please start the backend server." },
      { status: 503 }
    );
  }
}
