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
# Root-level installs
npm install

# Frontend (Next.js)
npm install --prefix frontend

# Backend
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

This repo’s Next.js app lives in **`frontend/`**. The root [`package.json`](package.json) does **not** include `next` (only orchestration scripts).

When you connect the GitHub repo to Vercel:

1. Open the project on Vercel → **Settings** → **General** → **Root Directory**.
2. Set **Root Directory** to **`frontend`** (not the repository root).
3. Save, then trigger a new deployment (**Deployments** → … → **Redeploy**).

If Root Directory is wrong, the build log may show only ~25 packages installed and **“No Next.js version detected”** — that means Vercel ran `npm install` against the root `package.json` instead of [`frontend/package.json`](frontend/package.json).

See also: [Vercel — Root Directory](https://vercel.com/docs/deployments/configure-a-build#root-directory) and [Monorepos on Vercel](https://vercel.com/docs/monorepos).

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
