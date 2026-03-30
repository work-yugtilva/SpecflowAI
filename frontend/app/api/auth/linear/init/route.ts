import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.LINEAR_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "LINEAR_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/auth/linear/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "write",
    state,
  });

  const response = NextResponse.redirect(
    `https://linear.app/oauth/authorize?${params}`
  );

  response.cookies.set("linear_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minutes
    path: "/",
  });

  return response;
}
