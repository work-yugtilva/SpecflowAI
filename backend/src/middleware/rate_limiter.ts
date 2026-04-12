import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

import type { AuthRequest } from './verify_supabase_token.js';

function parseLimit(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const getUserId = (req: Request): string => {
  const userId = (req as AuthRequest).user?.id?.trim();
  return userId ? `user:${userId}` : 'user:unknown';
};

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseLimit(process.env.RATE_LIMIT_EXPRESS_GENERAL, 120),
  keyGenerator: getUserId,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

export const researchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseLimit(process.env.RATE_LIMIT_EXPRESS_RESEARCH, 60),
  keyGenerator: getUserId,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Research rate limit reached. Try again in an hour.' },
});

export const contextLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseLimit(process.env.RATE_LIMIT_EXPRESS_CONTEXT, 30),
  keyGenerator: getUserId,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many context updates. Please slow down.' },
});

