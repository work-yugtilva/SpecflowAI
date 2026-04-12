import { Request, Response, NextFunction } from 'express';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

import { getUserSupabaseClient } from '@/lib/supabase.js';

export type SupabaseUser = { id: string; email: string; role: string };

export interface AuthRequest extends Request {
  user?: SupabaseUser;
  userClient?: SupabaseClient;
}

function parseBearerToken(authHeader: string | undefined): string {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  return authHeader.slice('Bearer '.length).trim();
}

function createAnonSupabaseClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function verifySupabaseToken(
  authHeader: string | undefined
): Promise<SupabaseUser> {
  const token = parseBearerToken(authHeader);
  const supabase = createAnonSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error) {
    throw new Error(error.message);
  }
  if (!user) {
    throw new Error('Invalid or expired token');
  }

  const result: SupabaseUser = {
    id: user.id,
    email: user.email ?? '',
    role: user.role ?? '',
  };
  console.info(`[auth] verified user_id=${result.id}`);
  return result;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const user = await verifySupabaseToken(authHeader);
    const authReq = req as AuthRequest;
    authReq.user = user;
    authReq.userClient = getUserSupabaseClient(parseBearerToken(authHeader));
    res.locals.user = user;
    next();
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message : 'Authentication failed';
    res.status(401).json({ error: message });
  }
}
