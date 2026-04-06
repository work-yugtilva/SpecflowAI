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
  metricName?: string;
  metricValue?: number;
  metricBaseline?: number;
  metricUnit?: string;
  timePeriod?: string;
  dataSource?: string;
}

export interface ResolvedEntry {
  id: string;
  title: string;
  content: string;
  type: ResearchType;
  metric_name?: string | null;
  metric_value?: number | null;
  metric_baseline?: number | null;
  metric_unit?: string | null;
  time_period?: string | null;
  data_source?: string | null;
}

/** Resolve research entry UUIDs to full entry objects for citation display.
 *  Returns an empty array on any error — callers handle gracefully. */
export async function resolveResearchEntries(
  ids: string[]
): Promise<ResolvedEntry[]> {
  if (!ids.length) return [];
  try {
    const res = await fetch(
      `/api/research/resolve?ids=${ids.slice(0, 20).join(",")}`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.entries ?? [];
  } catch {
    return [];
  }
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
  // For Analytics entries, enrich the embedded content with structured metric fields
  // so the vector index can match queries like "activation rate" or "30-day retention".
  let embedContent = created.content;
  if (created.type === "Analytics" && created.metricName) {
    const parts: string[] = [created.content];
    const unit = created.metricUnit ?? "";
    const valuePart =
      created.metricValue != null && created.metricBaseline != null
        ? `${created.metricValue}${unit} vs baseline ${created.metricBaseline}${unit}`
        : created.metricValue != null
        ? `${created.metricValue}${unit}`
        : created.metricBaseline != null
        ? `baseline ${created.metricBaseline}${unit}`
        : null;
    const metaParts = [created.timePeriod, created.dataSource].filter(Boolean);
    parts.push(
      `Metric: ${created.metricName}${valuePart ? ` ${valuePart}` : ""}${metaParts.length ? ` (${metaParts.join(", ")})` : ""}`
    );
    embedContent = parts.join(" ");
  }
  fetch("/api/research/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entry_id: created.id,
      title: created.title,
      content: embedContent,
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
