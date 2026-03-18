import { Router } from 'express';
import { verifyAuth, AuthRequest } from '@/middleware/auth.js';
import { contextService } from '@/services/contextService.js';
import { AppError } from '@/middleware/errorHandler.js';

const router = Router();

// GET /api/context - Get user's context
router.get('/', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    const context = await contextService.getContext(req.user.id);

    res.json({
      success: true,
      data: context,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to fetch context');
  }
});

// POST /api/context - Save user's context
router.post('/', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    const { valid, errors } = contextService.validateContext(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    const context = await contextService.saveContext(req.user.id, req.body);

    res.json({
      success: true,
      data: context,
      message: 'Context saved successfully',
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to save context');
  }
});

// DELETE /api/context - Delete user's context
router.delete('/', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    await contextService.deleteContext(req.user.id);

    res.json({
      success: true,
      message: 'Context deleted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to delete context');
  }
});

export default router;
