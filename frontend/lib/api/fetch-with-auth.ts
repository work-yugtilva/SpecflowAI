/**
 * fetch-with-auth.ts
 *
 * A fetch wrapper for client-side calls that attach a Supabase Bearer token.
 * On 401 responses it attempts a session refresh once; if that also fails it
 * shows a notification and redirects the user to /login.
 *
 * Usage (drop-in for the existing withAuth + fetch pattern):
 *
 *   import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
 *
 *   const res = await fetchWithAuth(url, { method: "POST", body: ... });
 *
 * The wrapper is intentionally minimal — it only handles the auth lifecycle.
 * Response parsing is left to the caller, exactly as in the existing API files.
 */

import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function buildInit(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return { ...init, headers };
}

/**
 * Notify the user that their session expired and redirect to /login.
 *
 * No toast library is installed in this project, so we use window.alert as
 * specified. If a toast library is added in the future, replace the
 * window.alert call here — it is the single location that needs changing.
 */
function notifyAndRedirect(): void {
  // Guard: only run in browser environments
  if (typeof window === "undefined") return;
  window.alert("Your session expired — please log in again");
  window.location.href = "/login";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for `fetch` for client-side API calls that require a
 * Supabase auth token.
 *
 * Flow:
 *  1. Attach the current access token as an Authorization header.
 *  2. Make the request.
 *  3. If the response is 401, attempt `supabase.auth.refreshSession()` once.
 *     a. If refresh succeeds, retry the original request with the new token.
 *     b. If refresh fails, alert the user and redirect to /login.
 *  4. Return the final Response to the caller (success or non-401 error).
 *
 * The function never throws on HTTP error statuses — that is the caller's
 * responsibility, consistent with the existing handleResponse() pattern in
 * context.ts / research.ts / sources.ts.
 */
export async function fetchWithAuth(
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  const firstResponse = await fetch(input, buildInit(init, token));

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  // 401 — attempt a token refresh
  if (typeof window === "undefined") {
    // Server context: cannot refresh interactively; return the 401 as-is.
    return firstResponse;
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session) {
    notifyAndRedirect();
    // Return the original 401 so any awaiting caller can clean up if needed.
    return firstResponse;
  }

  // Refresh succeeded — retry once with the new token
  const newToken = data.session.access_token;
  return fetch(input, buildInit(init, newToken));
}

// ---------------------------------------------------------------------------
// Convenience: withAuth helper matching the pattern in context.ts / research.ts
// ---------------------------------------------------------------------------

/**
 * Builds a RequestInit with the current Bearer token injected.
 * Mirrors the local `withAuth()` helpers in context.ts / research.ts / sources.ts
 * so callers can share a single implementation.
 *
 * Unlike fetchWithAuth, this does NOT handle 401 refresh — it is a plain
 * header-injection helper for callers that construct the RequestInit
 * separately from calling fetch.
 */
export async function withAuthHeaders(init: RequestInit = {}): Promise<RequestInit> {
  const token = await getAccessToken();
  return buildInit(init, token);
}
