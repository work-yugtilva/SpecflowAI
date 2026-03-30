# AGENTS.md — SpecFlow Project Guide

## Project Overview

SpecFlow is an AI-assisted product management workflow application. The product turns product context plus research inputs into a sequential output pipeline:

`product_context -> problems -> features -> decompositions -> tasks -> prd`

Primary user journey:
- authenticate with Supabase
- create or select a session
- capture global or session-scoped product context
- add research signals / ingest
- run the pipeline step-by-step or as a full session run
- inspect generated outputs on the step pages and Sessions page
- optionally generate and export a PRD

## Repository Map

Core runtime code:
- `frontend/` — Next.js 14 App Router app, React 18, TypeScript, Tailwind, Zustand, Supabase auth
- `backend/src/main.py` — FastAPI pipeline service for sessions, pipeline execution, PRD generation, and pipeline persistence
- `backend/src/index.ts` — Express TypeScript API for authenticated context and research endpoints
- `backend/config/agents/*.yaml` — YAML source of truth for agent instructions, schemas, memory config, and pipeline order
- `backend/src/services/db/migrations/*.sql` — Supabase schema/migration files

Supporting but not core runtime:
- `brand-assets/` — brand guide PDF and cover image; use these when touching marketing/visual work
- `docs/` — implementation plans and design notes
- `conductor/` — small implementation notes
- `autoresearch/` and `everything-claude-code/` — bundled external tool/reference repos; do not treat these as part of the SpecFlow runtime unless the task explicitly involves them

Generated or low-signal directories:
- `.next/`, `node_modules/`, `__pycache__/`, `.ruff_cache/`, `output/`

## Runtime Architecture

### Frontend
- Next.js App Router under `frontend/app/`
- App pages include marketing landing page plus authenticated product pages: `dashboard`, `sessions`, `context`, `research`, `problems`, `features`, `decompose`, `tasks`, `prd`
- Uses `ActiveSessionProvider` plus Zustand `useSessionStore` to track active session and session list
- Uses session-scoped localStorage helpers in `frontend/lib/session-scoped-storage.ts`
- Uses Next route handlers in `frontend/app/api/...` as proxies to backend services
- Supabase auth is enforced in `frontend/middleware.ts`

### Backend Service Split
- Express (`backend/src/index.ts`, default `:3001`)
  - owns `/api/context` and `/api/research`
  - validates Supabase bearer tokens
  - context is backed by Supabase `context_entries`
  - research service is still placeholder/TODO and mostly not used by the UI
- FastAPI (`backend/src/main.py`, code defaults to `PIPELINE_PORT` or `8001`)
  - owns `/run`, `/sessions`, `/session/{id}`, `/session/{id}/run`, `/session/{id}/prd`, `/pipelines/*`
  - runs the AI pipeline, session management, PRD generation, and session/memory persistence
  - uses Anthropic plus Google ADK orchestration

### AI Pipeline
- Pipeline definition lives in `backend/config/agents/pipeline.yaml`
- Typed agent classes live in `backend/src/services/agents/`
- `backend/src/services/agent_factory.py` is the only place where agent names are hardcoded
- `backend/src/services/orchestrator/adk_orchestrator.py` wraps the ordered steps as a Google ADK `SequentialAgent`
- `backend/src/services/pipeline.py` owns:
  - input validation
  - output coercion/normalization
  - feature scoring
  - output validation and quality flags
  - quality-gate evaluation
  - memory persistence
  - session snapshots and events

### Persistence
- Supabase is the persistence layer for both backends
- Important tables:
  - `sessions`
  - `session_state`
  - `session_events`
  - `memory_entries`
  - `context_entries`
  - `pipelines`
  - `product_profiles`
  - `quality_scores`

## Critical Conventions

### Environment and Startup
- The repo-root `.env` is the intended shared source of truth
- Next.js, Express, and FastAPI each load from the repo-root `.env`
- Full local development requires three processes:
  - `npm run dev --prefix frontend`
  - `npm run dev --prefix backend`
  - `cd backend/src && uvicorn main:app --reload --port 8001`
- Root `npm run dev` only starts Next.js plus the Express server; it does not start the FastAPI pipeline service

