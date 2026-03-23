/**
 * Resolves Supabase URL + anon key for browser and server clients.
 *
 * In development, if env vars are missing, we fall back to the standard
 * local Supabase CLI defaults (http://127.0.0.1:54321 + demo anon JWT) so
 * `next dev` can boot without a `.env.local`. Set real values in
 * `frontend/.env.local` for your project or run `supabase start` locally.
 *
 * Production builds must set NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
/** Default anon key from `supabase start` / local stack — not a secret. */
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export function isSupabaseEnvExplicitlySet(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

export function resolveSupabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (v) return v;
  if (process.env.NODE_ENV === "development") {
    return LOCAL_SUPABASE_URL;
  }
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is required. Add it to frontend/.env.local (see https://supabase.com/dashboard/project/_/settings/api)."
  );
}

export function resolveSupabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (v) return v;
  if (process.env.NODE_ENV === "development") {
    return LOCAL_SUPABASE_ANON_KEY;
  }
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY is required. Add it to frontend/.env.local (see https://supabase.com/dashboard/project/_/settings/api)."
  );
}
