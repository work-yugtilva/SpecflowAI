"use client";

import { useEffect } from "react";
import { ActiveSessionProvider } from "@/lib/active-session-context";
import { initPostHog } from "@/lib/posthog";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return <ActiveSessionProvider>{children}</ActiveSessionProvider>;
}
