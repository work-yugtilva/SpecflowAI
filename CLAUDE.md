# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔴 CRITICAL PRIORITIES — ALWAYS FOLLOW FIRST

### 1. Always Invoke `/using-superpowers` Skill Before Starting Any Operations

**Every session and task:** Before writing, reading, or making ANY changes to code, invoke the `/using-superpowers` skill first. This ensures you discover and follow all relevant skills and workflows for the task at hand.

- Do not skip this even for "simple" tasks
- Skills override default behavior and provide critical task guidance
- If a skill exists, it takes priority

### 2. Always Use code-review-graph MCP Before Exploring or Writing Code

**Before file reads, grep, or code changes:** Invoke code-review-graph MCP tools to explore the codebase structure, understand relationships, and plan changes.

**Key tools to use FIRST:**
- `semantic_search_nodes` — Find functions/classes by meaning
- `query_graph` — Trace callers, callees, imports, tests, dependencies
- `detect_changes` — Analyze code change impact (for code review)
- `get_review_context` — Get efficient source snippets for review
- `get_impact_radius` — Understand blast radius of changes
- `get_affected_flows` — Find impacted execution paths
- `get_architecture_overview` — Understand high-level structure

**Why:** The graph is faster, cheaper (fewer tokens), and provides structural context (callers, dependents, test coverage) that file scanning cannot. Fall back to Grep/Glob/Read only when the graph doesn't cover what you need.

**Workflow:**
1. Task received → Invoke `/using-superpowers`
2. Need to explore code → Use code-review-graph MCP FIRST
3. Need file content → Use Grep/Glob/Read as fallback
4. Need to understand impact → Use `get_impact_radius` or `get_affected_flows`
5. Need code review → Use `detect_changes` + `get_review_context`

## SpecFlow v2 — AI Product Management Platform

**Stack:** Next.js 14 · FastAPI · Express (TypeScript) · Supabase · Anthropic SDK

**Architecture:**
- FastAPI (`backend/src/main.py`, port 8001) — Pipeline orchestration, agents, memory management
- Express (`backend/src/expressEntry.ts`, port 3001) — `/api/context`, `/api/research` endpoints
- Frontend (`frontend/`) — Next.js 14 App Router with React components
- Supabase — PostgreSQL database, real-time subscriptions, auth

**Pipeline Flow:**
`product_context` → `problems` → `features` → `decompose` → `tasks` → `PRD`

**Key Directories:**
- `backend/config/agents/` — Agent YAML configurations (system prompts, model settings, temperature)
- `backend/src/services/agents/` — Agent class implementations extending `BaseAgent`
- `backend/src/pipeline/` — Pipeline stage implementations, orchestration logic
- `frontend/components/` — React component hierarchy, UI primitives in `ui/`, pages in `app/`
- `backend/src/memory/` — Memory store integration with Supabase vector tables
- `backend/src/integrations/` — Anthropic SDK, Google ADK integrations

**Memory Architecture:** Each pipeline stage stores context in Supabase vector tables keyed by stage name. Memory retrieval uses semantic similarity via pgvector. Agents read input context from memory, process, write output before passing to next stage.

**Agent Flow:** Agents defined in YAML config; classes implement `run(context) → result`. Each agent reads from Supabase memory service, calls Anthropic API, writes result back. Config controls system prompt, temperature, model version.

## Commands

```bash
npm run dev                                    # Start all services (3000, 3001, 8001)
npm run dev --prefix frontend                 # Frontend only (3000)
npm run dev --prefix backend                  # Express server (3001)
cd backend/src && uvicorn main:app --reload --port 8001   # FastAPI pipeline
npm run type-check --prefix frontend          # TypeScript check
npm run lint --prefix frontend                # ESLint frontend
npm run build --prefix frontend               # Production build
cd backend && python -m pytest tests/ -v      # Run all backend tests
cd backend && python -m pytest tests/test_agents.py::TestAgent -v  # Single test
cd backend && python -m pytest tests/ -v --cov  # With coverage
npm run format --prefix frontend              # Format code with Prettier
npm run clean                                 # Clean build artifacts
```

## Environment Setup

