"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "pm" | "founder" | "engineer";

export interface UseUserRoleResult {
  role: UserRole | null;
  loading: boolean;
}

/**
 * Reads the authenticated user's role from user_profiles.
 * Fails open — returns { role: null, loading: false } on any error
 * so missing role never blocks the UI.
 */
export function useUserRole(): UseUserRoleResult {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (!cancelled) {
          const raw = (data as { role?: string } | null)?.role ?? null;
          const valid: UserRole[] = ["pm", "founder", "engineer"];
          setRole(valid.includes(raw as UserRole) ? (raw as UserRole) : null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { role, loading };
}
