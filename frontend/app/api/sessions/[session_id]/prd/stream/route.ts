import { NextRequest } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8001";

export async function POST(
  req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  const upstream = await fetch(
    `${BACKEND_URL}/session/${params.session_id}/prd/stream`,
    { method: "POST", headers: { "Content-Type": "application/json" } }
  );
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