Create `.env` at repo root (single source for all three services):
```
ANTHROPIC_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_KEY=eyJ...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## Database

- **Supabase Tables:** `agents`, `memory_vectors`, `tasks`
- **Migrations:** `backend/src/services/db/migrations/` managed via Supabase CLI
- **Vector Search:** Uses `pgvector` extension for semantic similarity queries
- **Schema:** Memory vectors stored as embeddings; agent results linked via `stage_key`
- **RLS Policies:** Check `Supabase → Tables → RLS` for row-level security

## Frontend Structure

- **App Router:** `frontend/app/` contains route segments and layout
- **Components:** Reusable components in `frontend/components/`, organized by domain
- **UI Primitives:** Base components in `frontend/components/ui/` (buttons, inputs, dialogs)
- **Server/Client:** Mark with `'use client'` when using hooks; default to server components
- **Styling:** Tailwind CSS + custom components, check `tailwind.config.js`
- **State Management:** React hooks for local state; Supabase for shared state

## Backend Structure

- **FastAPI:** Main pipeline at `backend/src/main.py`; routes defined via `@app.post()`, `@app.get()`
- **Agents:** Located in `backend/src/services/agents/`; all extend `BaseAgent`
- **Models:** Data models in `backend/src/models/` (Pydantic for FastAPI, TypeScript types for Express)
- **Supabase Client:** Initialize via `backend/src/services/db/supabase_client.py` and `backend/src/services/db/supabase_async.py`; pass to agents/services
- **Error Handling:** Return `{"data": null, "error": str, "status": "error"}` format consistently
- **Authentication:** Use Supabase JWT tokens; verify in middleware before processing

## API Endpoints

- **FastAPI (8001):**
  - `POST /pipeline/run` — Start pipeline with product context
  - `GET /agents/{agent_id}/status` — Check agent execution status
  - `POST /memory/store` — Store context in memory vectors

- **Express (3001):**
  - `GET /api/context?stage={stage}` — Retrieve stage context from memory
  - `POST /api/research` — Research endpoint for external integrations
  - `GET /api/health` — Health check

## Deployment & CI/CD

- **Frontend:** Vercel (via GitHub Actions on main branch)
- **Backend:** Docker containers on Cloud Run or similar
- **Environment:** `.env` set in deployment platform (not committed)
- **Workflows:** `.github/workflows/` manages tests, builds, deployments
- **Database:** Supabase hosted; migrations applied before backend deployment

## Required Skills (Invoke First)

- `/using-superpowers` — Start of every session
- `code-review-graph` MCP — Before exploring or modifying code
- `/frontend-design` — When writing React/TSX
- `/feature-dev:feature-dev` — When implementing features

## Testing Strategy

- **Backend:** Unit tests in `backend/tests/` with pytest; use fixtures for mocking Supabase
- **Frontend:** Component tests with React Testing Library; snapshots for stable UI
- **Integration:** End-to-end flows via FastAPI → Supabase → Express
- **Pre-commit:** Always run `npm run type-check --prefix frontend` on TypeScript changes
- **Coverage:** Aim for 80%+ coverage on agent and pipeline logic

## Performance Optimization

- **Vector Search:** Use appropriate similarity threshold (0.5-0.8) to balance relevance/speed
- **Agent Streaming:** For long-running agents, stream results via Server-Sent Events (SSE)
- **Caching:** Supabase query results cached in frontend React Query hooks
- **Database Indexes:** Ensure vector indexes are created on high-cardinality fields
- **API Response Time:** Target <200ms for context API; <5s for agent execution

## Security Considerations

- **Secrets:** Never commit `.env`; use Supabase vault for sensitive values in production
- **RLS:** Enable Row-Level Security on all Supabase tables; test policies thoroughly
- **CORS:** Express server should validate origin headers; configure in middleware
- **API Keys:** Rotate Anthropic keys regularly; monitor usage in console.anthropic.com
- **Input Validation:** Validate all user inputs before passing to agents; sanitize prompts

## Common Patterns

- Agent configs are YAML; agent classes extend `BaseAgent` with `run(context)` method
- Frontend uses Next.js server/client components; mark with `'use client'` for hooks
- Memory stored as vectors in Supabase; retrieve via semantic similarity search
- API responses follow `{data, error, status}` format consistently across endpoints
- Pipeline stages orchestrated sequentially; output of one stage feeds input to next
- Type safety: Use TypeScript interfaces for all API payloads and Supabase responses

## Debugging & Troubleshooting

- **FastAPI logs:** Check console output on port 8001; enable debug mode in main.py
- **Express logs:** Check console output on port 3001; check middleware order
- **Frontend errors:** Browser DevTools (localhost:3000); check Network tab for API calls
- **Supabase issues:** Check RLS policies, vector search index status, table permissions
- **Agent failures:** Verify agent config YAML syntax, check Anthropic API quota/key
- **Memory issues:** Ensure Supabase connection string is correct; test pgvector availability
- **Type errors:** Run `npm run type-check --prefix frontend` for comprehensive TypeScript errors
- **Agent timeouts:** Increase FastAPI timeout in `main.py` if agents exceed default (60s)
- **Vector embedding failures:** Check pgvector extension is installed; verify Supabase Postgres version

## Code Review & Contributions

- **Before PR:** Run type-check, lint, and tests locally
- **Commit Messages:** Use conventional commits (feat:, fix:, docs:, refactor:)
- **Code Style:** Follow Prettier format and ESLint rules; auto-format on save
- **Naming:** Use descriptive names; avoid abbreviations except for standard ones (ctx, db, api)
- **Docstrings:** Minimal; only explain WHY, not WHAT (code shows WHAT)

## Frequently Needed Info

- **Anthropic Model:** Check `backend/config/agents/` YAML for current model versions
- **Supabase URL:** In `.env`; also visible in Supabase dashboard
- **Pipeline Stage Output:** Each stage writes to Supabase with key `{stage_name}_output`
- **Frontend Build:** Production build requires all environment variables at build time

## Local Development Checklist

1. Install Node 18+, Python 3.9+, Supabase CLI
2. Copy `.env.example` to `.env` and fill credentials
3. Run `npm install && npm install --prefix backend`
4. Install Python deps: `cd backend && pip install -r requirements.txt`
5. Start services: `npm run dev` (or individually on separate terminals)
6. Verify: frontend at 3000, Express at 3001, FastAPI at 8001
