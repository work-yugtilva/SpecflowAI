/**
 * Vercel entry when the project "Root Directory" is the monorepo root: the runtime path is
 * `/var/task/backend/src/index.js` and the framework resolves this file before `backend/index.ts`.
 * This module must not use TypeScript path aliases — only the pre-built output from `npm run build`.
 */
export { default } from '../dist/expressEntry.js';
