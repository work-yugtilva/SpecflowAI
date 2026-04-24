import { Router } from 'express';
import multer from 'multer';

import { AppError } from '@/middleware/errorHandler.js';
import type { AuthRequest } from '@/middleware/verify_supabase_token.js';
import type { ContextScope, SourceUploadResponse } from '@/types/index.js';
import {
  MAX_SOURCE_FILE_SIZE_BYTES,
  SourceIngestionError,
  getFileType,
  parseSourceFile,
  sanitizeFilename,
  validateUploadedFile,
} from '@/services/sourceIngestionService.js';
import { sourceService } from '@/services/sourceService.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_SOURCE_FILE_SIZE_BYTES,
    files: 10,
  },
});

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

function requireUser(req: AuthRequest): string {
  if (!req.user?.id) {
    throw new AppError(401, 'User not authenticated', 'UNAUTHORIZED');
  }
  return req.user.id;
}

function toAppError(error: unknown, fallback: string): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof SourceIngestionError) {
    return new AppError(error.statusCode, error.message, error.code);
  }
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new AppError(413, 'File is too large', 'FILE_TOO_LARGE');
    }
    return new AppError(400, 'Upload failed', 'UPLOAD_FAILED');
  }
  console.error('[sources] internal error', error);
  return new AppError(500, fallback, 'INTERNAL_ERROR');
}

router.post('/upload', (req: AuthRequest, res, next) => {
  upload.array('files', 10)(req, res, async (uploadError: unknown) => {
    try {
      if (uploadError) throw uploadError;
      const userId = requireUser(req);
      const { scope, sessionId } = resolveScope(req);
      const files = (req.files ?? []) as Express.Multer.File[];

      if (files.length === 0) {
        throw new AppError(400, 'At least one file is required', 'MISSING_FILE');
      }

      for (const file of files) {
        validateUploadedFile(file);
      }

      const results: SourceUploadResponse[] = [];
      for (const file of files) {
        const fileType = getFileType(file.originalname);
        if (!fileType) {
          throw new AppError(400, 'Unsupported file type', 'UNSUPPORTED_FILE_TYPE');
        }

        const source = await sourceService.createSourceFile(
          userId,
          {
            scope,
            sessionId,
            filename: sanitizeFilename(file.originalname),
            mimeType: file.mimetype,
            fileType,
            fileSizeBytes: file.size,
          },
          req.userClient
        );

        try {
          const parsed = await parseSourceFile(file);
          const processed = await sourceService.markProcessed(
            userId,
            source.id,
            parsed.parsedText,
            parsed.summary,
            req.userClient
          );
          const evidence = await sourceService.insertEvidence(
            userId,
            processed,
            parsed.evidence,
            req.userClient
          );
          results.push({
            source: { ...processed, evidenceCount: evidence.length },
            evidenceCount: evidence.length,
          });
        } catch (error) {
          console.error('[sources] parse failed', error);
          const failed = await sourceService.markFailed(
            userId,
            source.id,
            'Unable to parse uploaded source',
            req.userClient
          );
          results.push({
            source: failed,
            evidenceCount: 0,
          });
        }
      }

      res.status(201).json({ success: true, data: results });
    } catch (error) {
      next(toAppError(error, 'Failed to upload sources'));
    }
  });
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = requireUser(req);
    const { scope, sessionId } = resolveScope(req);
    const data = await sourceService.listSources(userId, { scope, sessionId }, req.userClient);
    res.json({ success: true, data });
  } catch (error) {
    next(toAppError(error, 'Failed to fetch sources'));
  }
});

router.get('/evidence', async (req: AuthRequest, res, next) => {
  try {
    const userId = requireUser(req);
    const { scope, sessionId } = resolveScope(req);
    const data = await sourceService.listEvidenceForPipeline(
      userId,
      { scope, sessionId },
      req.userClient
    );
    res.json({ success: true, data });
  } catch (error) {
    next(toAppError(error, 'Failed to fetch source evidence'));
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const userId = requireUser(req);
    const data = await sourceService.getSourceWithEvidence(
      userId,
      req.params.id,
      req.userClient
    );
    if (!data) {
      throw new AppError(404, 'Source not found', 'NOT_FOUND');
    }
    res.json({ success: true, data });
  } catch (error) {
    next(toAppError(error, 'Failed to fetch source'));
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const userId = requireUser(req);
    await sourceService.deleteSource(userId, req.params.id, req.userClient);
    res.json({ success: true, message: 'Source deleted successfully' });
  } catch (error) {
    next(toAppError(error, 'Failed to delete source'));
  }
});

export default router;
