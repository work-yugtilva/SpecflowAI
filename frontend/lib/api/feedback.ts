const API_BASE = "/api/sessions";

const FEEDBACK_FETCH_DEFAULTS: RequestInit = {
  credentials: "same-origin",
  cache: "no-store",
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let text = res.statusText;
    try {
      const body = await res.json();
      // FastAPI uses `detail` for HTTPException; custom errors use `error`
      text = body.error ?? body.detail ?? text;
    } catch {}
    throw new Error(text);
  }
  return res.json() as Promise<T>;
}

/** Same four strings as DB `feedback_entries.feedback_type` and FastAPI `FeedbackEntry`. */
export const FEEDBACK_TYPES = ["validated", "invalidated", "partial", "deferred"] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const DEFAULT_FEEDBACK_TYPE: FeedbackType = "validated";

/** Discovery Loop sidebar group order (validated first, then partial, etc.). */
export const FEEDBACK_TYPES_PANEL_ORDER: readonly FeedbackType[] = [
  "validated",
  "partial",
  "invalidated",
  "deferred",
];

export interface FeedbackEntry {
  id: string;
  session_id: string;
  prd_section: string;
  prd_item_title: string;
  feedback_type: FeedbackType;
  outcome_note: string;
  linked_problem_ids: string[];
  linked_research_ids: string[];
  created_at: string;
}

export async function fetchFeedback(sessionId: string): Promise<FeedbackEntry[]> {
  const res = await fetch(`${API_BASE}/${sessionId}/feedback`, FEEDBACK_FETCH_DEFAULTS);
  const data = await handleResponse<{ entries: FeedbackEntry[] }>(res);
  return data.entries;
}

export async function createFeedback(
  sessionId: string,
  entry: Omit<FeedbackEntry, "id" | "session_id" | "created_at">
): Promise<FeedbackEntry> {
  const res = await fetch(`${API_BASE}/${sessionId}/feedback`, {
    ...FEEDBACK_FETCH_DEFAULTS,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  const data = await handleResponse<{ success: boolean; entry: FeedbackEntry }>(res);
  return data.entry;
}

export async function deleteFeedback(sessionId: string, entryId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${sessionId}/feedback/${entryId}`, {
    ...FEEDBACK_FETCH_DEFAULTS,
    method: "DELETE",
  });
  await handleResponse<{ success: boolean }>(res);
}
