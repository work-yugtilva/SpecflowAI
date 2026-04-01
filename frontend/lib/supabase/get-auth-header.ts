// lib/supabase/get-auth-header.ts
// Server-side helper: extract the Supabase session JWT and return
// an Authorization header for backend proxy routes.

import { createClient } from "@/lib/supabase/server";

export class MissingAuthSessionError extends Error {
  override readonly name = "MissingAuthSessionError";

  constructor(message: string = "Authentication required") {
    super(message);
  }
}

export function isMissingAuthSessionError(
  error: unknown
): error is MissingAuthSessionError {
  return error instanceof MissingAuthSessionError;
}

export async function getRequiredAuthHeader(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new MissingAuthSessionError();
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new MissingAuthSessionError();
  }

  return { Authorization: `Bearer ${session.access_token}` };
}
