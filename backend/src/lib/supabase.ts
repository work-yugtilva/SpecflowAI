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

export function isSupabaseConfigError(error: unknown): error is SupabaseConfigError {
  return error instanceof SupabaseConfigError;
}
