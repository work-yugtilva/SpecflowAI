# SpecFlow v2 — CLAUDE.md

## SYSTEM OVERRIDE: CORE DIRECTIVES
**CRITICAL: As an AI assistant, you are strictly bound by the Skill Workflow below. You MUST autonomously invoke the corresponding `/commands` or tools for the task at hand BEFORE writing any code or modifying any files. If you cannot invoke the tool yourself, you MUST halt and explicitly ask the user to run it.**

## Project Identity
SpecFlow v2 is an AI-powered product management automation platform.
Stack: Next.js 14 (App Router) · FastAPI · Supabase · Anthropic SDK · Google ADK.
Target: Product managers at Series A–B startups.
Pricing: $49/month Pro · $199/month Team.
Evaluation lens: "Can I charge $49/month for this today?" — not "Is the code clean?"

---

## MANDATORY SKILL WORKFLOW — STOP AND EXECUTE

**RULE: You are FORBIDDEN from writing code, modifying files, or finalizing a PR without explicitly triggering the relevant gate below.**

### Gate 1 — Planning any feature or change
`/everything-claude-code:plan`
**Trigger Condition:** Whenever you are asked to start a new feature, bug fix, or refactor.
**Action:** You MUST execute this command. Do not write code until a written plan is outputted, including files to touch, files NOT to touch, and verification steps.

### Gate 2 — Implementing a feature (full dev workflow)
`/everything-claude-code:tdd`
**Trigger Condition:** When writing the actual code for a feature.
**Action:** You MUST execute this command to enforce Test-Driven Development. Write the test -> verify it fails -> implement -> verify it passes.

### Gate 3 — Any frontend work (components, pages, UI, CSS)
`/frontend-design (read /mnt/skills/public/frontend-design/SKILL.md)`
**Trigger Condition:** Before touching ANY React component, layout, or CSS file.
**Action:** You MUST read the design skill first to enforce the brand system. Never guess the aesthetics.

### Gate 4 — Any security-sensitive change
`/everything-claude-code:security-review`
**Trigger Condition:** Modifying auth, API routes, Supabase RLS, JWTs, env vars, or CORS.
**Action:** You MUST execute this command to generate a threat model and mitigations BEFORE pushing the code.

### Gate 5 — Finishing a branch / PR readiness
`/everything-claude-code:verification-before-completion`
**Trigger Condition:** When the user asks if a task is done, or before you declare completion.
**Action:** You MUST execute this command to confirm tests pass, untouched files remain untouched, and grep verifications succeed.

### Gate 6 — Code review of output
`/everything-claude-code:receiving-code-review`
**Trigger Condition:** Immediately after writing/modifying code blocks.
**Action:** You MUST execute this to self-review your own diff for quality and consistency.

### Gate 7 — Complex orchestration / multi-step tasks
`/gstack`
**Trigger Condition:** Tasks spanning multiple files, services, or parallel subagents.
**Action:** Execute this to access `/plan-eng-review`, `/plan-ceo-review`, `/browse`, `/review`, and `/ship`.

---

## Skill → Task Mapping (STRICT ADHERENCE REQUIRED)

Before starting a task, state your workflow path out loud:
* **New feature (backend):** plan → tdd → security-review → verification-before-completion → receiving-code-review
* **New feature (frontend):** plan → frontend-design → tdd → verification-before-completion → receiving-code-review
* **Bug fix:** plan → tdd → verification-before-completion
* **Security fix:** plan → security-review → tdd → verification-before-completion
* **Refactor:** plan → tdd → verification-before-completion → receiving-code-review
* **New page / component:** plan → frontend-design → verification-before-completion
* **Multi-service task:** gstack → plan → tdd → verification-before-completion
* **Auth / RLS / env change:** plan → security-review → verification-before-completion

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

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
