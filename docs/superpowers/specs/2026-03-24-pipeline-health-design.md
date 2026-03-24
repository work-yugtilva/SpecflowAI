# SpecFlow Pipeline Health — 5-Issue Fix Design

**Date:** 2026-03-24
**Status:** Approved
**Source:** Codex Playwright audit findings (P0/P1/P2 severity)

---

## Problem Statement

A Playwright-based audit of SpecFlow revealed five systemic issues preventing the pipeline from producing usable AI output:

1. **P0 — Backend down from browser's POV:** Frontend silently probes `localhost:8001` then `localhost:8000`, falling back to local generation on failure. ERR_CONNECTION_REFUSED is swallowed.
2. **P1 — Semantic pollution in local fallback:** `stringifyValue()` flattens all input including UUIDs and timestamps into problem seeds, producing titles like "bebc4a35 Interview".
3. **P1 — Downstream step pollution:** Features, decompose, and tasks string-expand the garbage problem title, amplifying the error through every step.
4. **P1 — Session bootstrap auth redirect:** "Start Fresh Context" calls `router.push("/context")` which is middleware-protected, bouncing users to `/login`. Additionally, `/sessions` is itself in `PROTECTED_PATHS`, meaning the inline context panel is for authenticated users only.
5. **P2 — UI hides generated data:** Sessions page shows only counts (`problems: 1 item`), not content.

---

## Design

### Approach: Layered Fix (C)

Four layers with clear dependencies. Each layer is independently testable before the next begins.

```
Layer 1: Auth/Bootstrap (frontend)
    ↓
Layer 2: Backend Connectivity (backend + frontend)
    ↓
Layer 3: Validation & Normalization (backend)
    ↓
Layer 4: Inspection UI (frontend)
```

---

### Layer 1: Auth & Bootstrap Flow

**Goal:** Remove `router.push("/context")` redirect from session creation flow.

**Root cause:** In `frontend/app/sessions/page.tsx`, `handleBootstrapChoice("fresh")` calls `router.push("/context")`. The `/context` route is in `PROTECTED_PATHS` in `middleware.ts`, causing a redirect to `/login`.

**Design:**
- **Delete** the `router.push("/context")` call in `handleBootstrapChoice` (line ~510 in `sessions/page.tsx`)
- Replace with inline context panel rendered on the Sessions page (authenticated users only — `/sessions` remains protected)
- Panel shows editable fields: Company Name, Product Name, Product Description, Target Users, Goals, Constraints
- Context changes saved via `saveScopedContext()` on each field blur
- `/context` route remains for direct navigation by authenticated users
- "Run Pipeline" button disabled until context completeness gate is met (defined in Layer 3)

**Files to change:**
- `frontend/app/sessions/page.tsx` — Remove `router.push("/context")` in `handleBootstrapChoice`; add inline context panel component with edit mode

---

### Layer 2: Backend Connectivity & Canonical Endpoint

**Goal:** Single canonical endpoint; backend failure is visible, not silent.

**Design:**
- All session API calls route through `http://localhost:3000/api/sessions/*` (Next.js proxy)
- Next.js routes proxy to FastAPI backend at `http://localhost:8000`
- Remove multi-port probing from `frontend/lib/api/session.ts`
- `BACKEND_URL` default: `process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000"` (FastAPI port, not Next.js)
- If backend returns non-2xx or is unreachable: return 503, show "Backend service is offline. Please start the backend server." banner (orange, dismissible) on Sessions page
- **No silent fallback to local generation**
- `frontend/app/api/pipeline/run/route.ts` (existing local pipeline route): gate behind `NEXT_PUBLIC_USE_LOCAL_PIPELINE=true` env flag. If flag is not set, return 503 with the same offline message. This prevents the local fallback from being reached without the env flag.
- Local pipeline module (`local-session-pipeline.ts`) is not called at runtime unless the env flag is explicitly set

**Files to change (new files are marked CREATE):**
- `frontend/lib/api/session.ts` — Remove `FALLBACK_URLS` array and multi-port probe logic; single `BACKEND_URL`
- `frontend/app/api/sessions/route.ts` — **CREATE:** proxy GET/POST to `${BACKEND_URL}/api/sessions`
- `frontend/app/api/sessions/[session_id]/route.ts` — **CREATE:** proxy GET/POST to `${BACKEND_URL}/api/sessions/{id}`
- `frontend/app/api/sessions/[session_id]/run/route.ts` — **CREATE:** proxy POST to `${BACKEND_URL}/api/sessions/{id}/run`
- `frontend/app/api/sessions/[session_id]/context-preview/route.ts` — Keep `NEXT_PUBLIC_BACKEND_URL` pointing to TypeScript backend (port 3001) for merged context fetch — that endpoint (`/api/context/merged`) only exists there. Update `PIPELINE_URL` default from `http://localhost:8001` to `http://localhost:8000` (canonical FastAPI port). Update `ready` gate logic to check all 4 conditions (see Layer 3 gate conditions).
- `frontend/app/api/pipeline/run/route.ts` — Gate behind `NEXT_PUBLIC_USE_LOCAL_PIPELINE=true`; return 503 if flag not set
- `frontend/app/sessions/page.tsx` — Backend offline banner state + error display

