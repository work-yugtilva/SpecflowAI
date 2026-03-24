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
4. **P1 — Session bootstrap auth redirect:** "Start Fresh Context" pushes to `/context` which is middleware-protected, bouncing unauthenticated users to `/login`.
5. **P2 — UI hides generated data:** Sessions page shows only counts (`problems: 1 item`), not content. Review requires navigating to individual step pages.

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

**Goal:** Remove `/login` redirect from session creation flow.

**Design:**
- Inline context editing on Sessions page (no redirect to `/context`)
- "Complete Your Context" panel with editable fields: Company, Product Name, Product Description, Target Users, Goals, Constraints
- Context changes saved via existing `saveScopedContext()` API call
- `/context` route remains protected for authenticated users accessing it directly
- "Run Pipeline" button gated on context completeness (same gate as Layer 3)

**Files to change:**
- `frontend/app/sessions/page.tsx` — Add inline context panel with edit mode
- `frontend/middleware.ts` — No change (keep `/context` protected; Sessions page is already accessible)

---

### Layer 2: Backend Connectivity & Canonical Endpoint

**Goal:** Single canonical endpoint; backend failure is visible, not silent.

**Design:**
- All session API calls route through `http://localhost:3000/api/sessions/*` (Next.js proxy)
- Next.js routes forward to FastAPI backend at `http://localhost:8000`
- Remove multi-port probing from `frontend/lib/api/session.ts`
- If backend returns non-2xx or is unreachable: return 503, show "Backend service is offline. Please start the backend server." banner (orange, dismissible) at top of Sessions page
- No silent fallback to local generation
- Local pipeline module (`local-session-pipeline.ts`) is NOT called at runtime — it remains as code but is gated behind an explicit `NEXT_PUBLIC_USE_LOCAL_PIPELINE=true` env flag for development only

**Files to change:**
- `frontend/lib/api/session.ts` — Remove `FALLBACK_URLS`, single `BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:3000"`
- `frontend/app/api/sessions/route.ts` — Proxy GET/POST to FastAPI
- `frontend/app/api/sessions/[session_id]/route.ts` — Proxy GET/POST to FastAPI
- `frontend/app/api/sessions/[session_id]/run/route.ts` — Proxy POST to FastAPI
- `frontend/app/sessions/page.tsx` — Backend offline banner state
- `frontend/app/error.tsx` — Backend offline fallback page

---

### Layer 3: Validation & Normalization

**Goal:** Block execution on bad input; ensure clean data flows between steps.

**Gate Conditions (pipeline blocked if any are true):**
- `companyName` is empty or whitespace
- `productName` is empty or whitespace
- `productDescription` is empty or whitespace
- `ingest` array is empty or missing

**Design:**

**3a. Input gate (backend):**
- In `pipeline.py`, before the first step executes, validate required fields from merged context + ingest
- Return HTTP 422 with structured error: `{ "error": "INCOMPLETE_CONTEXT", "missing": ["productName", "ingest"] }`
- Frontend translates 422 to user-friendly messages per field

**3b. Problem title normalization (backend):**
- Add `normalize_title(text: str) -> str` in `base_agent.py`
- Strips UUID patterns (`[a-f0-9]{8}-[a-f0-9]{4}-...`)
- Strips ISO timestamps (`\d{4}-\d{2}-\d{2}T...`)
- Trims to max 10 words
- If result is empty after stripping, reject the item (do not include in output)
- Applied in `validate_output()` after each step

**3c. Typed inter-step data contracts (backend):**
- Features step reads from `memory["problems"]` as structured objects: `{ id, title, description, severity }`
- Decompose step reads from `memory["features"]` as structured objects: `{ id, title, acceptance_criteria }`
- Tasks step reads from `memory["decompositions"]` as structured objects: `{ id, node_name, type }`
- Agent YAML configs updated to reference structured fields, not full string serializations

**Files to change:**
- `backend/src/services/pipeline.py` — Input gate before step 0
- `backend/src/services/agents/base_agent.py` — `normalize_title()`, updated `validate_output()`
- `backend/config/agents/problems.yaml` — Title max-length constraint in output_schema
- `backend/config/agents/features.yaml` — Read from structured problem fields
- `backend/config/agents/decompose.yaml` — Read from structured feature fields
- `backend/config/agents/tasks.yaml` — Read from structured decomposition fields

---

### Layer 4: Inline Inspection UI

**Goal:** Surface generated outputs inline on Sessions page without route navigation.

**Design:**
- Each completed step (Problems, Features, Tasks, Decompose) shows an expand toggle
- Collapsed state: step name + count badge (existing behavior)
- Expanded state: `StepInspector` component renders field cards per item
- Field cards (step-specific):
  - **Problems:** `title`, `severity`, `frequency`
  - **Features:** `title`, `priority`, `acceptance_criteria`
  - **Tasks:** `title`, `complexity`, `linked_feature`
  - **Decompose:** node name + type
- Quality flag callout: items with `quality_flag: "low_confidence"` show orange badge + expandable `quality_issues` list
- "Copy JSON" button per step: copies raw step output to clipboard
- Design system: paper/terra/sage/charcoal palette, Outfit font, existing card styles

**Files to change:**
- `frontend/components/StepInspector.tsx` — New component
- `frontend/app/sessions/page.tsx` — Import and wire `StepInspector` per completed step

---

## Data Flow After Fix

```
User on /sessions
  → Inline context panel (Layer 1): fill required fields + upload ingest
  → "Run Pipeline" enabled when gate conditions met (Layer 3 gate surfaced in UI)
  → POST /api/sessions/{id}/run (Layer 2: canonical endpoint, fail loud)
  → Backend validates context + ingest (Layer 3a gate)
  → Problems step: clean titles, UUIDs stripped (Layer 3b)
  → Features step: reads memory["problems"] fields (Layer 3c)
  → Decompose step: reads memory["features"] fields (Layer 3c)
  → Tasks step: reads memory["decompositions"] fields (Layer 3c)
  → Sessions page: collapsible StepInspector per step (Layer 4)
```

---

## Gate Conditions Summary

| Condition | Checked At | Error |
|-----------|-----------|-------|
| `companyName` non-empty | Backend (422) + Frontend (disabled Run button) | "Company name is required" |
| `productName` non-empty | Backend (422) + Frontend (disabled Run button) | "Product name is required" |
| `productDescription` non-empty | Backend (422) + Frontend (disabled Run button) | "Product description is required" |
| `ingest` non-empty | Backend (422) + Frontend (disabled Run button) | "Upload at least one research document" |

---

## Out of Scope

- Removing `local-session-pipeline.ts` entirely (kept, gated behind env flag)
- New authentication system
- New database schema
- Separate debug/admin page
- Multi-session comparison view
