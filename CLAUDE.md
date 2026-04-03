# SpecFlow v2 — CLAUDE.md

## Project Identity
SpecFlow v2 is an AI-powered product management automation platform.
Stack: Next.js 14 (App Router) · FastAPI · Supabase · Anthropic SDK · Google ADK.
Target: Product managers at Series A–B startups.
Pricing: $49/month Pro · $199/month Team.
Evaluation lens: "Can I charge $49/month for this today?" — not "Is the code clean?"

---

## MANDATORY SKILL WORKFLOW — READ BEFORE EVERY TASK

**These are not optional. Run the correct skill gate before writing a single line of code.**

### Gate 1 — Planning any feature or change
```
/everything-claude-code:plan
```
Run before starting any feature, bug fix, refactor, or architectural change.
Output: a written plan with files to touch, files NOT to touch, and verification steps.
Do not proceed without an approved plan.

### Gate 2 — Implementing a feature (full dev workflow)
```
/everything-claude-code:tdd
```
Run when implementing any new feature or behaviour. Write the test first, confirm it fails,
then implement, then confirm it passes. No feature ships without tests.

### Gate 3 — Any frontend work (components, pages, UI, CSS)
```
/frontend-design (read /mnt/skills/public/frontend-design/SKILL.md)
```
Run before touching ANY frontend file. This includes new components, page rebuilds,
styling changes, and layout work. The skill enforces the brand system below.
Never produce generic AI aesthetics. Every UI decision must be intentional.

### Gate 4 — Any security-sensitive change
```
/everything-claude-code:security-review
```
Run before touching: auth middleware, API routes, Supabase RLS, JWT handling,
environment variables, CORS config, any user-facing input handling.
Output: threat model + specific mitigations applied.

### Gate 5 — Finishing a branch / PR readiness
```
/everything-claude-code:verification-before-completion
```
Run before declaring any task done. Confirms: tests pass, no regressions,
files-not-to-touch were not touched, verification grep commands return expected results.

### Gate 6 — Code review of output
```
/everything-claude-code:receiving-code-review
```
Run after implementing to self-review the diff for quality, correctness, and consistency
with SpecFlow conventions before presenting output.

### Gate 7 — Complex orchestration / multi-step tasks
```
/gstack
```
Use for tasks that span multiple files, services, or require parallel subagent work.
Provides /plan-eng-review, /plan-ceo-review, /browse, /review, /ship commands.

---

## Skill → Task Mapping (quick reference)

| Task type | Required skills (in order) |
|---|---|
| New feature (backend) | plan → tdd → security-review → verification-before-completion → receiving-code-review |
| New feature (frontend) | plan → frontend-design → tdd → verification-before-completion → receiving-code-review |
| Bug fix | plan → tdd → verification-before-completion |
| Security fix | plan → security-review → tdd → verification-before-completion |
| Refactor | plan → tdd → verification-before-completion → receiving-code-review |
| New page / component | plan → frontend-design → verification-before-completion |
| Multi-service task | gstack → plan → tdd → verification-before-completion |
| Auth / RLS / env change | plan → security-review → verification-before-completion |

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
        │   ├── agent_factory.py       # Agent dispatch map — ONLY file with hardcoded names
        │   ├── memory/                # MemoryStore, MemoryManager, MemoryRepository
        │   ├── session/               # SessionManager, SessionRepository
        │   └── config/                # YAML loaders, schemas, env
        └── config/agents/             # problems.yaml, features.yaml, decompose.yaml, tasks.yaml, prd.yaml
```

---

## Pipeline

4-step sequential pipeline orchestrated by Google ADK:

```
product_context → problems → features → decompose → tasks → [prd]
```

Each step writes to Supabase `memory_entries` scoped by `session_id`.

**Output keys** (must match across yaml + pipeline.py + frontend adapters):
- `product_context` · `problems` · `features` · `decompositions` · `tasks` · `prd`

**Memory read keys**:
- features reads: `problems`
- decompose reads: `problems`, `features`
- tasks reads: `problems`, `features`, `decompositions`  ← NOT `decompose`
- prd reads: `problems`, `features`, `decompositions`, `tasks`

---

## Agents

Every typed agent lives in `backend/src/services/agents/` and extends `BaseAgent`.
Each overrides `build_prompt()` to inject **only its required context slice**.
Never pass the full state dict to any agent.

| Agent | Receives | Output key |
|---|---|---|
| ProductContextAgent | ingest + user context | product_context |
| ProblemsAgent | product_context + ingest | problems |
| FeaturesAgent | product_context + ingest + problems | features |
| DecomposeAgent | product_context + ingest + problems + features | decompositions |
| TasksAgent | problems + features + decompositions | tasks |
| PRDAgent | product_context + problems + features + decompositions + tasks | prd |
| QualityGateAgent | step output + research_context | quality result |
| LinearSyncAgent | tasks | linear_payload |

**Unwrap pattern** — all agents must unwrap `{"data": [...]}` before use:
```python
def _unwrap(self, val):
    if isinstance(val, dict) and list(val.keys()) == ["data"]:
        return val["data"]
    return val
