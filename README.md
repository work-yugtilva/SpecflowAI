# SpecflowAI

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

If an older deployment showed **404 NOT_FOUND** or **“No Next.js version detected”**, it was usually building from the wrong directory or skipping frontend dependencies—redeploy after the workspace + `vercel.json` setup above.

See also: [Vercel — Root Directory](https://vercel.com/docs/deployments/configure-a-build#root-directory) and [Monorepos on Vercel](https://vercel.com/docs/monorepos).

## Backend: Express vs FastAPI (do not confuse them)

The **`backend/`** folder contains **two separate HTTP services**:

| Service | Stack | Entry | Default local port | Role |
|--------|--------|--------|--------------------|------|
| **Pipeline API** | **Python FastAPI** | [`backend/src/main.py`](backend/src/main.py) | `8001` (`PIPELINE_PORT`) | Sessions, pipeline runs, PRD, jobs |
| **Context / research API** | **Node + Express** | [`backend/src/index.ts`](backend/src/index.ts) | `3001` (`PORT`) | JWT auth, `/api/context`, `/api/research` |

Your frontend talks to them via **`NEXT_PUBLIC_PIPELINE_URL`** (FastAPI) and **`NEXT_PUBLIC_EXPRESS_API_URL`** / **`NEXT_PUBLIC_BACKEND_URL`** (Express) — see [`.env.example`](.env.example).

### Deploying the pipeline (**FastAPI**) — not Vercel-first

FastAPI is **not** the same app as the Express server under [`backend/package.json`](backend/package.json). A Vercel project whose root is **`backend/`** will build **Node/Express**, not `uvicorn` + `main.py`.

For **FastAPI**, use a host meant for long‑running Python/ASGI (for example **Render**, **Fly.io**, **Railway**, or **Google Cloud Run**). Typical run:

```bash
cd backend && python -m pip install -r requirements.txt && cd src && uvicorn main:app --host 0.0.0.0 --port "${PORT:-8001}"
```

Set **`NEXT_PUBLIC_PIPELINE_URL`** on your **frontend** (e.g. Vercel env vars) to that service’s **HTTPS** origin.

### Deploying Express (**optional** on Vercel)

If you **do** want the small Node API on Vercel, use a **separate** Vercel project (not the same as the Next.js app):

1. **Root Directory** → **`backend`** (where [`backend/package.json`](backend/package.json) lives).
2. **Framework preset** → **Express**; this repo includes [`backend/vercel.json`](backend/vercel.json) with `"framework": "express"` so it is not treated as Next.js.
3. Env vars: **`SUPABASE_*`**, **`ALLOWED_ORIGINS`**, **`FRONTEND_URL`** / **`NEXT_PUBLIC_APP_URL`**, etc. — see [`.env.example`](.env.example).

The Express app **`export default app`** from [`backend/src/index.ts`](backend/src/index.ts), which matches [Express on Vercel](https://vercel.com/docs/frameworks/backend/express).

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
