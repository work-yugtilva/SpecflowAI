import "server-only";

import { getRequiredAuthHeader } from "@/lib/supabase/get-auth-header";

export type IntegrationProvider = "linear" | "slack";

type IntegrationWorkspaceInfo = Record<string, unknown>;

interface DecryptedIntegrationRow {
  provider: IntegrationProvider;
  access_token: string;
  refresh_token?: string | null;
  workspace_info: IntegrationWorkspaceInfo | null;
}

interface IntegrationApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const PIPELINE_BASE =
  process.env.NEXT_PUBLIC_PIPELINE_URL?.trim() || "http://localhost:8001";

function integrationUrl(provider: IntegrationProvider): string {
  return `${PIPELINE_BASE.replace(/\/$/, "")}/integrations/${encodeURIComponent(provider)}`;
}

async function requestIntegration<T>(
  provider: IntegrationProvider,
  init?: RequestInit
): Promise<T | null> {
  const authHeaders = await getRequiredAuthHeader();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", authHeaders.Authorization);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(integrationUrl(provider), {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = (await res.json()) as IntegrationApiResponse<T>;

  if (!res.ok) {
    throw new Error(payload.error ?? `Integration API ${res.status}`);
  }

  return payload.data ?? null;
}

export async function getUserIntegrationWorkspaceInfo(
  userId: string,
  provider: IntegrationProvider
): Promise<IntegrationWorkspaceInfo | null> {
  void userId;
  const data = await requestIntegration<DecryptedIntegrationRow>(provider);
  return (data?.workspace_info as IntegrationWorkspaceInfo | null) ?? null;
}

export async function getUserIntegrationAccessToken(
  userId: string,
  provider: IntegrationProvider
): Promise<string | null> {
  void userId;
  const data = await requestIntegration<DecryptedIntegrationRow>(provider);
  return data?.access_token ?? null;
}

export async function upsertUserIntegration(params: {
  userId: string;
  provider: IntegrationProvider;
  accessToken: string;
  workspaceInfo?: IntegrationWorkspaceInfo;
}): Promise<void> {
  void params.userId;
  const metadata = { ...(params.workspaceInfo ?? {}) };
  const refreshToken =
    typeof metadata.refresh_token === "string" ? metadata.refresh_token : undefined;
  delete metadata.refresh_token;

  await requestIntegration(params.provider, {
    method: "PUT",
    body: JSON.stringify({
      access_token: params.accessToken,
      refresh_token: refreshToken,
      metadata,
    }),
  });
}

export async function deleteUserIntegration(
  userId: string,
  provider: IntegrationProvider
): Promise<void> {
  void userId;
  const authHeaders = await getRequiredAuthHeader();
  const res = await fetch(integrationUrl(provider), {
    method: "DELETE",
    headers: {
      Authorization: authHeaders.Authorization,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Integration API ${res.status}`);
  }
}
