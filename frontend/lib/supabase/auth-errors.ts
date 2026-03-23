/**
 * Maps low-level Supabase / fetch errors into actionable copy for the UI.
 */

export function formatAuthErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: string }).message;
    if (typeof m === "string" && m.trim()) {
      return mapNetworkMessage(m.trim());
    }
  }
  if (err instanceof Error && err.message) {
    return mapNetworkMessage(err.message);
  }
  return mapNetworkMessage(String(err));
}

function mapNetworkMessage(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("network request failed")
  ) {
    return (
      "Network error: the app could not reach Supabase. " +
      "If you use a cloud project, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
      "in frontend/.env.local or the repo root .env (see .env.example). " +
      "If you use the Supabase CLI locally, run `supabase start` so http://127.0.0.1:54321 is running."
    );
  }
  return message;
}