---

### Layer 3: Validation & Normalization

**Goal:** Block execution on bad input; ensure clean data flows between steps.

**Gate Conditions (pipeline blocked if any are true):**
- `companyName` is empty or whitespace
- `productName` is empty or whitespace
- `productDescription` is empty or whitespace
- `ingest` array is empty or missing

**These four conditions must be consistent everywhere they appear:**
- Backend 422 response
- Frontend "Run Pipeline" button disabled state
- `context-preview/route.ts` `ready` field (currently only checks `companyName` + `productName` — must be updated)

**Design:**

**3a. Input gate (backend):**
- In `backend/src/services/pipeline.py`, before the first step executes, validate required fields from merged context + ingest
- Return HTTP 422 with structured error: `{ "error": "INCOMPLETE_CONTEXT", "missing": ["productName", "ingest"] }`
- Frontend translates 422 to user-friendly message per field

**3b. Problem title normalization (backend):**
- Add `normalize_title(text: str) -> str` in `backend/src/services/pipeline.py` (co-located with `validate_output()` which already lives there, not in `base_agent.py`)
- Strips UUID patterns (`[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}`)
- Strips ISO timestamps (`\d{4}-\d{2}-\d{2}T[\d:.]+Z?`)
- Trims to max 10 words
- If result is empty after stripping, exclude the item from output
- Applied inside `validate_output()` for `title` fields

**3c. Inter-step data contracts (backend):**

Currently `decompose.yaml` and `tasks.yaml` have no `memory` block — they receive the full session state as context, not typed slices. This allows pollution from prior steps.

Pipeline key derivation: `pipeline.py` uses `step_cfg.get("output_key", agent_name)` as fallback. Since no step in `pipeline.yaml` sets `output_key`, all keys equal the agent name. Therefore:
- Problems agent → writes to key `"problems"`
- Features agent → writes to key `"features"` (explicitly set in `features.yaml` `memory.write.key`)
- Decompose agent → writes to key `"decompose"` (agent name fallback — no memory block currently)
- Tasks agent → writes to key `"tasks"` (agent name fallback — no memory block currently)

Add **both** `memory.read` AND `memory.write` blocks to decompose and tasks (without `memory.write`, `MemoryManager.write_from_agent()` is a no-op for these agents):

- **Features** (already has memory read+write — verify key):
  - Reads `memory["problems"]` → structured objects with fields: `id`, `title`, `description`, `research_evidence`
  - Write key: `"features"` (already set)

- **Decompose** (add full memory block):
  ```yaml
  memory:
    read:
      strategy: top_k
      keys:
        features: 5
    write:
      key: decompose
      mode: overwrite
  ```
  - Reads `memory["features"]` → structured objects: `id`, `title`, `acceptance_criteria`
  - Write key must be `"decompose"` to match pipeline key derivation

- **Tasks** (add full memory block):
  ```yaml
  memory:
    read:
      strategy: top_k
      keys:
        decompose: 5
    write:
      key: tasks
      mode: overwrite
  ```
  - Reads `memory["decompose"]` → structured objects from decompose.yaml schema: `id`, `title`, `layer`, `user_problem_it_solves`
  - Key `"decompose"` matches what the decompose agent writes

**Output schema field reference (confirmed from YAML files):**
- `problems.yaml`: `id`, `title`, `description`, `severity`, `research_evidence`
- `features.yaml`: `id`, `title`, `description`, `priority`, `acceptance_criteria`, `research_evidence`, `linked_problems`
- `decompose.yaml`: `id`, `title`, `description`, `layer`, `user_problem_it_solves`, `priority`, `acceptance_criteria`, `research_evidence`
- `tasks.yaml`: `id`, `title`, `description`, `layer`, `user_problem_it_solves`, `priority`, `acceptance_criteria`, `research_evidence`

