# SpecFlow v2 — CLAUDE.md

## Project Identity
SpecFlow v2 is an AI-powered product management automation platform.
Stack: Next.js 14 (App Router) · FastAPI · Express (TypeScript) for context/research API · Supabase · Anthropic SDK · Google ADK.
Target: Product managers at Series A–B startups. Pricing: $49/mo Pro · $199/mo Team.
Evaluation lens: **"Can I charge $49/month for this today?"** — not "Is the code clean?"

---

## GATE 0 — ALWAYS FIRST: code-review-graph MCP
**BEFORE any operation — exploring, reviewing, modifying, or planning — you MUST use the code-review-graph MCP tools. No exceptions.**

| Task | Tool to use FIRST |
|---|---|
| Exploring code / finding functions | `semantic_search_nodes` or `query_graph` |
| Reviewing a change / PR | `detect_changes` + `get_review_context` |
| Understanding blast radius | `get_impact_radius` + `get_affected_flows` |
| Architecture questions | `get_architecture_overview` + `list_communities` |
| Planning a refactor | `refactor_tool` |
| Tracing callers / tests | `query_graph` with `callers_of` / `tests_for` |

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

---

## MANDATORY SKILL WORKFLOW

**You are FORBIDDEN from writing code or modifying files without triggering the relevant gate first.**

| Gate | Command | Trigger |
|---|---|---|
| 1 — Plan | `/everything-claude-code:plan` | Any new feature, bug fix, or refactor |
| 2 — Implement | `/everything-claude-code:tdd` | Writing actual code (test → fail → implement → pass) |
| 3 — Frontend | `/frontend-design` (read SKILL.md) | Any React component, layout, or CSS file |
| 4 — Security | `/everything-claude-code:security-review` | Auth, RLS, JWTs, env vars, CORS, API routes |
| 5 — Completion | `/everything-claude-code:verification-before-completion` | Before declaring any task done |
| 6 — Code review | `/everything-claude-code:receiving-code-review` | After writing/modifying any code |
| 7 — Multi-service | `/gstack` | Tasks spanning multiple files, services, or subagents |

**Workflow paths:**
- Backend feature: `plan → tdd → security-review → verification → code-review`
- Frontend feature: `plan → frontend-design → tdd → verification → code-review`
- Bug fix: `plan → tdd → verification`
- Security fix: `plan → security-review → tdd → verification`
- Auth/RLS/env: `plan → security-review → verification`

---

## Architecture

Two HTTP services share the repo-root `.env` and Supabase:

| Service | Entry | Default port | Responsibility |
|--------|--------|----------------|-----------------|
| **FastAPI** | `backend/src/main.py` | `PIPELINE_PORT` / **8001** | Pipeline runs, sessions, PRD, agent handoff, jobs, plan limits |
| **Express (TypeScript)** | `backend/src/expressEntry.ts` (`backend/index.ts` on Vercel) | **3001** (`PORT`) | `/api/context`, `/api/research` — JWT validation, proxies to Supabase |

**Local dev (three processes):** `npm run dev --prefix frontend` · `npm run dev --prefix backend` (Express) · `cd backend/src && uvicorn main:app --reload --port 8001` (FastAPI). Root `npm run dev` does **not** start FastAPI.

```
/
├── frontend/                         # Next.js 14 App Router
│   ├── app/                          # Marketing + product pages (sessions, context, research, pipeline steps, prd)
│   ├── components/                   # Shared UI + pipeline components
│   └── lib/                          # API clients, hooks, Zustand, session-scoped storage
│
├── backend/
│   ├── config/agents/                # YAML source of truth — NOT under src/ (pipeline.yaml + per-agent yaml)
│   └── src/
│       ├── main.py                   # FastAPI app
│       ├── index.ts                  # Express app
│       ├── middleware/               # TS: auth, rate_limiter, verify_supabase_token
│       ├── routes/                   # TS: context, research
│       └── services/
│           ├── agent_factory.py      # ONLY file that maps agent name → class
│           ├── agents/               # Typed agents (all extend BaseAgent)
│           ├── pipeline.py           # Runner, coercion, validation, memory/session persistence helpers
│           ├── orchestrator/         # Google ADK SequentialAgent wrapper (adk_orchestrator.py)
│           ├── memory/               # MemoryStore, MemoryManager, MemoryRepository
│           ├── session/              # SessionManager, SessionRepository
│           ├── db/                   # Supabase client, models, SQL migrations
│           ├── security/             # SlowAPI limiter helpers, input_sanitizer, token_encryption
│           ├── integration_service.py
│           ├── config/               # ConfigManager, env/schema loaders
│           └── …                     # ai/, plan/, research/, rag/, jobs, etc.
```

**Pipeline (ordered steps in `backend/config/agents/pipeline.yaml`):**  
`product_context → problems → features → decompose → tasks → linear_sync`  
**PRD** is generated on demand via dedicated session routes (terminal step, not in that YAML list). **Query** and **quality_gate** are invoked from code paths as needed; **agent_handoff** has dedicated PRD-style endpoints.

