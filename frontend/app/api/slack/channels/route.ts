import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackChannelsResponse {
  ok: boolean;
  channels?: SlackChannel[];
  error?: string;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const params = new URLSearchParams({
    types: "public_channel,private_channel",
    exclude_archived: "true",
    limit: "200",
  });

  const res = await fetch(
    `https://slack.com/api/conversations.list?${params}`,
    { headers: { Authorization: `Bearer ${slackToken}` } }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to reach Slack API" },
      { status: 500 }
    );
  }

  const data = (await res.json()) as SlackChannelsResponse;
  if (!data.ok) {
    return NextResponse.json(
      { error: data.error ?? "Slack API returned an error" },
      { status: 500 }
    );
  }

  const channels = (data.channels ?? [])
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ channels });
}
