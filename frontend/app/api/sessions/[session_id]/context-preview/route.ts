import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
const PIPELINE_URL =
  process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";  // fixed: was 8001

export async function GET(
  req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  const sessionId = params.session_id;

  const fwdHeaders: Record<string, string> = {};
  const cookie = req.headers.get("cookie");
  const auth = req.headers.get("authorization");
  if (cookie) fwdHeaders["cookie"] = cookie;
  if (auth) fwdHeaders["authorization"] = auth;

  // 1. Merged context — TypeScript backend (only home for /api/context/merged)
  let context: {
    global: unknown;
    session: unknown;
    merged: Record<string, unknown>;
  } = { global: null, session: null, merged: {} };
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/context/merged?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: fwdHeaders }
    );
    if (res.ok) {
      const payload = await res.json();
      if (payload.success && payload.data) context = payload.data;
    }
  } catch {}

  // 2. Memory keys — Python backend session state outputs
  let memory_keys: string[] = [];
  try {
    const res = await fetch(
      `${PIPELINE_URL}/session/${encodeURIComponent(sessionId)}`,
      { headers: fwdHeaders }
    );
    if (res.ok) {
      const payload = await res.json();
      const outputs = payload?.state?.outputs ?? {};
      memory_keys = Object.keys(outputs).filter(Boolean);
    }
  } catch {}

  // 3. Readiness: all 4 gate conditions must be met
  const merged = context.merged ?? {};
  const ready = !!(
    merged.companyName && String(merged.companyName).trim() &&
    merged.productName && String(merged.productName).trim() &&
    merged.productDescription && String(merged.productDescription).trim() &&
    merged.ingest && Array.isArray(merged.ingest) && (merged.ingest as unknown[]).length > 0
  );

  return NextResponse.json({ context, memory_keys, ready });
}
