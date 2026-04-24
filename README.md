# SpecflowAI
![Backend Tests](https://github.com/work-yugtilva/SpecflowAI/actions/workflows/backend-tests.yml/badge.svg)
![Vercel Production](https://github.com/work-yugtilva/SpecflowAI/actions/workflows/vercel-production.yml/badge.svg)

SpecFlow is an AI-powered product management automation platform. It uses a single repo-root env file for the frontend, Express API, and FastAPI pipeline service.

**Stack:** Next.js 14 · FastAPI · Supabase · Anthropic SDK · Google ADK

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Supabase account (for database)
- Anthropic API key
- Google Cloud credentials (for ADK)

## How to Setup

### 1. Clone & Environment
```bash
git clone <repo>
cd SpecFlow
cp .env.example .env
```

Edit `.env` with your credentials:
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `SUPABASE_URL` and `SUPABASE_KEY` — from your Supabase project
- `GOOGLE_APPLICATION_CREDENTIALS` — path to ADK service account JSON

### 2. Install Dependencies

```bash
# From the repo root: installs the root orchestration deps + the frontend workspace (Next.js)
npm install

# Backend (Express + pipeline scripts)
npm install --prefix backend
python3 -m pip install -r backend/requirements.txt
```

### 3. Start All Services

```bash
npm run dev
```

This starts:
- **Frontend:** http://localhost:3000
- **Express API:** http://localhost:3001
- **FastAPI pipeline:** http://localhost:8001

Source uploads at `/sources` require the Express API because the upload, parsing, and source evidence endpoints live under `/api/sources`.

### 4. Verify Setup

Test each service:
```bash
# Frontend (should load without errors)
curl http://localhost:3000

# Express API health
curl http://localhost:3001/health

# FastAPI docs
curl http://localhost:8001/docs
```

## Running Individual Services

If needed, start services separately:

```bash
# Frontend only
cd frontend && npm run dev

# Backend FastAPI only
cd backend/src && uvicorn main:app --reload --port 8001
```

## Testing

```bash
# Backend tests
cd backend && python -m pytest tests/ -v

# Frontend tests
cd frontend && npm run test

# Frontend E2E tests
cd frontend && npm run e2e

# Type check
cd frontend && npm run type-check
```

## Deploying on Vercel (frontend)

The Next.js app lives in **`frontend/`**, and the repo root is configured as an **npm workspace** so `npm install` / `npm run build` at the repository root install and build that app (see root [`package.json`](package.json) and [`vercel.json`](vercel.json)).

When you connect the GitHub repo to Vercel:

1. **Root Directory** can stay the **repository root** (default). Vercel will run `npm install` and `npm run build` from the root; the build script delegates to the `specflow-frontend` workspace.
2. Alternatively, you can still set **Root Directory** to **`frontend`** if you prefer a per-app project layout; either layout should work.
3. Configure production env vars in Vercel (**Settings** → **Environment Variables**) to match [`frontend/.env.example`](frontend/.env.example) / your local `frontend/.env.local` (e.g. `NEXT_PUBLIC_*` and API URLs).

**Required for sessions and pipeline:** set **`NEXT_PUBLIC_PIPELINE_URL`** (or server-only **`PIPELINE_SERVER_URL`**) to your public FastAPI origin with **no trailing slash**, e.g. `https://api.specflowai.com`. Next.js API routes proxy to this URL from Vercel’s servers; if it is missing, they default to `http://localhost:8001` and the UI shows “Backend service is offline.” Redeploy after changing the variable.

If an older deployment showed **404 NOT_FOUND** or **“No Next.js version detected”**, it was usually building from the wrong directory or skipping frontend dependencies—redeploy after the workspace + `vercel.json` setup above.

See also: [Vercel — Root Directory](https://vercel.com/docs/deployments/configure-a-build#root-directory) and [Monorepos on Vercel](https://vercel.com/docs/monorepos).

## Backend: Express vs FastAPI (do not confuse them)

The **`backend/`** folder contains **two separate HTTP services**:

| Service | Stack | Entry | Default local port | Role |
|--------|--------|--------|--------------------|------|
| **Pipeline API** | **Python FastAPI** | [`backend/src/main.py`](backend/src/main.py) | `8001` (`PIPELINE_PORT`) | Sessions, pipeline runs, PRD, jobs |
| **Context / research / sources API** | **Node + Express** | [`backend/src/expressEntry.ts`](backend/src/expressEntry.ts) | `3001` (`PORT`) | JWT auth, `/api/context`, `/api/research`, `/api/sources` |

Your frontend talks to them via **`NEXT_PUBLIC_PIPELINE_URL`** (FastAPI) and **`NEXT_PUBLIC_EXPRESS_API_URL`** / **`NEXT_PUBLIC_BACKEND_URL`** (Express) — see [`.env.example`](.env.example).

### Source ingestion migration

Run `backend/src/services/db/migrations/020_create_source_ingestion_tables.sql` in Supabase before using the Source Library. It creates `source_files` and `source_evidence` with RLS policies. No new environment variables are required.

### Deploying the pipeline (**FastAPI**) — not Vercel-first

FastAPI is **not** the same app as the Express server under [`backend/package.json`](backend/package.json). A Vercel project whose root is **`backend/`** will build **Node/Express**, not `uvicorn` + `main.py`.

For **FastAPI**, use a host meant for long‑running Python/ASGI (for example **Render**, **Fly.io**, **Railway**, or **Google Cloud Run**). Typical run:

```bash
cd backend && python -m pip install -r requirements.txt && cd src && uvicorn main:app --host 0.0.0.0 --port "${PORT:-8001}"
```

#### Railway (FastAPI): Railpack / “No start command detected”

**What goes wrong:** If the Railway service uses the **repository root** (default when you import the whole repo), Railpack sees the root **`package.json`** (npm workspace for Next.js). That file has a **`build`** script but **no `start` script**, so Railpack errors with **“No start command detected”** even though you intended to run **Python**.

**Fix (pick one):**

1. **Repo root (simplest)** — Do **not** set a Root Directory. Railway should read root [`railway.json`](railway.json) (Dockerfile build of [`Dockerfile.pipeline`](Dockerfile.pipeline)). In the service **Settings → Build**, ensure the dashboard is **not** forcing **Railpack** over config-as-code. If Railpack still runs, this repo also adds [`requirements.txt`](requirements.txt) (includes `backend/requirements.txt`), a [`Procfile`](Procfile), and [`railpack.json`](railpack.json) with **`provider: "python"`** so the plan gets a **start command** and **pip**. Set FastAPI env vars from [`.env.example`](.env.example) and put the public URL in **`NEXT_PUBLIC_PIPELINE_URL`** on the frontend. The API **starts without `TOKEN_ENCRYPTION_KEY`** (lazy crypto); add it in Railway before using **OAuth integration** routes that encrypt tokens (see [`.env.example`](.env.example) generator).
2. **`backend/` only** — **Settings → Root Directory** → **`backend`**. Then use [`backend/railway.toml`](backend/railway.toml) + [`backend/Dockerfile`](backend/Dockerfile) (see [monorepo config path](https://docs.railway.com/guides/monorepo): you may need **Config as code** → **`/backend/railway.toml`**).

**Custom domain (`Invalid host header`):** FastAPI uses `TrustedHostMiddleware`. Pointing **DNS** at Railway is not enough unless the **Host** is allowed. Set any of: **`PIPELINE_PUBLIC_URL`** or **`PUBLIC_URL`** to `https://api.yourdomain.com` on the **Python** service, **`ALLOWED_HOSTS=api.yourdomain.com`**, **`TRUSTED_HOST_SUFFIX=yourdomain.com`** (allows apex and `*.yourdomain.com`), or include `https://api.yourdomain.com` in **`ALLOWED_ORIGINS`**. Railway’s **`RAILWAY_PUBLIC_DOMAIN`** is also parsed when present.

`backend/` mixes **Node** (`package.json`) and **Python** (`requirements.txt`); Railpack can also fail with **“Error creating build plan”** unless you use **Dockerfile** as above.

### Deploying Express (**optional** on Vercel)

If you **do** want the small Node API on Vercel, use a **separate** Vercel project (not the same as the Next.js app):

1. **Root Directory** → **`backend`** (where [`backend/package.json`](backend/package.json) lives).
2. **Framework preset** → **Express**; this repo includes [`backend/vercel.json`](backend/vercel.json) with `"framework": "express"` so it is not treated as Next.js.
3. Env vars: **`SUPABASE_*`**, **`FRONTEND_URL`** / **`NEXT_PUBLIC_APP_URL`**, optional comma-separated **`ALLOWED_ORIGINS`** (merged into CORS with the same names as FastAPI), etc. — see [`.env.example`](.env.example).

Step-by-step checklist (domains, frontend `NEXT_PUBLIC_EXPRESS_API_URL`): [`docs/deploy/vercel-express.md`](docs/deploy/vercel-express.md).

The Express app **`export default app`** from [`backend/src/expressEntry.ts`](backend/src/expressEntry.ts); [`backend/index.ts`](backend/index.ts) re-exports `dist/` for Vercel so `@/` path aliases are not loaded from `src/` at runtime. See [Express on Vercel](https://vercel.com/docs/frameworks/backend/express).

## Troubleshooting

**Port already in use:**
```bash
# Find and kill process on port (e.g., 3000)
lsof -i :3000
kill -9 <PID>
```

**Python dependencies missing:**
```bash
python3 -m pip install --upgrade pip
python3 -m pip install -r backend/requirements.txt
```

**npm install fails:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**FastAPI won't start:**
- Ensure Python venv is activated
- Check `.env` has `ANTHROPIC_API_KEY` set
- Restart: `cd backend/src && uvicorn main:app --reload --port 8001`

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture, pipeline flow, and development guidelines.

Full setup docs: [docs/setup.md](./docs/setup.md)
