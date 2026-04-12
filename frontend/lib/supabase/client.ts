import { createBrowserClient } from "@supabase/ssr";
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from "@/lib/supabase/env";

let didCleanupLegacyAuthStorage = false;

function removeLegacyLocalStorageAuthTokens(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      const hasLegacyPrefix = key?.startsWith("sb-") ?? false;
      const hasLegacySuffix = key?.endsWith("-auth-token") ?? false;
      if (hasLegacyPrefix && hasLegacySuffix) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

export function createClient() {
  if (!didCleanupLegacyAuthStorage) {
    removeLegacyLocalStorageAuthTokens();
    didCleanupLegacyAuthStorage = true;
  }
  return createBrowserClient(resolveSupabaseUrl(), resolveSupabaseAnonKey());
}
