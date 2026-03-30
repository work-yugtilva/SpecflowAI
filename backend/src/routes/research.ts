import { Router } from 'express';
import { verifyAuth, AuthRequest } from '@/middleware/auth.js';
import { researchService } from '@/services/researchService.js';
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

// GET /api/research - Get all research entries for user
router.get('/', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 25;
    const { scope, sessionId } = resolveScope(req);

    const result = await researchService.getEntries(req.user.id, {
      scope,
      sessionId,
      page,
      pageSize,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to fetch research entries', 'INTERNAL_ERROR');
  }
});

// POST /api/research - Create new research entry
router.post('/', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
    }

    const { valid, errors } = researchService.validateEntry(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }

    const { scope, sessionId } = resolveScope(req);
    const entry = await researchService.createEntry(req.user.id, req.body, scope, sessionId);

    res.status(201).json({
      success: true,
      data: entry,
      message: 'Research entry created successfully',
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to create research entry', 'INTERNAL_ERROR');
  }
});

// GET /api/research/search - Search research entries
router.get('/search', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
    }

    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query required',
        code: 'MISSING_PARAM',
      });
    }

    const { scope, sessionId } = resolveScope(req);
    const results = await researchService.searchEntries(req.user.id, query, scope, sessionId);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to search research entries', 'INTERNAL_ERROR');
  }
});

// GET /api/research/:id - Get specific research entry
router.get('/:id', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
    }

    const entry = await researchService.getEntry(req.user.id, req.params.id);

    if (!entry) {
      throw new AppError(404, 'Research entry not found', 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to fetch research entry', 'INTERNAL_ERROR');
  }
});

// PUT /api/research/:id - Update research entry
router.put('/:id', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
    }

    const { valid, errors } = researchService.validateEntry(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }

    const entry = await researchService.updateEntry(req.user.id, req.params.id, req.body);

    res.json({
      success: true,
      data: entry,
      message: 'Research entry updated successfully',
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to update research entry', 'INTERNAL_ERROR');
  }
});

// DELETE /api/research/:id - Delete research entry
router.delete('/:id', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
    }

    await researchService.deleteEntry(req.user.id, req.params.id);

    res.json({
      success: true,
      message: 'Research entry deleted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to delete research entry', 'INTERNAL_ERROR');
  }
});

export default router;
