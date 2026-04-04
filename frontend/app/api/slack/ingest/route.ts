import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRequiredAuthHeader,
  isMissingAuthSessionError,
} from "@/lib/supabase/get-auth-header";
import { getExpressApiBase } from "@/lib/api/express-base";

const SLACK_HISTORY_API = "https://slack.com/api/conversations.history";

interface SlackMessage {
  type: string;
  subtype?: string;
  text?: string;
  user?: string;
  username?: string;
}

interface SlackHistoryResponse {
  ok: boolean;
  messages?: SlackMessage[];
  error?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    channel_id?: string;
    channel_name?: string;
    session_id?: string;
    limit?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { channel_id, channel_name, session_id, limit = 50 } = body;
  if (!channel_id || !channel_name) {
    return NextResponse.json(
      { error: "channel_id and channel_name are required" },
      { status: 400 }
    );
  }

  // Fetch Slack token from user_integrations
  const { data: integration, error: integrationError } = await supabase
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", user.id)
    .eq("provider", "slack")
    .maybeSingle();

  if (integrationError) {
    return NextResponse.json({ error: integrationError.message }, { status: 500 });
  }

  const slackToken = integration?.access_token ?? undefined;
  if (!slackToken) {
    return NextResponse.json(
      {
        error: "No Slack token found. Connect your Slack account in Settings → Integrations.",
        code: "slack_not_connected",
      },
      { status: 401 }
    );
  }

  // Fetch messages from Slack
  const slackParams = new URLSearchParams({
    channel: channel_id,
    limit: String(limit),
  });

  const slackRes = await fetch(`${SLACK_HISTORY_API}?${slackParams}`, {
    headers: { Authorization: `Bearer ${slackToken}` },
  });

  if (!slackRes.ok) {
    return NextResponse.json(
      { error: "Failed to reach Slack API" },
      { status: 500 }
    );
  }

  const slackData = (await slackRes.json()) as SlackHistoryResponse;
  if (!slackData.ok) {
    return NextResponse.json(
      { error: slackData.error ?? "Slack API returned an error" },
      { status: 500 }
    );
  }

  // Filter to real user messages only (no subtype, non-empty text)
  const messages = (slackData.messages ?? []).filter(
    (m) => !m.subtype && m.text && m.text.trim().length > 0
  );

  // Get Supabase JWT for Express backend calls
  let authHeaders: Record<string, string>;
  try {
    authHeaders = await getRequiredAuthHeader();
  } catch (error) {
    if (isMissingAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Authentication error" }, { status: 500 });
  }

  const expressBase = getExpressApiBase();
  let imported = 0;

  for (const message of messages) {
    const text = message.text!;
    const researchUrl = new URL(`${expressBase}/api/research`);
    if (session_id) {
      researchUrl.searchParams.set("scope", "session");
      researchUrl.searchParams.set("sessionId", session_id);
    }

    try {
      const res = await fetch(researchUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          type: "Interview",
          title: text.slice(0, 80),
          content: text,
          user: message.username ?? "Slack",
          pain: "",
          context: channel_name,
          tags: ["slack", channel_name],
        }),
      });
      if (res.ok) imported++;
    } catch {
      // Individual message failures are non-fatal — skip and continue
    }
  }

  return NextResponse.json({ success: true, imported, channel: channel_name });
}
