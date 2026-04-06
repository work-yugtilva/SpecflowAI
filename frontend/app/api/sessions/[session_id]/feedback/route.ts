import { appendFileSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8001";

const DEBUG_LOG_PATH =
  "/Users/yug/Desktop/SpecFlow/.cursor/debug-a195e9.log";

export async function GET(
  _req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  try {
    const authHeaders = await getRequiredAuthHeader();
    const res = await fetch(`${BACKEND_URL}/session/${params.session_id}/feedback`, {
      headers: authHeaders,
    });
    const data = await res.json();
    // #region agent log
    try {
      const entries = (data as { entries?: unknown }).entries;
      appendFileSync(
        DEBUG_LOG_PATH,
        `${JSON.stringify({
          sessionId: "a195e9",
          hypothesisId: "H-proxy",
          location: "feedback/route.ts:GET",
          message: "feedback proxy response",
          data: {
            httpStatus: res.status,
            entriesIsArray: Array.isArray(entries),
            entryCount: Array.isArray(entries) ? entries.length : null,
            sessionTail: params.session_id.slice(-8),
          },
          timestamp: Date.now(),
        })}\n`
      );
    } catch {
      /* debug log write failed */
    }
    // #endregion
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
  try {
    const body = await req.json();
    const authHeaders = await getRequiredAuthHeader();
    const res = await fetch(`${BACKEND_URL}/session/${params.session_id}/feedback`, {
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
