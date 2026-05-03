# Deploy Express (`backend/`) on Vercel

Use a **separate Vercel project** from the Next.js frontend. Express serves `/api/context` and `/api/research`; the Python pipeline stays on Railway (or similar) and is reached via `NEXT_PUBLIC_PIPELINE_URL` on the frontend.

## 1. Create the Vercel project

1. Vercel Dashboard → **Add New…** → **Project** → import the same GitHub repo as the frontend.
2. **Root Directory**: set to **`backend`** (strongly recommended). If you leave the root at the **monorepo root**, Vercel still resolves `backend/src/index.*` first; this repo includes a small **`src/index.js`** shim that loads `dist/expressEntry.js` so path aliases are never executed from `src/`.
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
| `NEXT_PUBLIC_EXPRESS_API_URL` | Your Express deployment origin, e.g. `https://context.specflowai.com` — **no trailing slash** |
| `EXPRESS_API_URL` (optional) | **Server-only.** Preferred on Vercel for Route Handlers and SSR so the value never ships in the client bundle. Same URL as `NEXT_PUBLIC_*` is typical. Used first by [`express-origin.ts`](../../frontend/lib/api/express-origin.ts). |
| `NEXT_PUBLIC_EXPRESS_FALLBACK_ORIGIN` / `EXPRESS_FALLBACK_ORIGIN` (optional) | When Express would otherwise resolve to loopback (`127.0.0.1:3001`) **and** the app runs on Vercel/Railway (or the browser is not on localhost), this origin is used instead. Overrides the built-in SpecFlow default. Forks should set this (or explicit `NEXT_PUBLIC_EXPRESS_API_URL`). |

Redeploy the frontend after saving.

Canonical resolution order: [`frontend/lib/api/express-origin.ts`](../../frontend/lib/api/express-origin.ts) (`EXPRESS_API_URL` on server → `NEXT_PUBLIC_EXPRESS_API_URL` → `NEXT_PUBLIC_CONTEXT_API_URL` → `NEXT_PUBLIC_BACKEND_URL` except FastAPI ports → deployed/browser fallback). [`frontend/lib/api/express-base.ts`](../../frontend/lib/api/express-base.ts) wraps browser loopback with `/api/express`. [`frontend/lib/server/express-upstream.ts`](../../frontend/lib/server/express-upstream.ts) re-exports server resolution for the `/api/express/*` proxy.

Railway-hosted Next.js (or any host exposing `RAILWAY_ENVIRONMENT` / `RAILWAY_PUBLIC_DOMAIN`) uses the same fallback behaviour when Express URL env vars are unset.

## 4. Verify

```bash
curl -sS "https://<your-express-host>/health"
```

Expect JSON with `success: true`.

From the browser on your production site, open DevTools → Network; context/merged calls should succeed (no CORS errors) when `FRONTEND_URL` / `ALLOWED_ORIGINS` include that page’s origin.

## Reference

- App: [`backend/src/expressEntry.ts`](../../backend/src/expressEntry.ts) — `export default app` (compiled to `dist/expressEntry.js` with path aliases resolved via `tsc-alias`).
- Vercel entries: [`backend/index.ts`](../../backend/index.ts) (root Directory = `backend`) and [`backend/src/index.js`](../../backend/src/index.js) (monorepo root deploys → `/var/task/backend/src/index.js`) both re-export `dist/expressEntry.js` only.
- Config: [`backend/vercel.json`](../../backend/vercel.json).
- Build: [`backend/package.json`](../../backend/package.json) runs `tsc && tsc-alias`.