### Output Keys and Step Names
- Keep pipeline config, backend persistence, and frontend adapters aligned on keys
- Important distinction:
  - route/page step id: `decompose`
  - persisted/session output key: `decompositions`
- Canonical session output keys in practice are:
  - `product_context`
  - `problems`
  - `features`
  - `decompositions`
  - `tasks`
  - `prd`

### Agent and Memory Rules
- Do not hardcode agent names anywhere except `backend/src/services/agent_factory.py`
- Prefer changing YAML config over embedding prompt/schema logic in code
- Typed agents should slice only the context they need in `build_prompt()`
- Do not pass full state indiscriminately to downstream prompt builders
- Session-scoped memory entries must not set `project_id`
- List outputs are often persisted as `{"data": [...]}`; always unwrap persisted values through:
  - `Pipeline._unwrap_persisted_content(...)`
  - the agents' `_unwrap(...)` helpers
- Avoid duplicating persistence or unwrap logic outside the established helpers
- Avoid broad changes to `BaseAgent`; extend typed agents instead

### Frontend Patterns
- Use the `@/` alias in frontend imports
- Session pages and pipeline pages are session-first:
  - hydrate from `getSession(activeSessionId)`
  - read `session.state.outputs`
  - call `runPipelineStepOrFull(step, inputData, sessionId)` to execute
- Use `getExpressApiBase()` for context/research traffic rather than assuming pipeline URLs
- Use `frontend/lib/session-scoped-storage.ts` and `frontend/lib/pipeline-input.ts` rather than inventing new localStorage keys
- Respect existing brand assets in `brand-assets/` when changing visual/marketing surfaces

## Key Workflows

### Session + Context Flow
1. User authenticates through Supabase
2. User creates/selects a session on `/sessions`
3. Context can be stored globally or per session
4. Express persists context in `context_entries`
5. Frontend also mirrors context in localStorage/session-scoped localStorage for immediate UX

### Pipeline Execution Flow
1. Frontend builds pipeline input from stored context/research/ingest
2. Next API routes proxy session requests to FastAPI
3. FastAPI restores prior session state and memory if present
4. Pipeline runs either a single step or the full ordered workflow
5. Results are normalized, scored, validated, and quality-checked
6. Outputs are written to `session_state` and `memory_entries`
7. Frontend rehydrates from `session.state.outputs`

### PRD Flow
1. PRD route reads stored `problems`, `features`, `decompositions`, and `tasks`
2. `PRDAgent` generates a structured JSON PRD
3. A self-critique pass may trigger one retry when the score is low
4. Final PRD is stored in `memory_entries` under `prd`
5. Frontend can fetch, stream, and export the PRD as markdown

## Tests and Tooling

Frontend:
- unit/integration: Vitest (`frontend/vitest.config.ts`)
- e2e: Playwright (`frontend/tests/e2e/`)

Backend:
- pytest + httpx ASGI tests in `backend/tests/`
- Python dependencies live in `backend/requirements.txt`

Useful commands:
- `npm run test --prefix frontend`
- `npm run e2e --prefix frontend`
- `cd backend && python -m pytest tests/ -v`

## Known Constraints and Footguns

- `README.md`, `backend/README.md`, `CLAUDE.md`, and `docs/superpowers/*` contain useful context but also stale assumptions; prefer current code over prose when they disagree
- `frontend/app/api/pipeline/run/route.ts` is a local Anthropic fallback route gated by `NEXT_PUBLIC_USE_LOCAL_PIPELINE`; do not assume it is the primary execution path
- Research persistence is incomplete: the Express research service is TODO-heavy, while the current Research page is still localStorage-first
- Some authenticated product pages (`dashboard`, `onboarding`) still contain mostly static/demo content
- Default repo searches are fenced by [.ignore](/Users/yug/Desktop/SpecFlow/.ignore) to skip embedded external projects (`autoresearch`, `everything-claude-code`) and generated directories; use explicit paths or `rg -uu` when you intentionally need those trees
- The previous AGENTS file referenced `frontend-design`, `serve.mjs`, and `screenshot.mjs`; those references are obsolete in this checkout and should not be treated as active project tooling
