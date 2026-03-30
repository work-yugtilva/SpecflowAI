# SpecFlow Setup

This is the canonical setup document for the SpecFlow repo.

## Runtime Topology

SpecFlow needs three local services:

1. `frontend` — Next.js app on `http://localhost:3000`
2. `backend` — Express API on `http://localhost:3001`
3. `pipeline` — FastAPI pipeline service on `http://localhost:8001`

The root `npm run dev` command now starts all three.

## Prerequisites

- Node.js 20+
- npm
- Python 3.11+ recommended

## Install

1. Create the shared env file:

```bash
cp .env.example .env
```

2. Install root and workspace Node dependencies:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

3. Install Python dependencies for the FastAPI pipeline:

```bash
python3 -m pip install -r backend/requirements.txt
```

If your machine uses `python` instead of `python3`, use that command instead.

## Start Everything

Run the full stack:

```bash
npm run dev
```

That starts:
- Next.js dev server
- Express API
- FastAPI pipeline service

## Environment Variables

All services read from the repo-root `.env`.

Important variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_PIPELINE_URL=http://localhost:8001`
- `NEXT_PUBLIC_EXPRESS_API_URL=http://localhost:3001`
- `FRONTEND_URL=http://localhost:3000`
- `PORT=3001`
- `PIPELINE_PORT=8001` optional override for the FastAPI service

## Useful Commands

Frontend only:

```bash
npm run dev --prefix frontend
```

Express only:

```bash
npm run dev --prefix backend
```

Pipeline only:

```bash
npm run dev:pipeline --prefix backend
```

Tests:

```bash
npm run test --prefix frontend
npm run e2e --prefix frontend
cd backend && python -m pytest tests/ -v
```
