import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PARTIAL_ONBOARDING_HEADER = "x-specflow-allow-partial-onboarding";

/**
 * Only forward a request header for /context?onboarding=1 so the workspace layout
 * can skip the onboarding DB gate. No Supabase, no cookie scans — avoids Edge
 * MIDDLEWARE_INVOCATION_TIMEOUT on high-traffic matchers like /api.
 *
 * Auth and onboarding enforcement: Server Component layouts (Node runtime).
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/context" && searchParams.get("onboarding") === "1") {
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set(PARTIAL_ONBOARDING_HEADER, "1");
    return NextResponse.next({ request: { headers: reqHeaders } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/context/:path*"],
};
