import '@/lib/loadRootEnv.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export class SupabaseConfigError extends Error {
  override readonly name = 'SupabaseConfigError';
}

function readSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
}

function readSupabaseKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

function requireSupabaseConfig(): { url: string; key: string } {
  const url = readSupabaseUrl();
  const key = readSupabaseKey();
  const missing: string[] = [];

  if (!url) missing.push('SUPABASE_URL');
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    throw new SupabaseConfigError(
      `Missing Supabase environment variables: ${missing.join(
        ', '
      )}. Set them in the repo root .env before using Supabase-backed routes.`
    );
  }

  return { url: url as string, key: key as string };
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const { url, key } = requireSupabaseConfig();
    supabaseClient = createClient(url, key);
  }

  return supabaseClient;
}

export function getUserSupabaseClient(jwt: string): SupabaseClient {
  /**
   * Create a fresh user-scoped Supabase client.
   * Uses the anon key so Supabase RLS policies (user_id = auth.uid()) are enforced.
   * Do NOT use as a singleton — create a new client per JWT/user.
   */
  const url = readSupabaseUrl();
  const key = readSupabaseKey();
  
  if (!url || !key) {
    throw new SupabaseConfigError(
      'Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_ANON_KEY in the repo root .env.'
    );
  }

  const client = createClient(url, key);
  // Set JWT for authenticated requests - the client will use it in Authorization headers
  client.auth.setSession({
    access_token: jwt,
    refresh_token: '',
  });
  
  return client;
}

export function isSupabaseConfigError(error: unknown): error is SupabaseConfigError {
  return error instanceof SupabaseConfigError;
}
