import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

const ONBOARDING_COMPLETE_COOKIE = "specflow_onboarding_complete";
const PARTIAL_HEADER = "x-specflow-allow-partial-onboarding";

/** Auth + onboarding gate in Node — not Edge middleware (timeout-safe). */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const hdrs = await headers();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (hdrs.get(PARTIAL_HEADER) === "1") {
    if (!user) {
      redirect("/login");
    }
    return children;
  }

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  if (cookieStore.get(ONBOARDING_COMPLETE_COOKIE)?.value === "1") {
    return children;
  }

  const { data } = await supabase
    .from("user_profiles")
    .select("onboarding_completed_at")
    .eq("user_id", user.id)
    .single();

  if (!data?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  return children;
}
