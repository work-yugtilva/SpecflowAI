import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertUserIntegration } from "@/lib/server/user-integrations";
import {
  getOAuthAppOrigin,
  slackOAuthRedirectUri,
} from "@/lib/oauth-app-origin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = getOAuthAppOrigin(request);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/settings/integrations?error=slack_auth_denied`
    );
  }

  // Verify CSRF state
  const storedState = request.cookies.get("slack_oauth_state")?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      `${origin}/settings/integrations?error=slack_state_mismatch`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/settings/integrations?error=slack_missing_code`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${origin}/settings/integrations?error=slack_client_not_configured`
    );
  }

  const redirectUri = slackOAuthRedirectUri(request);
  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${origin}/settings/integrations?error=slack_token_exchange_failed`
    );
  }

  const tokenData = (await tokenRes.json()) as {
    ok: boolean;
    access_token?: string;
    bot_user_id?: string;
    app_id?: string;
    team?: { id: string; name: string };
    error?: string;
  };

  if (!tokenData.ok || !tokenData.access_token) {
    return NextResponse.redirect(
      `${origin}/settings/integrations?error=slack_token_exchange_failed`
    );
  }

  const { access_token, bot_user_id, app_id, team } = tokenData;

  const workspaceInfo = {
    team_id: team?.id,
    team_name: team?.name,
    bot_user_id,
    app_id,
  };

  try {
    await upsertUserIntegration({
      userId: user.id,
      provider: "slack",
      accessToken: access_token,
      workspaceInfo,
    });
  } catch {
    return NextResponse.redirect(
      `${origin}/settings/integrations?error=slack_save_failed`
    );
  }

  const response = NextResponse.redirect(
    `${origin}/settings/integrations?slack=connected`
  );
  response.cookies.set("slack_oauth_state", "", { maxAge: 0, path: "/" });
  return response;
}
