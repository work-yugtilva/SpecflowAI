# Deploy SpecFlow frontend to Vercel (specflowai.com)

The Next.js app lives in `frontend/`. Vercel does not run the Python FastAPI pipeline or the Node Express API from this repo; those must be deployed separately and referenced via environment variables.

## Option A: Git integration (recommended)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In [Vercel](https://vercel.com) → **Add New Project** → import the repo.
3. **Root Directory**: leave as **`.`** (repository root) **or** set to `frontend`.  
   - If you use the repo root, the root [`vercel.json`](../vercel.json) runs `npm ci` / `npm run build` under `frontend/`.  
   - If you set Root Directory to `frontend`, Vercel uses [`frontend/vercel.json`](../frontend/vercel.json) and the default Next.js build.
4. **Build Command**: leave default unless you override (root `vercel.json` already sets it when deploying from monorepo root).
5. Deploy. Note the `*.vercel.app` URL.

### Troubleshooting: `404 NOT_FOUND` on `*.vercel.app`

Plain text `The page could not be found` / `NOT_FOUND` (not your app’s styled 404) means Vercel did not deploy a Next app for that URL. Common causes:

- Project **Root Directory** was wrong and no build output was produced.
- Fix: set **Root Directory** to `frontend`, or redeploy from the repo root so the root [`vercel.json`](../vercel.json) is used (install/build under `frontend/`).
- After changing root or env, trigger a **Redeploy** from the latest commit.

## Option B: GitHub Actions

1. From your machine: `cd frontend && npx vercel link` (log in, create/link project).
2. In the repo GitHub **Settings → Secrets and variables → Actions**, add:
   - `VERCEL_TOKEN` — [Vercel account tokens](https://vercel.com/account/tokens)
   - `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` — from `frontend/.vercel/project.json` after `vercel link`, or Project → Settings → General.
3. Push to `main`; workflow `.github/workflows/vercel-production.yml` runs when all three secrets are set.

## Production environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `NEXT_PUBLIC_PIPELINE_URL` | HTTPS origin of FastAPI (no trailing slash) |
| `NEXT_PUBLIC_EXPRESS_API_URL` | HTTPS origin of Express (`/api/context`, `/api/research`) |
| `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` | Optional, for Linear OAuth |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional |

After changing any `NEXT_PUBLIC_*` URL used in `connect-src`, **redeploy** so `next.config.mjs` CSP picks them up at build time.

## Supabase Auth

Dashboard → **Authentication → URL configuration**:

- **Site URL**: `https://specflowai.com` (or your canonical URL).
- **Redirect URLs**: `https://specflowai.com/auth/callback`, and optionally `https://*.vercel.app/auth/callback` for previews.

## Custom domain

Vercel → Project → **Settings → Domains** → add `specflowai.com` (and `www` if desired). Apply the DNS records Vercel shows at your registrar. Enable redirect apex ↔ www if you want a single canonical host.

## Database

Run all SQL migrations under `backend/src/services/db/migrations/` against production Supabase (including `012_user_plans.sql` for plan limits).

## Backends (not on Vercel)

- **FastAPI** (`backend/src`, port 8001 locally): deploy to Railway, Fly.io, Render, Cloud Run, etc. Same env as local pipeline (Anthropic, Supabase service role, etc.).
- **Express** (`backend/src/index.ts`, port 3001): deploy with Node. CORS already allows `https://specflowai.com` and `https://www.specflowai.com` (and Vercel preview `*.vercel.app`). For other domains, set `FRONTEND_URL` / `ALLOWED_ORIGINS` (FastAPI) per backend code.

See also `frontend/.env.production.example` for the full Vercel variable list.

## Smoke test

1. `https://specflowai.com` and `/pricing` load.
2. Login completes without `redirect_uri_mismatch`.
3. Dashboard shows plan/usage when FastAPI and `user_plans` migration are live.
4. One pipeline run succeeds end-to-end.
