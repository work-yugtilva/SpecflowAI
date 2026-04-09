import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type IntegrationProvider = "linear" | "slack";

type IntegrationWorkspaceInfo = Record<string, unknown>;

interface UserIntegrationRow {
  access_token: string;
  workspace_info: IntegrationWorkspaceInfo | null;
}

function integrationsTable() {
  return createAdminClient().from("user_integrations");
}

export async function getUserIntegrationWorkspaceInfo(
  userId: string,
  provider: IntegrationProvider
): Promise<IntegrationWorkspaceInfo | null> {
  const { data, error } = await integrationsTable()
    .select("workspace_info")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.workspace_info as IntegrationWorkspaceInfo | null) ?? null;
}

export async function getUserIntegrationAccessToken(
  userId: string,
  provider: IntegrationProvider
): Promise<string | null> {
  const { data, error } = await integrationsTable()
    .select("access_token")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Pick<UserIntegrationRow, "access_token"> | null)?.access_token ?? null;
}

export async function upsertUserIntegration(params: {
  userId: string;
  provider: IntegrationProvider;
  accessToken: string;
  workspaceInfo?: IntegrationWorkspaceInfo;
}): Promise<void> {
  const { error } = await integrationsTable().upsert(
    {
      user_id: params.userId,
      provider: params.provider,
      access_token: params.accessToken,
      workspace_info: params.workspaceInfo ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteUserIntegration(
  userId: string,
  provider: IntegrationProvider
): Promise<void> {
  const { error } = await integrationsTable()
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) {
    throw new Error(error.message);
  }
}
