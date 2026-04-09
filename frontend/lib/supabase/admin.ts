import "server-only";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "@/lib/supabase/env";

let adminClient: SupabaseClient | null = null;

function resolveServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server-side admin access.");
  }
  return key;
}

export function createAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(resolveSupabaseUrl(), resolveServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
