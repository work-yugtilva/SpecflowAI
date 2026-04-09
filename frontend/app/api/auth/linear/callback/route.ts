import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertUserIntegration } from "@/lib/server/user-integrations";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${origin}/tasks?error=linear_auth_denied`);
  }

  // Verify CSRF state
  const storedState = request.cookies.get("linear_oauth_state")?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${origin}/tasks?error=linear_state_mismatch`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/tasks?error=linear_missing_code`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${origin}/tasks?error=linear_client_not_configured`
    );
  }

  const redirectUri = `${origin}/api/auth/linear/callback`;
  const tokenRes = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${origin}/tasks?error=linear_token_exchange_failed`
    );
  }

  const { access_token, ...workspaceInfo } = (await tokenRes.json()) as {
    access_token: string;
    [key: string]: unknown;
  };

  try {
    await upsertUserIntegration({
      userId: user.id,
      provider: "linear",
      accessToken: access_token,
      workspaceInfo,
    });
  } catch {
    return NextResponse.redirect(`${origin}/tasks?error=linear_save_failed`);
  }

  const response = NextResponse.redirect(`${origin}/tasks?linear=connected`);
  response.cookies.set("linear_oauth_state", "", { maxAge: 0, path: "/" });
  return response;
}
