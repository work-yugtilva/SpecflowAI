# SpecFlow v2 — CLAUDE.md

## Project Identity
SpecFlow v2 is an AI-powered product management automation platform.
Stack: Next.js 14 (App Router) · FastAPI · Supabase · Anthropic SDK · Google ADK.
Target: Product managers at Series A–B startups.

---

## Architecture

```
/
├── frontend/          # Next.js 14 App Router
│   ├── app/           # Pages: problems, features, decompose, tasks, sessions, prd
│   ├── components/    # UI + pipeline components
│   └── lib/           # API clients, hooks, stores, utils
│
└── backend/
    └── src/
        ├── main.py                    # FastAPI entry point (port 8001)
        ├── services/
        │   ├── agents/                # ProblemsAgent, FeaturesAgent, DecomposeAgent, TasksAgent, PRDAgent
        │   ├── orchestrator/          # ADK SequentialAgent orchestrator
        │   ├── pipeline.py            # Pipeline runner + coercion + validation
        │   ├── agent_factory.py       # Agent dispatch map — only file with hardcoded names
        │   ├── memory/                # MemoryStore, MemoryManager, MemoryRepository
        │   ├── session/               # SessionManager, SessionRepository
        │   └── config/                # YAML loaders, schemas, env
        └── config/agents/             # problems.yaml, features.yaml, decompose.yaml, tasks.yaml, prd.yaml
```

---

## Pipeline

4-step sequential pipeline orchestrated by Google ADK:

```
problems → features → decompose → tasks → [prd]
```

Each step writes to Supabase `memory_entries` scoped by `session_id`.

**Output keys** (must match across yaml + pipeline.py + frontend adapters):
- `problems` · `features` · `decompositions` · `tasks` · `prd`

**Memory read keys** (tasks.yaml reads `decompositions`, NOT `decompose`):
- features reads: `problems`
- decompose reads: `problems`, `features`
- tasks reads: `problems`, `features`, `decompositions`
- prd reads: `problems`, `features`, `decompositions`, `tasks`

---

## Agents

Every typed agent lives in `backend/src/services/agents/` and extends `BaseAgent`.
Each overrides `build_prompt()` to inject **only its required context slice**.
Never pass the full state dict to any agent.

| Agent | Receives | Output key |
|---|---|---|
| ProblemsAgent | product_context + ingest | problems |
| FeaturesAgent | product_context + ingest + problems | features |
| DecomposeAgent | product_context + ingest + problems + features | decompositions |
| TasksAgent | problems + features + decompositions | tasks |
| PRDAgent | product_context + problems + features + decompositions + tasks | prd |

**Unwrap pattern** — all agents must unwrap `{"data": [...]}` before use:
```python
def _unwrap(self, val):
    if isinstance(val, dict) and list(val.keys()) == ["data"]:
        return val["data"]
    return val
```

**agent_factory.py** is the only file that maps names to classes.
Do not hardcode agent names anywhere else.

---

## Models

- Default: `claude-sonnet-4-5` (set via `AI_MODEL` env var)
- Features, Decompose, Tasks, PRD: Sonnet only — Haiku truncates output
- Token budgets: features 3000 · decompose 3000 · tasks 4000 · prd 6000

---

## Database (Supabase)

Key tables:
- `sessions` — session identity + metadata
- `session_state` — pipeline snapshot per session (upserted, one row per session)
- `session_events` — append-only event log
- `memory_entries` — scoped by `(session_id, memory_key)` unique index

**Persistence rule**: `_persist_step_memory()` wraps lists as `{"data": [...]}`.
`_unwrap_persisted_content()` reverses this at read time.
Both live in `pipeline.py` — do not duplicate this logic elsewhere.

**Never** add `project_id` to session-scoped memory entries (causes constraint conflicts).

---

## Frontend

- Brand: paper `#F8F4EF` · terra `#E8561B` · sage · charcoal `#0D0D0D`
- Fonts: Georgia (display) · Outfit/DM Sans (body) · Courier (mono)
- State: active session via `useActiveSession()` context + Zustand `useSessionStore`
- Pipeline pages read from `session.state.outputs` on mount
- All pipeline output adapters handle `{"data": [...]}` unwrap client-side

**Pipeline page pattern:**
1. On mount: call `getSession(activeSessionId)` → hydrate from `state.outputs`
2. On generate: call `runPipelineStepOrFull(step, inputData, sessionId)`
3. Adapt raw output through typed adapter function before setting state

---

## Commands

```bash
# Backend
cd backend/src && uvicorn main:app --reload --port 8001

# Frontend
cd frontend && npm run dev

# Tests
cd backend && python -m pytest tests/ -v
cd frontend && npm run test
```

---

## Critical Rules

- No hardcoding anywhere — all agent config lives in YAML
- `agent_factory.py` is the single source of agent name → class mapping
- Memory keys must be consistent: pipeline.yaml output_key = yaml write.key = frontend adapter key
- Do not modify BaseAgent — extend it
- Do not touch Supabase schema without a migration file in `db/migrations/`
- Session-scoped memory: never set project_id
- PRD generation is a terminal step — runs after tasks, not part of the main 4-step loop
- Restart FastAPI after any change to `.yaml` config files