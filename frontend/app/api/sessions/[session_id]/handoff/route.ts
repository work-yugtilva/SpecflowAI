import { NextRequest, NextResponse } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8001";

export async function GET(
  _req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  try {
    const authHeaders = await getRequiredAuthHeader();
    const res = await fetch(`${BACKEND_URL}/session/${params.session_id}/handoff`, {
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
  _req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  try {
    const authHeaders = await getRequiredAuthHeader();
    const res = await fetch(
      `${BACKEND_URL}/session/${params.session_id}/agent_handoff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
      }
    );
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json(
        { detail: "Pipeline returned non-JSON" },
        { status: 502 }
      );
    }
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
