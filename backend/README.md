# SpecFlow Backend API

RESTful API server for SpecFlow, built with Express.js and TypeScript.

Canonical environment, ports, and startup instructions live in [../docs/setup.md](../docs/setup.md).

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run in development:**
   ```bash
   npm run dev
   ```
   Server will run on `http://localhost:3001`

The FastAPI pipeline service is separate. Start the full stack from the repo root with:

```bash
npm run dev
```

## API Endpoints

### Context
- `GET /api/context` - Get user's context
- `POST /api/context` - Save/update context
- `DELETE /api/context` - Delete context

### Research
- `GET /api/research` - List research entries
- `POST /api/research` - Create research entry
- `GET /api/research/:id` - Get specific entry
- `PUT /api/research/:id` - Update entry
- `DELETE /api/research/:id` - Delete entry
- `GET /api/research/search?q=query` - Search entries

### Health
- `GET /health` - API health check
- `GET /` - API info

## Authentication

All endpoints except `/health` and `/` require a Bearer token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/context
```

Tokens are obtained from Supabase authentication.

## Project Structure

```
index.ts          - Vercel entry: re-exports ./dist/expressEntry.js after build
/src
  expressEntry.ts - Main Express app (built to dist/expressEntry.js)
  /middleware     - Express middleware (auth, error handling)
  /routes         - API route handlers
  /services       - Business logic layer
  /types          - TypeScript type definitions
  /utils          - Utility functions
```

## Database Integration

- `context_entries` stores global and session-scoped context
- `research_entries` stores global and session-scoped research inputs
- Supabase credentials are read from the repo-root `.env`

## Development

- `npm run dev` - Start dev server with auto-reload
- `npm run build` - Compile TypeScript
- `npm start` - Run compiled server
- `npm run type-check` - Check TypeScript types
- `npm run lint` - Run ESLint

## Environment Variables

See the repo-root `.env.example` for required variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Optional fallback key for auth-only server calls
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (admin access)
- `NEXT_PUBLIC_SUPABASE_URL` - Shared public Supabase URL for the frontend
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Shared public Supabase anon key for the frontend
- `NEXT_PUBLIC_PIPELINE_URL` - Session/pipeline API base URL for the frontend
- `NEXT_PUBLIC_BACKEND_URL` - Express API base URL for the frontend
- `FRONTEND_URL` - Frontend origin for CORS
- `PORT` - Server port (default: 3001)

`frontend/.env.local` and `backend/.env` are no longer read.
