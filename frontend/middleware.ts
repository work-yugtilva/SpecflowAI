import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from "@/lib/supabase/env";

const PROTECTED_PATHS = [
  "/dashboard",
  "/problems",
  "/features",
  "/decompose",
  "/tasks",
  "/context",
  "/sources",
  "/onboarding",
  "/sessions",
  "/settings",
  "/prd",
];

const ONBOARDING_COMPLETE_COOKIE = "specflow_onboarding_complete";

/** Marketing and other routes that never need session refresh or auth redirects. */
export function isPublicMarketingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/pricing")) return true;
  if (pathname.startsWith("/opportunities")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicMarketingPath(pathname)) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    resolveSupabaseUrl(),
    resolveSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — required for SSR auth to work
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // e.g. dev defaults but no `supabase start` — treat as signed out
    user = null;
  }

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isLoginPage = pathname === "/login";
  const isProductContextOnboardingStep =
    pathname === "/context" && request.nextUrl.searchParams.get("onboarding") === "1";
  const hasOnboardingCompleteCookie =
    request.cookies.get(ONBOARDING_COMPLETE_COOKIE)?.value === "1";

  // Unauthenticated → redirect to /login
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user visiting /login → redirect to /dashboard
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Authenticated user on a protected path who hasn't finished onboarding → redirect
  if (user && isProtected && !pathname.startsWith("/onboarding") && !isProductContextOnboardingStep) {
    try {
      const { data } = await supabase
        .from("user_profiles")
        .select("onboarding_completed_at")
        .eq("user_id", user.id)
        .single();
      if ((!data || data.onboarding_completed_at === null) && !hasOnboardingCompleteCookie) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }
    } catch {
      // fail open — network error should not redirect-loop the user
    }
  }

  return supabaseResponse;
}

// Must be a static array (Next.js analyzes it at build time; no variables/spread).
// Keep path prefixes aligned with PROTECTED_PATHS plus /login and /api.
export const config = {
  matcher: [
    "/login",
    "/api/:path*",
    "/dashboard/:path*",
    "/problems/:path*",
    "/features/:path*",
    "/decompose/:path*",
    "/tasks/:path*",
    "/context/:path*",
    "/sources/:path*",
    "/onboarding/:path*",
    "/sessions/:path*",
    "/settings/:path*",
    "/prd/:path*",
  ],
};
