import { Request, Response, NextFunction } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, getUserSupabaseClient, isSupabaseConfigError } from '@/lib/supabase.js';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
  userClient?: SupabaseClient;
}

export async function verifyAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const supabase = getSupabaseClient();
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing authorization token',
      });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }

    req.user = { id: user.id, email: user.email || '' };
    // Create a user-scoped client for RLS enforcement
    req.userClient = getUserSupabaseClient(token);
    next();
  } catch (error) {
    const message = isSupabaseConfigError(error)
      ? error.message
      : 'Authentication check failed';
    res.status(isSupabaseConfigError(error) ? 503 : 500).json({
      success: false,
      error: message,
    });
  }
}

