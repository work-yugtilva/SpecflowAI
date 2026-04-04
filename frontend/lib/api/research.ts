import { createClient } from "@/lib/supabase/client";
import { getExpressApiBase } from "@/lib/api/express-base";

async function withAuth(init: RequestInit = {}): Promise<RequestInit> {
  const headers = new Headers(init.headers);
  if (typeof window !== "undefined") {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  }
  return { ...init, headers };
}

export type ResearchScope = "global" | "session";
export type ResearchType =
  | "Interview"
  | "Survey"
  | "Analytics"
  | "Market Insight";

export interface ResearchEntryRecord {
  id: string;
  type: ResearchType;
  title: string;
  content: string;
  user: string;
  pain: string;
  context: string;
  tags: string[];
  scope?: ResearchScope;
  sessionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function scopeQuery(scope: ResearchScope, sessionId?: string): string {
  const params = new URLSearchParams({ scope });
  if (scope === "session" && sessionId) {
    params.set("sessionId", sessionId);
  }
  return params.toString();
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Research API ${res.status}: ${text}`);
  }
  const payload = (await res.json()) as ApiResponse<T>;
  if (!payload.success) {
    throw new Error(payload.error ?? "Research API request failed");
  }
  return payload.data as T;
}

export async function fetchResearchEntries(
  scope: ResearchScope,
  sessionId?: string
): Promise<ResearchEntryRecord[]> {
  const res = await fetch(
    `${getExpressApiBase()}/api/research?${scopeQuery(scope, sessionId)}`,
    await withAuth()
  );
  const payload = (await res.json()) as PaginatedResponse<ResearchEntryRecord>;
  if (!res.ok) {
    throw new Error(
      `Research API ${res.status}: ${payload.error ?? res.statusText}`
    );
  }
  if (!payload.success) {
    throw new Error(payload.error ?? "Research API request failed");
  }
  return payload.data ?? [];
}

export async function createResearchEntry(
  scope: ResearchScope,
  entry: Omit<ResearchEntryRecord, "id">,
  sessionId?: string
): Promise<ResearchEntryRecord> {
  const res = await fetch(
    `${getExpressApiBase()}/api/research?${scopeQuery(scope, sessionId)}`,
    await withAuth({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    })
  );
  const created = await handleResponse<ResearchEntryRecord>(res);

  // Fire-and-forget: generate embedding in the background — never block the UI
  fetch("/api/research/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entry_id: created.id,
      title: created.title,
      content: created.content,
    }),
  }).catch(() => {});

  return created;
}

export async function updateResearchEntry(
  entryId: string,
  entry: Partial<ResearchEntryRecord>
): Promise<ResearchEntryRecord> {
  const res = await fetch(
    `${getExpressApiBase()}/api/research/${encodeURIComponent(entryId)}`,
    await withAuth({
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    })
  );
  return handleResponse<ResearchEntryRecord>(res);
}

export async function deleteResearchEntry(entryId: string): Promise<void> {
  const res = await fetch(
    `${getExpressApiBase()}/api/research/${encodeURIComponent(entryId)}`,
    await withAuth({
      method: "DELETE",
    })
  );
  await handleResponse<unknown>(res);
}
