"use client";

import { ActiveSessionProvider } from "@/lib/active-session-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <ActiveSessionProvider>{children}</ActiveSessionProvider>;
}
