import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export async function verifyAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
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
    res.status(500).json({
      success: false,
      error: 'Authentication check failed',
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
