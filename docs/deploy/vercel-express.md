# Deploy Express (`backend/`) on Vercel

Use a **separate Vercel project** from the Next.js frontend. Express serves `/api/context` and `/api/research`; the Python pipeline stays on Railway (or similar) and is reached via `NEXT_PUBLIC_PIPELINE_URL` on the frontend.

## 1. Create the Vercel project

1. Vercel Dashboard → **Add New…** → **Project** → import the same GitHub repo as the frontend.
2. **Root Directory**: `backend` (must be exactly this folder).
3. **Framework Preset**: Vercel should detect **Express** from [`backend/vercel.json`](../../backend/vercel.json). If not, choose Express manually.
4. Deploy. Note the production URL, e.g. `https://specflow-backend-xxxx.vercel.app`.

Optional: **Settings → Domains** → add e.g. `context.yourdomain.com` and use that HTTPS origin in step 3 below.

## 2. Environment variables (Express project)

In **Settings → Environment Variables** (Production, and Preview if you use it):

| Variable | Required | Example / notes |
|----------|----------|------------------|
| `SUPABASE_URL` | Yes | Same as Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | For JWT validation in [`verify_supabase_token`](../../backend/src/middleware/verify_supabase_token.ts) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for writes | Used by context service against Supabase |
| `FRONTEND_URL` | Strongly recommended | `https://specflowai.com` (your real Next.js origin, no trailing slash) |
| `ALLOWED_ORIGINS` | Optional | Comma-separated extra origins, e.g. `https://www.specflowai.com,https://specflowai.com` — merged into CORS allowlist |

The app also allows `*.vercel.app` preview URLs for local tunnel patterns; **custom domains are not inferred** — set `FRONTEND_URL` and/or `ALLOWED_ORIGINS`.

Repo-root `.env` is **not** present on Vercel; do not rely on file-based env loading for production.

## 3. Connect the Next.js frontend

On the **frontend** Vercel project (monorepo root or `frontend/` root, whichever you use):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_EXPRESS_API_URL` | Your Express deployment origin, e.g. `https://specflow-backend-xxxx.vercel.app` or your custom domain — **no trailing slash** |

Redeploy the frontend after saving.

Resolution order in code: [`frontend/lib/api/express-base.ts`](../../frontend/lib/api/express-base.ts) (`NEXT_PUBLIC_EXPRESS_API_URL` → `NEXT_PUBLIC_CONTEXT_API_URL` → `NEXT_PUBLIC_BACKEND_URL`).

## 4. Verify

```bash
curl -sS "https://<your-express-host>/health"
```

Expect JSON with `success: true`.

From the browser on your production site, open DevTools → Network; context/merged calls should succeed (no CORS errors) when `FRONTEND_URL` / `ALLOWED_ORIGINS` include that page’s origin.

## Reference

- App: [`backend/src/expressEntry.ts`](../../backend/src/expressEntry.ts) — `export default app` (compiled to `dist/expressEntry.js` with path aliases resolved via `tsc-alias`).
- Vercel entry: [`backend/index.ts`](../../backend/index.ts) re-exports the built app so the platform does not load `src/index.ts` with unresolved `@/` imports (see Vercel Express canonical paths).
- Config: [`backend/vercel.json`](../../backend/vercel.json).
- Build: [`backend/package.json`](../../backend/package.json) runs `tsc && tsc-alias`.
