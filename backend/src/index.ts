import '@/lib/loadRootEnv.js';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

import { errorHandler, notFoundHandler } from '@/middleware/errorHandler.js';
import contextRoutes from '@/routes/context.js';
import researchRoutes from '@/routes/research.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const LOCAL_ORIGINS = [
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

// Middleware
app.disable('x-powered-by');
app.use(
  cors({
    origin: [FRONTEND_URL, ...LOCAL_ORIGINS],
    credentials: true,
  })
);
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/context', contextRoutes);
app.use('/api/research', researchRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'SpecFlow Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      context: '/api/context',
      contextMerged: '/api/context/merged?sessionId=<session-id>',
      contextImportGlobal: '/api/context/import-global',
      research: '/api/research',
    },
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   SpecFlow Backend Server              ║
║   Running on http://localhost:${PORT}    ║
╚════════════════════════════════════════╝
  `);
});