```

`agent_factory.py` is the ONLY file that maps agent names to classes.
Do not hardcode agent names anywhere else — ever.

---

## Models

- Default: `claude-sonnet-4-5` (set via `AI_MODEL` env var)
- Features, Decompose, Tasks, PRD: Sonnet only — Haiku truncates output
- Token budgets: features 3000 · decompose 3000 · tasks 4000 · prd 6000
- AI regeneration cap: 3 per step (cost control — do not remove)

---

## Database (Supabase)

Key tables:
- `sessions` — session identity + metadata
- `session_state` — pipeline snapshot per session (upserted, one row per session)
- `session_events` — append-only event log
- `memory_entries` — scoped by `(session_id, memory_key)` unique index
- `quality_scores` — per-step rubric results
- `user_integrations` — OAuth tokens (Linear etc.)
- `product_profiles` — cross-session product context

**Persistence rule**: `_persist_step_memory()` wraps lists as `{"data": [...]}`.
`_unwrap_persisted_content()` reverses this at read time.
Both live in `pipeline.py` — do not duplicate this logic elsewhere.

**Never** add `project_id` to session-scoped memory entries (causes constraint conflicts).
**Never** touch Supabase schema without a migration file in `db/migrations/`.

---

## Frontend — Brand System (NON-NEGOTIABLE)

Always read `/mnt/skills/public/frontend-design/SKILL.md` before any frontend work.

**Colors:**
- paper: `#F8F4EF` (background)
- terra: `#E8561B` (primary accent — CTAs, active states, highlights)
- sage: `#3D6B5E` (secondary)
- charcoal: `#0D0D0D` (text, dark elements)
- Border: `#E4DDD4` · Muted text: `#6B6B6B` · Subtle: `#9E9E9E`

**Fonts (CSS variables already loaded in layout.tsx):**
- `var(--font-instrument)` — Instrument Serif — display headings, hero text
- `var(--font-dm-sans)` — DM Sans — body, labels, UI text
- `'Courier New', monospace` — code, data, IDs

**Aesthetic:** editorial glassmorphism. Warm, tactile, not corporate SaaS.
Match the visual language of the existing sidebar, header, and pipeline pages.
Never use Inter, Roboto, Arial, or purple gradients.

**State management:**
- Active session: `useActiveSession()` context + Zustand `useSessionStore`
- Pipeline pages read from `session.state.outputs` on mount
- All pipeline output adapters handle `{"data": [...]}` unwrap client-side

**Pipeline page pattern (all step pages must follow this exactly):**
1. On mount: `getSession(activeSessionId)` → hydrate from `state.outputs`
2. On generate: `runPipelineStepOrFull(step, inputData, sessionId)`
3. Adapt raw output through typed adapter function before setting state

---

## Security Rules (enforced by /security-review gate)

- `verify_supabase_jwt` must be async — never use blocking `httpx.get()`
- All FastAPI routes require `auth: AuthContext = Depends(require_auth_context)`
- MemoryRepository in PRD endpoints must use `client=auth.client` (RLS enforced)
- Rate limiting: AI endpoints `10/minute`, default `60/minute` (slowapi)
- Request body limit: 512KB max (RequestBodySizeLimitMiddleware)
- Linear sync route: ALLOWED_OPERATIONS Set whitelist enforced before any fetch
- `optionalAuth` in Express middleware: must remain deleted (dead code liability)
- Environment variables: validated at startup via `validate_required_env()` before first request
- No `str(e)` error leaks to API responses — all exceptions return generic messages to client

---

## Critical Rules (violations block PR merge)

- No hardcoding anywhere — all agent config lives in YAML
- `agent_factory.py` is the single source of agent name → class mapping
- Memory keys must be consistent: `pipeline.yaml output_key` = `yaml write.key` = frontend adapter key
- Do not modify `BaseAgent` — extend it
- Do not touch Supabase schema without a migration file
- Session-scoped memory: never set `project_id`
- PRD generation is terminal — runs after tasks, not part of the 4-step loop
- Restart FastAPI after any change to `.yaml` config files
- LLM Chain-of-Thought `reasoning` fields are stripped before DB persistence
- Never pass full state dict to any agent's `build_prompt()`

---

## Verification Pattern (every task must include these)

Each task prompt must specify:
1. **Files to touch** — explicit list
2. **Files NOT to touch** — explicit list
3. **Grep verification commands** — at least 2, with expected output
4. **End-to-end test step** — manual or automated

Example:
```
Verification:
- grep -n "async def verify_supabase_jwt" backend/src/services/db/supabase_client.py → 1 result
- grep -n "httpx.get" backend/src/services/db/supabase_client.py → 0 results
- cd backend && python -m pytest tests/test_health.py -v → all pass
```

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
cd frontend && npm run e2e

# Type check
cd frontend && npm run type-check
cd backend && python -m mypy src/main.py
```

---

## PRD Quality Standard

Evaluate all PRD output through a senior PM lens:
- Goals: must have metric + target + timeline (not vague objectives)
- Acceptance criteria: machine-readable, past-tense, testable thresholds
- Risks: must have likelihood + mitigation (not just a list)
- Success metrics: must have baseline + target + measurement method
- Current quality range: 58–84/100 — target 80+ before shipping to users