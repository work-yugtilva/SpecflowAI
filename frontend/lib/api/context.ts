const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export interface ContextFormData {
  companyName: string;
  companyType: string;
  productName: string;
  productDescription: string;
  targetUsers: string;
  goals: string;
  constraints: string;
}

export type ContextScope = "global" | "session";

interface ContextApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface MergedContextPayload {
  global: ContextFormData | null;
  session: ContextFormData | null;
  merged: ContextFormData;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Context API ${res.status}: ${text}`);
  }
  const payload = (await res.json()) as ContextApiResponse<T>;
  if (!payload.success) {
    throw new Error(payload.error ?? "Context API request failed");
  }
  return payload.data as T;
}

function scopeQuery(scope: ContextScope, sessionId?: string): string {
  const params = new URLSearchParams({ scope });
  if (scope === "session" && sessionId) {
    params.set("sessionId", sessionId);
  }
  return params.toString();
}

export async function fetchScopedContext(
  scope: ContextScope,
  sessionId?: string
): Promise<ContextFormData | null> {
  const res = await fetch(`${BACKEND_URL}/api/context?${scopeQuery(scope, sessionId)}`);
  return handleResponse<ContextFormData | null>(res);
}

export async function saveScopedContext(
  scope: ContextScope,
  data: ContextFormData,
  sessionId?: string
): Promise<ContextFormData> {
  const res = await fetch(`${BACKEND_URL}/api/context?${scopeQuery(scope, sessionId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<ContextFormData>(res);
}

export async function fetchMergedContext(
  sessionId: string
): Promise<MergedContextPayload> {
  const res = await fetch(
    `${BACKEND_URL}/api/context/merged?sessionId=${encodeURIComponent(sessionId)}`
  );
  return handleResponse<MergedContextPayload>(res);
}

export async function importGlobalContextToSession(
  sessionId: string
): Promise<ContextFormData | null> {
  const res = await fetch(`${BACKEND_URL}/api/context/import-global`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  return handleResponse<ContextFormData | null>(res);
}