Each pipeline step persists list-shaped output to `memory_entries` scoped by `session_id` (see `pipeline.yaml` `output_key` per step; e.g. `linear_payload` for Linear).

**Memory read keys (downstream agents):** features←`problems` · decompose←`problems`,`features` · tasks←`problems`,`features`,`decompositions` · prd←`product_context`,`problems`,`features`,`decompositions`,`tasks`

---

## Agents

All typed agents extend `BaseAgent`, override `build_prompt()`, and inject **only their required context slice**.

| Agent | Typical memory / output key |
|---|---|
| ProductContextAgent | `product_context` |
| ProblemsAgent | `problems` |
| FeaturesAgent | `features` |
| DecomposeAgent | `decompositions` |
| TasksAgent | `tasks` |
| LinearSyncAgent | `linear_payload` |
| PRDAgent | `prd` |
| AgentHandoffAgent | `agent_handoff` |
| QualityGateAgent | Rubric result / `quality_scores` (not a single pipeline memory key) |
| QueryAgent | On-demand Q&A — `POST /session/{session_id}/query` in `main.py` |

**Unwrap pattern** (required in every agent):
```python
def _unwrap(self, val):
    if isinstance(val, dict) and list(val.keys()) == ["data"]:
        return val["data"]
    return val
```

`agent_factory.py` is the **only** file that maps agent names to classes. Never hardcode elsewhere.
Models: `claude-sonnet-4-5` default · Token budgets: features/decompose 3000 · tasks 4000 · prd 6000 · Regen cap: 3/step.

---

## Database (Supabase)

Key tables: `sessions` · `session_state` · `session_events` · `memory_entries` · `quality_scores` · `user_integrations` · `product_profiles` · `context_entries` (Express context API) · `pipelines`

- `_persist_step_memory()` wraps lists as `{"data": [...]}` — `_unwrap_persisted_content()` reverses it. Implementations live on **`Pipeline`** in `services/pipeline.py` (call sites may also reference `Pipeline._unwrap_persisted_content` from `main.py`).
- **Never** add `project_id` to session-scoped memory entries.
- **Never** change schema without a new SQL file under **`backend/src/services/db/migrations/`** (and the usual Supabase deploy flow).

---

## Frontend Brand System

Always read `/mnt/skills/public/frontend-design/SKILL.md` before any frontend work.

**Colors:** paper `#F8F4EF` · terra `#E8561B` (primary) · sage `#3D6B5E` · charcoal `#0D0D0D` · border `#E4DDD4`
**Fonts:** `var(--font-instrument)` Instrument Serif (headings) · `var(--font-dm-sans)` DM Sans (body) · `Courier New` (code)
**Aesthetic:** editorial glassmorphism — warm, tactile, not corporate SaaS. Never Inter, Roboto, Arial, or purple gradients.

**Pipeline page pattern:**
1. On mount: `getSession(activeSessionId)` → hydrate from `state.outputs`
2. On generate: `runPipelineStepOrFull(step, inputData, sessionId)`
3. Adapt raw output through typed adapter (handles `{"data": [...]}` unwrap) before setting state

---

## Critical Rules (PR blockers)

- No hardcoding — all agent config lives in YAML
- `agent_factory.py` is sole agent name→class mapping
- Memory keys must be consistent: `pipeline.yaml` = `yaml write.key` = frontend adapter key
- Do not modify `BaseAgent` — extend it
- Session-scoped memory: never set `project_id`
- PRD is terminal — runs after tasks, not part of the YAML `steps` list in `pipeline.yaml`
- Restart FastAPI after any `.yaml` config change
- `reasoning` fields stripped before DB persistence — never persist them
- No `str(e)` leaks to API responses — all exceptions return generic messages

---

## Security Rules

- `verify_supabase_jwt` must be async — never blocking `httpx.get()`
- FastAPI protected routes use `Depends(require_auth)` (alias: `require_auth_context`) returning `SupabaseUser`
- Rate limits: AI endpoints `10/minute` · default `60/minute` (slowapi)
- Request body limit: 512KB max
- `ALLOWED_ORIGINS` must be set in production (startup validates)
- Linear sync: `ALLOWED_OPERATIONS` whitelist enforced before any fetch

---

## Verification (every task must include)

1. **Files to touch** — explicit list
2. **Files NOT to touch** — explicit list
3. **Grep checks** — at least 2 commands with expected output
4. **End-to-end test step**

---

## Commands

```bash
cd backend/src && uvicorn main:app --reload --port 8001   # FastAPI (pipeline)
npm run dev --prefix backend                               # Express (context / research)
cd frontend && npm run dev                                 # Next.js frontend
cd backend && python -m pytest tests/ -v                  # Backend tests
cd frontend && npm run type-check                          # Type check
```