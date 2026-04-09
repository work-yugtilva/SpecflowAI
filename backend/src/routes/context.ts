import { Router } from 'express';
import { verifyAuth, AuthRequest } from '@/middleware/auth.js';
import { contextService } from '@/services/contextService.js';
import { AppError } from '@/middleware/errorHandler.js';
import { ContextScope } from '@/types/index.js';

const router = Router();

function resolveScope(req: AuthRequest): { scope: ContextScope; sessionId?: string } {
  const rawScope = String(req.query.scope ?? 'global').toLowerCase();
  if (rawScope !== 'global' && rawScope !== 'session') {
    throw new AppError(400, 'scope must be either "global" or "session"', 'VALIDATION_ERROR');
  }
  const scope = rawScope as ContextScope;
  const sessionId =
    typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : undefined;

  if (scope === 'session' && !sessionId) {
    throw new AppError(400, 'sessionId query param is required when scope=session', 'MISSING_PARAM');
  }

  return { scope, sessionId };
}

// GET /api/context - Get scoped context (default: global)
router.get('/', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
    }

    const { scope, sessionId } = resolveScope(req);
    const context = await contextService.getContext(req.user.id, scope, sessionId, req.userClient);

    res.json({
      success: true,
      data: context,
      scope,
      sessionId: sessionId ?? null,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to fetch context', 'INTERNAL_ERROR');
  }
});

// GET /api/context/merged?sessionId=... - Get global + session + merged
router.get('/merged', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
    }

    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    if (!sessionId) {
      throw new AppError(400, 'sessionId query param is required', 'MISSING_PARAM');
    }

    const bundle = await contextService.getMergedContext(req.user.id, sessionId, req.userClient);

    res.json({
      success: true,
      data: bundle,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to fetch merged context', 'INTERNAL_ERROR');
  }
});

// POST /api/context - Save scoped context (default: global)
router.post('/', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
    }

    const { scope, sessionId } = resolveScope(req);
    const { valid, errors } = contextService.validateContext(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }

    const context = await contextService.saveContext(
      req.user.id,
      req.body,
      scope,
      sessionId,
      req.userClient
    );

    res.json({
      success: true,
      data: context,
      message: 'Context saved successfully',
      scope,
      sessionId: sessionId ?? null,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to save context', 'INTERNAL_ERROR');
  }
});

// POST /api/context/import-global - Copy global context to a session
router.post('/import-global', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
    }

    const sessionId = String(req.body?.sessionId ?? '').trim();
    if (!sessionId) {
      throw new AppError(400, 'sessionId is required', 'MISSING_PARAM');
    }

    const copied = await contextService.importGlobalToSession(req.user.id, sessionId, req.userClient);
    res.json({
      success: true,
      data: copied,
      message: copied
        ? 'Global context imported into session context'
        : 'No global context found to import',
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to import global context', 'INTERNAL_ERROR');
  }
});

// DELETE /api/context - Delete scoped context (default: global)
router.delete('/', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
    }

    const { scope, sessionId } = resolveScope(req);
    await contextService.deleteContext(req.user.id, scope, sessionId, req.userClient);

    res.json({
      success: true,
      message: 'Context deleted successfully',
      scope,
      sessionId: sessionId ?? null,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to delete context', 'INTERNAL_ERROR');
  }
});

export default router;
