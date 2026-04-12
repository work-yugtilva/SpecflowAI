import '@/lib/loadRootEnv.js';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { errorHandler, notFoundHandler } from '@/middleware/errorHandler.js';
import { requireAuth } from './middleware/verify_supabase_token.js';
import {
  generalLimiter,
  researchLimiter,
  contextLimiter,
} from './middleware/rate_limiter.js';
import contextRoutes from '@/routes/context.js';
import researchRoutes from '@/routes/research.js';

const app = express();
const PORT = process.env.PORT || 3001;
const LOCAL_ORIGINS = [
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];
const HOSTED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i,
  /^https:\/\/[a-z0-9-]+\.loca\.lt$/i,
  /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i,
  /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i,
];

function buildAllowedOrigins(): string[] {
  const configured = [
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.URL,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set([...configured, ...LOCAL_ORIGINS]));
}

function isAllowedOrigin(origin: string | undefined, allowedOrigins: Set<string>) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return HOSTED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

// Middleware
app.disable('x-powered-by');
const allowedOrigins = new Set(buildAllowedOrigins());
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin ?? 'unknown'} is not allowed by CORS`));
    },
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
app.use('/api/research', requireAuth, researchLimiter, researchRoutes);
app.use('/api/context', requireAuth, contextLimiter, contextRoutes);
app.use('/api', requireAuth, generalLimiter);

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

function startServer() {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   SpecFlow Backend Server              ║
║   Running on http://localhost:${PORT}    ║
╚════════════════════════════════════════╝
  `);
  });
}

const isDirectExecution =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  startServer();
}

export default app;
