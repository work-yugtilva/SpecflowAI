import { Router } from 'express';
import { verifyAuth, AuthRequest } from '@/middleware/auth.js';
import { researchService } from '@/services/researchService.js';
import { AppError } from '@/middleware/errorHandler.js';

const router = Router();

// GET /api/research - Get all research entries for user
router.get('/', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    const result = await researchService.getEntries(req.user.id, page, pageSize);

    res.json(result);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to fetch research entries');
  }
});

// POST /api/research - Create new research entry
router.post('/', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    const { valid, errors } = researchService.validateEntry(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    const entry = await researchService.createEntry(req.user.id, req.body);

    res.status(201).json({
      success: true,
      data: entry,
      message: 'Research entry created successfully',
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to create research entry');
  }
});

// GET /api/research/search - Search research entries
router.get('/search', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query required',
      });
    }

    const results = await researchService.searchEntries(req.user.id, query);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to search research entries');
  }
});

// GET /api/research/:id - Get specific research entry
router.get('/:id', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    const entry = await researchService.getEntry(req.user.id, req.params.id);

    if (!entry) {
      throw new AppError(404, 'Research entry not found');
    }

    res.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to fetch research entry');
  }
});

// PUT /api/research/:id - Update research entry
router.put('/:id', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    const { valid, errors } = researchService.validateEntry(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
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
    throw new AppError(500, 'Failed to update research entry');
  }
});

// DELETE /api/research/:id - Delete research entry
router.delete('/:id', verifyAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'User not authenticated');
    }

    await researchService.deleteEntry(req.user.id, req.params.id);

    res.json({
      success: true,
      message: 'Research entry deleted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Failed to delete research entry');
  }
});

export default router;