**Note on `pipeline/run/route.ts` local key mismatch:** The local pipeline route maps decompose output to key `"decompositions"` (not `"decompose"`). Fix this key to `"decompose"` in `pipeline/run/route.ts` as part of Layer 2, even though the route is gated behind an env flag, to prevent development-mode inconsistency.

**Files to change:**
- `backend/src/services/pipeline.py` — Input gate before step 0; `normalize_title()` function; updated `validate_output()` calling `normalize_title` on title fields
- `backend/config/agents/problems.yaml` — Add title max-length annotation to output_schema instructions
- `backend/config/agents/features.yaml` — Verify memory read block uses correct key `"problems"`
- `backend/config/agents/decompose.yaml` — Add `memory.read` (features) + `memory.write` (key: decompose) block
- `backend/config/agents/tasks.yaml` — Add `memory.read` (decompose) + `memory.write` (key: tasks) block
- `frontend/app/api/sessions/[session_id]/context-preview/route.ts` — Update `ready` to check all 4 gate conditions

---

### Layer 4: Inline Inspection UI

**Goal:** Surface generated outputs inline on Sessions page without route navigation.

**Data source:** `SessionDetail.state.outputs` object, fetched by the existing session detail call. The `outputs` object has keys matching step names: `problems`, `features`, `decompose`, `tasks`. Each value is an array of items.

**Existing component note:** An `OutputInspector`-style collapsible with raw JSON already exists in `sessions/page.tsx` (lines ~307-349). `StepInspector` replaces or extends this — it renders structured field cards instead of raw JSON, while keeping the "Copy JSON" raw export. Implementer should check whether to extend the existing component or replace it.

**Design:**
- Each completed step shows an expand toggle (collapsed: step name + count; expanded: `StepInspector`)
- `StepInspector` renders field cards per item using only fields confirmed to exist in the output schema:
  - **Problems:** `title`, `severity`, `description` (not `frequency` — not in output schema)
  - **Features:** `title`, `priority`, `acceptance_criteria`
  - **Tasks:** `title`, `layer`, `user_problem_it_solves` (fields confirmed in `tasks.yaml` output schema)
  - **Decompose:** `title`, `layer`, `user_problem_it_solves` (fields confirmed in `decompose.yaml` output schema)
- Quality flag callout: items with `quality_flag: "low_confidence"` show orange badge. `quality_issues` list shown in a collapsed sub-section, not inline, to avoid cluttering the production UI. Users expand per-item if they want to see raw validation strings.
- "Copy JSON" button per step: copies raw `outputs[step]` to clipboard
- Design system: paper/terra/sage/charcoal palette, Outfit font, existing card/border styles

**Files to change:**
- `frontend/components/StepInspector.tsx` — **CREATE:** collapsible component with field cards, quality badge, copy-JSON button
- `frontend/app/sessions/page.tsx` — Import `StepInspector`; wire per completed step using `sessionDetail.state.outputs`

---

## Data Flow After Fix

```
Authenticated user on /sessions
  → Inline context panel (Layer 1): fill required fields + upload ingest
  → "Run Pipeline" enabled when all 4 gate conditions met
  → POST /api/sessions/{id}/run (Layer 2: Next.js proxy to FastAPI port 8000)
  → Backend validates context + ingest presence (Layer 3a gate, HTTP 422 if invalid)
  → Problems step: titles normalized, UUIDs/timestamps stripped (Layer 3b)
  → Features step: reads memory["problems"] structured objects (Layer 3c)
  → Decompose step: reads memory["features"] structured objects (Layer 3c)
  → Tasks step: reads memory["decompose"] structured objects (Layer 3c, key = "decompose")
  → Sessions page: StepInspector per completed step (Layer 4)
```

---

## Gate Conditions Summary

| Condition | Backend | Frontend (button) | context-preview `ready` |
|-----------|---------|-------------------|------------------------|
| `companyName` non-empty | HTTP 422 | Disabled | Yes (update) |
| `productName` non-empty | HTTP 422 | Disabled | Yes (update) |
| `productDescription` non-empty | HTTP 422 | Disabled | Yes (add) |
| `ingest` non-empty | HTTP 422 | Disabled | Yes (add) |

All four locations must enforce all four conditions consistently.

---

## Out of Scope

- Removing `local-session-pipeline.ts` entirely (kept, gated behind `NEXT_PUBLIC_USE_LOCAL_PIPELINE=true`)
- New authentication system or changing which routes are protected
- Separate debug/admin page
- Multi-session comparison view
- Changes to the TypeScript backend (port 3001) — it is the correct home for `/api/context/merged` and remains in use by `context-preview/route.ts`
