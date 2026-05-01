import { NextRequest, NextResponse } from "next/server";

const DISABLED_RESPONSE_BODY = {
  error: "Local pipeline is disabled. All pipeline execution routes through FastAPI.",
};

function disabledResponse() {
  return NextResponse.json(DISABLED_RESPONSE_BODY, { status: 501 });
}

export async function POST(_req: NextRequest) {
  if (process.env.VERCEL_ENV === "production") {
    console.warn("[/api/pipeline/run] Disabled local pipeline route reached in production.");
  }

  return disabledResponse();
}
