/**
 * Vercel Express entry: the platform prefers `src/index.ts` over `package.json#main`, which
 * left path aliases like `@/` unresolved at runtime. Root `index.ts` is loaded first; it
 * re-exports the compiled app from `dist/` after `npm run build` (`tsc` + `tsc-alias`).
 *
 * Local dev: use `npm run dev` → `tsx watch src/expressEntry.ts`.
 */
import app from './dist/expressEntry.js';

export default app;
