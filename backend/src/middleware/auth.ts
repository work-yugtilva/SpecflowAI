import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient, isSupabaseConfigError } from '@/lib/supabase.js';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
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

export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const supabase = getSupabaseClient();
      supabase.auth.getUser(token).then(({ data: { user } }) => {
        if (user) {
          req.user = { id: user.id, email: user.email || '' };
        }
        next();
      });
    } else {
      next();
    }
  } catch (error) {
    next();
  }
}
