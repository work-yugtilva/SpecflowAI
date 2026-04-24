import { getExpressApiBase } from "@/lib/api/express-base";
import { createClient } from "@/lib/supabase/client";

export type SourceScope = "global" | "session";
export type SourceFileType = "txt" | "pdf" | "docx" | "csv";
export type SourceStatus = "uploaded" | "processing" | "processed" | "failed";
export type SourceEvidenceType =
  | "quote"
  | "pain_point"
  | "theme"
  | "metric"
  | "observation";

export interface SourceFileRecord {
  id: string;
  userId: string;
  scope: SourceScope;
  scopeKey: string;
  sessionId?: string | null;
  filename: string;
  mimeType?: string | null;
  fileType: SourceFileType;
  fileSizeBytes: number;
  status: SourceStatus;
  parsedText?: string | null;
  summary?: string | null;
  errorMessage?: string | null;
  evidenceCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SourceEvidenceRecord {
  id: string;
  sourceFileId: string;
  userId: string;
  scope: SourceScope;
  scopeKey: string;
  sessionId?: string | null;
  evidenceType: SourceEvidenceType;
  title: string;
  content: string;
  customerLabel?: string | null;
  theme?: string | null;
  painPoint?: string | null;
  productArea?: string | null;
  sentiment?: string | null;
  confidence?: number | null;
  rowReference?: string | null;
  metadata: Record<string, unknown>;
  createdAt?: string;
}

export interface PipelineSourceEvidence {
  id: string;
  source_id: string;
  source_title: string;
  type: SourceEvidenceType;
  title: string;
  content: string;
  theme?: string | null;
  pain_point?: string | null;
  product_area?: string | null;
  sentiment?: string | null;
  confidence?: number | null;
  metadata: Record<string, unknown>;
}

export interface SourceDetailResponse {
  source: SourceFileRecord;
  evidence: SourceEvidenceRecord[];
}

export interface SourceUploadResponse {
  source: SourceFileRecord;
  evidenceCount: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

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

function scopeQuery(scope: SourceScope, sessionId?: string): string {
  const params = new URLSearchParams({ scope });
  if (scope === "session" && sessionId) {
    params.set("sessionId", sessionId);
  }
  return params.toString();
}

async function handleResponse<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  if (!res.ok || !payload.success) {
    throw new Error(payload.error ?? `Sources API ${res.status}: ${res.statusText}`);
  }
  return payload.data as T;
}

export async function uploadSourceFiles(
  files: File[],
  scope: SourceScope,
  sessionId?: string
): Promise<SourceUploadResponse[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(
    `${getExpressApiBase()}/api/sources/upload?${scopeQuery(scope, sessionId)}`,
    await withAuth({
      method: "POST",
      body: formData,
    })
  );
  return handleResponse<SourceUploadResponse[]>(res);
}

export async function listSources(
  scope: SourceScope,
  sessionId?: string
): Promise<SourceFileRecord[]> {
  const res = await fetch(
    `${getExpressApiBase()}/api/sources?${scopeQuery(scope, sessionId)}`,
    await withAuth()
  );
  return handleResponse<SourceFileRecord[]>(res);
}

export async function getSource(id: string): Promise<SourceDetailResponse> {
  const res = await fetch(
    `${getExpressApiBase()}/api/sources/${encodeURIComponent(id)}`,
    await withAuth()
  );
  return handleResponse<SourceDetailResponse>(res);
}

export async function deleteSource(id: string): Promise<void> {
  const res = await fetch(
    `${getExpressApiBase()}/api/sources/${encodeURIComponent(id)}`,
    await withAuth({ method: "DELETE" })
  );
  await handleResponse<unknown>(res);
}

export async function listSourceEvidence(
  scope: SourceScope,
  sessionId?: string
): Promise<PipelineSourceEvidence[]> {
  const res = await fetch(
    `${getExpressApiBase()}/api/sources/evidence?${scopeQuery(scope, sessionId)}`,
    await withAuth()
  );
  return handleResponse<PipelineSourceEvidence[]>(res);
}
