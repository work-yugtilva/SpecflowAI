import type { NextRequest } from "next/server";

/**
 * Base URL for OAuth redirect_uri (must match Slack app settings exactly).
 * Set NEXT_PUBLIC_APP_URL when the request Host does not match your registered redirect
 * (e.g. some proxies, or forcing prod URL in previews).
 */
export function getOAuthAppOrigin(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}

export function slackOAuthRedirectUri(request: NextRequest): string {
  return `${getOAuthAppOrigin(request)}/api/auth/slack/callback`;
}
