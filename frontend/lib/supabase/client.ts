import { createBrowserClient } from "@supabase/ssr";
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  return createBrowserClient(resolveSupabaseUrl(), resolveSupabaseAnonKey());
}
