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

## Deploying on Vercel (Express API in `backend/`)

Use a **separate Vercel project** from the Next.js frontend. In that project:

1. **Root Directory** → **`backend`** (the folder with [`backend/package.json`](backend/package.json)).
2. **Framework preset** should be **Express** (or “Other”); do **not** inherit **Next.js** from another project. Repo root [`vercel.json`](vercel.json) intentionally does **not** set `framework`, so the Node API is not mistaken for Next.js. This repo also ships [`backend/vercel.json`](backend/vercel.json) with `"framework": "express"` for an explicit Express build.
3. Set the same **Supabase** and **CORS** variables you use locally (see [`.env.example`](.env.example): `SUPABASE_*`, `ALLOWED_ORIGINS`, `FRONTEND_URL` / `NEXT_PUBLIC_APP_URL`, `TOKEN_ENCRYPTION_KEY` if those routes need it, etc.).

The Express app already **`export default app`** from [`backend/src/index.ts`](backend/src/index.ts), which matches [Express on Vercel](https://vercel.com/docs/frameworks/backend/express).

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
