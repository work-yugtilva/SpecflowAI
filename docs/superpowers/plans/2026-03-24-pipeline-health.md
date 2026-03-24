# SpecFlow Pipeline Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five pipeline issues (backend connectivity, semantic pollution, auth redirect, step data contracts, hidden outputs) so SpecFlow produces real AI-generated product specs.

**Architecture:** Four layers in dependency order — Layer 1 fixes auth bootstrap, Layer 2 establishes a canonical backend endpoint with fail-loud behavior, Layer 3 adds input gates and normalization in the Python pipeline, Layer 4 surfaces generated outputs inline on the Sessions page.

**Tech Stack:** Next.js 14 (TypeScript, React), FastAPI (Python), YAML agent configs, Pydantic

---

## File Map

| File | Action | Layer |
|------|--------|-------|
| `frontend/app/sessions/page.tsx` | Modify | 1, 2, 4 |
| `frontend/lib/api/session.ts` | Modify | 2 |
| `frontend/app/api/sessions/route.ts` | **CREATE** | 2 |
| `frontend/app/api/sessions/[session_id]/route.ts` | **CREATE** | 2 |
| `frontend/app/api/sessions/[session_id]/run/route.ts` | **CREATE** | 2 |
| `frontend/app/api/sessions/[session_id]/context-preview/route.ts` | Modify | 2, 3 |
| `frontend/app/api/pipeline/run/route.ts` | Modify | 2 |
| `frontend/components/StepInspector.tsx` | **CREATE** | 4 |
| `backend/src/services/pipeline.py` | Modify | 3 |
| `backend/config/agents/problems.yaml` | Modify | 3 |
| `backend/config/agents/features.yaml` | Modify | 3 |
| `backend/config/agents/decompose.yaml` | Modify | 3 |
| `backend/config/agents/tasks.yaml` | Modify | 3 |

---

## Task 1: Fix Bootstrap Auth Redirect (Layer 1)

**Files:**
- Modify: `frontend/app/sessions/page.tsx:510`

The `handleBootstrapChoice("fresh")` path calls `router.push("/context")` which is middleware-protected. Replace it with a no-op — the existing inline context panel on the Sessions page (already built) is the replacement.

- [ ] **Step 1: Remove the redirect**

In `frontend/app/sessions/page.tsx`, find the `handleBootstrapChoice` function (around line 491). Replace:
```typescript
        router.push("/context");
```
With:
```typescript
        // Context editing is handled inline on the Sessions page
```
(Keep all surrounding code — only remove the `router.push("/context")` line.)

- [ ] **Step 2: Verify the change**

Run: `grep -n "router.push.*context" frontend/app/sessions/page.tsx`
Expected: no output (line removed)

- [ ] **Step 3: Commit**

```bash
git add frontend/app/sessions/page.tsx
git commit -m "fix: remove router.push('/context') bootstrap redirect (auth loop)"
```

---

## Task 2: Gate Local Pipeline Route Behind Env Flag (Layer 2)

**Files:**
- Modify: `frontend/app/api/pipeline/run/route.ts`

The local pipeline route calls the Anthropic SDK directly with no backend — it's the silent fallback. Gate it so it only runs when `NEXT_PUBLIC_USE_LOCAL_PIPELINE=true`. Also fix the output key mismatch: `decompose` maps to `"decompositions"` currently — change to `"decompose"`.

- [ ] **Step 1: Add env flag gate + fix key mismatch**

Replace the entire `frontend/app/api/pipeline/run/route.ts` with:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const USE_LOCAL = process.env.NEXT_PUBLIC_USE_LOCAL_PIPELINE === "true";

const ROLE = "senior product manager with 10 years of B2B SaaS experience";

const TASKS: Record<string, string> = {
  problems:
    "Identify between 3 and 7 specific, distinct user problems grounded in the research context above. Each problem must be something a real user encounters — not a feature request. Every problem must reference evidence from the research context.",
  features:
    "Generate between 4 and 8 product features that directly address the problems identified. Each feature must solve a specific user problem and be grounded in the research context. Every feature must reference evidence from the research.",
  decompose:
    "Decompose the product features into between 6 and 12 concrete technical components. Each component must map to a specific layer (ui, backend, or system) and directly address a user problem. Every component must reference evidence from the research.",
  tasks:
    "Generate between 8 and 15 implementation tasks derived from the decomposed components. Each task title must start with an imperative verb. Every task must reference evidence from the research and have verifiable acceptance criteria written in past tense.",
};

const SCHEMAS: Record<string, object[]> = {
  problems: [
    {
      id: "string",
      title: "string (max 10 words)",
      description: "string (2-3 sentences, specific and grounded in research)",
      user_problem_it_solves: "string",
      severity: "high | medium | low",
      acceptance_criteria: "string (measurable, not vague)",
      research_evidence: "string (direct reference from input research)",
    },
  ],
  features: [
    {
      id: "string",
      title: "string (max 10 words)",
      description: "string (2-3 sentences, specific and grounded in research)",
      user_problem_it_solves: "string",
      priority: "high | medium | low",
      acceptance_criteria: "string (measurable, not vague)",
      research_evidence: "string (direct reference from input research)",
    },
  ],
  decompose: [
    {
      id: "string",
      title: "string (max 10 words)",
      description: "string (2-3 sentences, specific and grounded in research)",
      layer: "ui | backend | system",
      user_problem_it_solves: "string",
      priority: "high | medium | low",
      acceptance_criteria: "string (measurable, not vague)",
      research_evidence: "string (direct reference from input research)",
    },
  ],
  tasks: [
    {
      id: "string",
      title: "string (imperative verb, max 10 words)",
      description: "string (2-3 sentences, specific and grounded in research)",
      layer: "frontend | backend | system",
      user_problem_it_solves: "string",
      priority: "high | medium | low",
      acceptance_criteria: "string (past tense, verifiable)",
      research_evidence: "string (direct reference from input research)",
    },
  ],
};

// Key names must match what pipeline.py uses (agent name as fallback key)
const OUTPUT_KEYS: Record<string, string> = {
  problems: "problems",
  features: "features",
  decompose: "decompose",   // was "decompositions" — fixed to match backend key
  tasks: "tasks",
};

export async function POST(req: NextRequest) {
  if (!USE_LOCAL) {
    return NextResponse.json(
      { error: "Backend service is offline. Please start the backend server." },
      { status: 503 }
    );
  }

  try {
    const { step, inputData } = (await req.json()) as {
      step: string;
      inputData: { context?: Record<string, unknown>; research?: unknown[]; ingest?: unknown[] };
    };

    const taskPrompt = TASKS[step];
    const schema = SCHEMAS[step];
    if (!taskPrompt || !schema) {
      return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const contextStr = JSON.stringify(inputData?.context ?? {}, null, 2);
    const schemaStr = JSON.stringify(schema, null, 2);

    const prompt =
      `ROLE: You are a ${ROLE}.\n\n` +
      `CONTEXT:\n${contextStr}\n\n` +
      `TASK: ${taskPrompt}\n\n` +
      `OUTPUT FORMAT: Return ONLY a JSON array. No preamble. No markdown. No explanation.\n${schemaStr}`;

    const message = await client.messages.create({
      model: process.env.AI_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed: unknown[] = JSON.parse(cleaned);

    const outputKey = OUTPUT_KEYS[step] ?? step;
    return NextResponse.json({ outputs: { [outputKey]: parsed } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/pipeline/run] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify key fix**

Run: `grep "decompose" frontend/app/api/pipeline/run/route.ts`
Expected: `decompose: "decompose",` (not "decompositions")

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/pipeline/run/route.ts
git commit -m "fix: gate local pipeline route behind USE_LOCAL env flag; fix decompose key"
```

---

## Task 3: Create Next.js Proxy Routes for Sessions API (Layer 2)

**Files:**
- Create: `frontend/app/api/sessions/route.ts`
- Create: `frontend/app/api/sessions/[session_id]/route.ts`
- Create: `frontend/app/api/sessions/[session_id]/run/route.ts`

These proxy all session requests to the FastAPI backend at port 8000.

**Important:** The FastAPI backend has NO `/api/` prefix on its session routes. They are at root level:
- `GET /sessions` (plural)
- `POST /session/create` (singular)
- `GET /session/{id}` (singular)
- `POST /session/{id}/run` (singular)

The spec text mentions `/api/sessions` — that refers to the Next.js proxy URL, not the FastAPI backend URL. The proxy routes below use the correct root-level FastAPI paths.

- [ ] **Step 1: Create sessions list/create proxy**

Create `frontend/app/api/sessions/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/sessions`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Backend service is offline. Please start the backend server." },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/session/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Backend service is offline. Please start the backend server." },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 2: Create session detail proxy**

Create `frontend/app/api/sessions/[session_id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  try {
    const res = await fetch(`${BACKEND_URL}/session/${params.session_id}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Backend service is offline. Please start the backend server." },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 3: Create session run proxy**

Create `frontend/app/api/sessions/[session_id]/run/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";

export async function POST(
  req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/session/${params.session_id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Backend service is offline. Please start the backend server." },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 4: Verify files exist**

Run: `ls frontend/app/api/sessions/`
Expected: `route.ts  [session_id]/`

Run: `ls frontend/app/api/sessions/[session_id]/`
Expected: `context-preview/  route.ts  run/`

- [ ] **Step 5: Commit**

```bash
git add frontend/app/api/sessions/
git commit -m "feat: add Next.js proxy routes for sessions API (canonical endpoint)"
```

---

## Task 4: Simplify session.ts to Single Endpoint (Layer 2)

**Files:**
- Modify: `frontend/lib/api/session.ts`

Remove `FALLBACK_PIPELINE_URLS`, `fetchWithFallback`, and the `_sessionMode` local-fallback tracking. All calls go to the Next.js proxy routes (which internally hit port 8000).

- [ ] **Step 1: Rewrite session.ts**

Replace `frontend/lib/api/session.ts` with:

```typescript
// lib/api/session.ts — Client for the session system API routes (proxied via Next.js)

const API_BASE = "/api/sessions";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let text = res.statusText;
    try {
      const body = await res.json();
      text = body.error ?? text;
    } catch {}
    throw new Error(text);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionCreated {
  session_id: string;
  session_name: string;
  status: string;
  created_at: string | null;
}

export interface SessionRunResponse {
  success: boolean;
  data: Record<string, unknown>;
  session_state: Record<string, unknown> | null;
}

export interface SessionEvent {
  id: string;
  session_id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface SessionStateSnapshot {
  id?: string;
  session_id: string;
  state: {
    last_completed_step?: string;
    outputs?: Record<string, unknown>;
  };
  step: string | null;
}

export interface SessionDetail {
  session: {
    id: string;
    session_name: string;
    status: string;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  state: SessionStateSnapshot | null;
  events: SessionEvent[];
}

export interface SessionSummary {
  id: string;
  session_name: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export interface PipelineRunSummary {
  id: string;
  session_id: string | null;
  status: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  current_step: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ─── Session Mode (always "remote" — local fallback removed) ──────────────────

/** Always returns "remote". Local fallback has been removed. */
export function getLastSessionMode(): "remote" | "local" {
  return "remote";
}

// ─── Session API Functions ────────────────────────────────────────────────────

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${API_BASE}`);
  const body = await handleResponse<{ sessions: SessionSummary[] }>(res);
  return body.sessions;
}

export async function createSession(
  sessionName: string,
  metadata?: Record<string, unknown>
): Promise<SessionCreated> {
  const res = await fetch(`${API_BASE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_name: sessionName, metadata: metadata ?? {} }),
  });
  return handleResponse<SessionCreated>(res);
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  const res = await fetch(`${API_BASE}/${sessionId}`);
  return handleResponse<SessionDetail>(res);
}

export async function runSession(
  sessionId: string,
  inputData: Record<string, unknown>,
  step?: string
): Promise<SessionRunResponse> {
  const body: Record<string, unknown> = { input_data: inputData };
  if (step) body.step = step;
  const res = await fetch(`${API_BASE}/${sessionId}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<SessionRunResponse>(res);
}

// Note: listOrphanedPipelines, attachPipelineToSession, listSessionPipelines are
// intentionally omitted — pipeline management UI is out of scope (see spec). No
// Next.js proxy routes exist for /api/pipelines/* in this plan.
```

- [ ] **Step 2: Check for broken imports**

Run: `grep -rn "getLastSessionMode\|createLocalSession\|runLocalSession\|fetchWithFallback" frontend/app/ frontend/components/ frontend/lib/ --include="*.ts" --include="*.tsx" | grep -v local-session-pipeline`

Expected: no output (nothing outside local-session-pipeline references the removed functions)

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api/session.ts
git commit -m "refactor: simplify session.ts to single canonical endpoint, remove fallback probing"
```

---

## Task 4b: Fix run-pipeline-client.ts Orphaned Run Path (Layer 2)

**Files:**
- Modify: `frontend/lib/run-pipeline-client.ts`

This file has its own `PIPELINE_URL` defaulting to `http://localhost:8001` and calls `${PIPELINE_URL}/run` directly for orphaned (no-session) runs. Update the default to port 8000.

- [ ] **Step 1: Fix the port default**

In `frontend/lib/run-pipeline-client.ts`, replace lines 28-29:
```typescript
const PIPELINE_URL =
  process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8001";
```
With:
```typescript
const PIPELINE_URL =
  process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";
```

- [ ] **Step 2: Verify**

Run: `grep "localhost:8" frontend/lib/run-pipeline-client.ts`
Expected: `http://localhost:8000` (not 8001)

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/run-pipeline-client.ts
git commit -m "fix: update run-pipeline-client orphaned run URL default to port 8000"
```

---

## Task 5: Add Backend-Offline Banner to Sessions Page (Layer 2)

**Files:**
- Modify: `frontend/app/sessions/page.tsx`

When a session API call returns a 503 or throws a network error, show an orange dismissible banner: "Backend service is offline. Please start the backend server."

- [ ] **Step 1: Add backendOffline state**

In `frontend/app/sessions/page.tsx`, find the existing state declarations (around line 361). Add after the existing state lines:

```typescript
  const [backendOffline, setBackendOffline] = useState(false);
```

- [ ] **Step 2: Set offline state on errors**

Find the `loadSessions` or similar function that calls `listSessions()`. Wrap it to catch offline errors:

```typescript
  // In the existing catch block where listSessions / getSession errors are caught:
  if (err instanceof Error && (err.message.includes("offline") || err.message.includes("503") || err.message.includes("Failed to fetch"))) {
    setBackendOffline(true);
  }
```

Apply the same pattern to the `runSession` call (around line 595) catch block.

- [ ] **Step 3: Add banner JSX**

Find the top of the main sessions page JSX render (the outermost div after `return (`). Add as the very first child:

```tsx
      {backendOffline && (
        <div style={{
          background: "#FFF7ED",
          borderBottom: "1px solid #E8561B",
          color: "#9A3412",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "Outfit, sans-serif",
          fontSize: 14,
        }}>
          <span>Backend service is offline. Please start the backend server.</span>
          <button
            onClick={() => setBackendOffline(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9A3412", fontWeight: 600 }}
          >
            ✕
          </button>
        </div>
      )}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/sessions/page.tsx
git commit -m "feat: add backend-offline banner to sessions page"
```

---

## Task 6: Update context-preview Route (Layer 2 + 3)

**Files:**
- Modify: `frontend/app/api/sessions/[session_id]/context-preview/route.ts`

Two changes: fix `PIPELINE_URL` default from 8001 to 8000, and update `ready` to require all 4 gate conditions.

- [ ] **Step 1: Update PIPELINE_URL and ready check**

Replace `frontend/app/api/sessions/[session_id]/context-preview/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
const PIPELINE_URL =
  process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";  // fixed: was 8001

export async function GET(
  req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  const sessionId = params.session_id;

  const fwdHeaders: Record<string, string> = {};
  const cookie = req.headers.get("cookie");
  const auth = req.headers.get("authorization");
  if (cookie) fwdHeaders["cookie"] = cookie;
  if (auth) fwdHeaders["authorization"] = auth;

  // 1. Merged context — TypeScript backend (only home for /api/context/merged)
  let context: {
    global: unknown;
    session: unknown;
    merged: Record<string, unknown>;
  } = { global: null, session: null, merged: {} };
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/context/merged?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: fwdHeaders }
    );
    if (res.ok) {
      const payload = await res.json();
      if (payload.success && payload.data) context = payload.data;
    }
  } catch {}

  // 2. Memory keys — Python backend session state outputs
  let memory_keys: string[] = [];
  try {
    const res = await fetch(
      `${PIPELINE_URL}/session/${encodeURIComponent(sessionId)}`,
      { headers: fwdHeaders }
    );
    if (res.ok) {
      const payload = await res.json();
      const outputs = payload?.state?.outputs ?? {};
      memory_keys = Object.keys(outputs).filter(Boolean);
    }
  } catch {}

  // 3. Readiness: all 4 gate conditions must be met
  const merged = context.merged ?? {};
  const ready = !!(
    merged.companyName && String(merged.companyName).trim() &&
    merged.productName && String(merged.productName).trim() &&
    merged.productDescription && String(merged.productDescription).trim() &&
    merged.ingest && Array.isArray(merged.ingest) && (merged.ingest as unknown[]).length > 0
  );

  return NextResponse.json({ context, memory_keys, ready });
}
```

**Note:** The `ingest` check in `ready` above uses `merged.ingest` — verify that the TypeScript backend's merged context payload includes `ingest` count. If not, the backend gate (Task 7) still catches it; this is a best-effort frontend check.

- [ ] **Step 2: Verify port fix**

Run: `grep "localhost:8" frontend/app/api/sessions/\[session_id\]/context-preview/route.ts`
Expected: `http://localhost:8000` for PIPELINE_URL (not 8001)

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/api/sessions/[session_id]/context-preview/route.ts"
git commit -m "fix: update context-preview PIPELINE_URL default to 8000; expand ready gate to 4 conditions"
```

---

## Task 7: Add Input Gate to Backend Pipeline (Layer 3)

**Files:**
- Modify: `backend/src/services/pipeline.py`

Before the first step executes, validate that required context fields and ingest are present. Return HTTP 422 if any are missing (the pipeline's `run()` method raises a `ValueError` which the API layer converts to 422).

- [ ] **Step 1: Add validation function**

In `backend/src/services/pipeline.py`, add this function right before the `Pipeline` class definition (around line 275):

```python
def validate_pipeline_input(input_data: dict) -> None:
    """
    Raise ValueError with structured detail if required context fields or ingest are missing.
    Called before the first pipeline step executes.
    Error format: "INCOMPLETE_CONTEXT:field1,field2" — parsed by the API layer into HTTP 422.
    """
    context = input_data.get("context") or {}
    missing = []

    for field in ("companyName", "productName", "productDescription"):
        val = context.get(field)
        if not val or not str(val).strip():
            missing.append(field)

    ingest = input_data.get("ingest")
    if not ingest or not isinstance(ingest, list) or len(ingest) == 0:
        missing.append("ingest")

    if missing:
        raise ValueError(f"INCOMPLETE_CONTEXT:{','.join(missing)}")
```

- [ ] **Step 2: Call the validation at pipeline start**

In `pipeline.py`, in the `Pipeline.run()` method, find the line `state = dict(input_data)` (around line 319). Add the validation call right after it:

```python
        state = dict(input_data)

        # Gate: reject immediately if required context fields or ingest are missing
        validate_pipeline_input(input_data)
```

- [ ] **Step 3: Ensure API layer returns 422 on ValueError**

In `backend/src/main.py`, check that `ValueError` is handled. Find the exception handlers or the `/session/{id}/run` route handler. Add (or verify exists):

```python
from fastapi import HTTPException

# In the run endpoint's except block, or as a global exception handler:
# except ValueError as e:
#     raise HTTPException(status_code=422, detail=str(e))
```

Run: `grep -n "ValueError\|422\|HTTPException" backend/src/main.py | head -20`

If no 422/ValueError handler exists, add this after the existing imports in `main.py`:

```python
from fastapi.responses import JSONResponse
from fastapi.requests import Request

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    msg = str(exc)
    if msg.startswith("INCOMPLETE_CONTEXT:"):
        fields = msg.split(":", 1)[1].split(",")
        return JSONResponse(
            status_code=422,
            content={"error": "INCOMPLETE_CONTEXT", "missing": fields}
        )
    return JSONResponse(status_code=422, content={"error": msg})
```

- [ ] **Step 4: Write a test**

Add to `backend/tests/test_pipeline.py`:

```python
def test_validate_pipeline_input_missing_fields():
    from services.pipeline import validate_pipeline_input
    import pytest

    # Missing all fields
    with pytest.raises(ValueError) as exc:
        validate_pipeline_input({})
    assert "INCOMPLETE_CONTEXT" in str(exc.value)
    assert "companyName" in str(exc.value)
    assert "ingest" in str(exc.value)

    # Missing ingest only
    with pytest.raises(ValueError) as exc:
        validate_pipeline_input({
            "context": {
                "companyName": "Acme",
                "productName": "Widget",
                "productDescription": "A widget for users",
            }
        })
    assert "ingest" in str(exc.value)

    # All present — no exception
    validate_pipeline_input({
        "context": {
            "companyName": "Acme",
            "productName": "Widget",
            "productDescription": "A widget for users",
        },
        "ingest": [{"content": "some interview"}],
    })
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/yug/Desktop/SpecFlow/backend && python -m pytest tests/test_pipeline.py -v -k "validate_pipeline_input" 2>&1 | tail -20`
Expected: all 3 assertions PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/pipeline.py backend/src/main.py backend/tests/test_pipeline.py
git commit -m "feat: add input gate to pipeline — blocks on missing context/ingest (HTTP 422)"
```

---

## Task 8: Add normalize_title and Wire into validate_output (Layer 3)

**Files:**
- Modify: `backend/src/services/pipeline.py`

Add `normalize_title()` next to `validate_output()`. Apply it to `title` fields inside `validate_output()` — strip UUIDs, timestamps, trim to 10 words. Exclude items whose title becomes empty after stripping.

- [ ] **Step 1: Add normalize_title function**

In `backend/src/services/pipeline.py`, add this function directly before `validate_output()` (around line 199):

```python
import re as _re

_UUID_PATTERN = _re.compile(
    r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}", _re.IGNORECASE
)
_ISO_TIMESTAMP_PATTERN = _re.compile(
    r"\d{4}-\d{2}-\d{2}T[\d:.]+Z?"
)


def normalize_title(text: str) -> str:
    """
    Strip UUIDs and ISO timestamps from a title string, then trim to 10 words.
    Returns empty string if nothing meaningful remains.
    """
    if not isinstance(text, str):
        return ""
    cleaned = _UUID_PATTERN.sub("", text)
    cleaned = _ISO_TIMESTAMP_PATTERN.sub("", cleaned)
    # Collapse whitespace
    cleaned = " ".join(cleaned.split())
    # Trim to 10 words
    words = cleaned.split()[:10]
    return " ".join(words).strip()
```

- [ ] **Step 2: Apply in validate_output**

In `validate_output()`, find the `for fname in fields:` loop (around line 242). Before the existing `value = item.get(fname)` check, add title normalization:

```python
        for fname in fields:
            value = item.get(fname)

            # Normalize title: strip UUIDs/timestamps, apply back to item
            if fname == "title" and isinstance(value, str):
                value = normalize_title(value)
                if not value:
                    # Title became empty after normalization — exclude this item entirely
                    item_issues.append("title is empty after normalization (contained only UUIDs/timestamps)")
                    break
                item[fname] = value  # write normalized title back
```

- [ ] **Step 3: Write tests**

Add to `backend/tests/test_pipeline.py`:

```python
def test_normalize_title_strips_uuid():
    from services.pipeline import normalize_title
    result = normalize_title("bebc4a35-1234-5678-abcd-ef0123456789 Interview Notes")
    assert "bebc4a35" not in result
    assert "Interview Notes" in result

def test_normalize_title_strips_iso_timestamp():
    from services.pipeline import normalize_title
    result = normalize_title("2024-03-15T10:30:00Z Session Data")
    assert "2024-03-15" not in result
    assert "Session Data" in result

def test_normalize_title_trims_to_10_words():
    from services.pipeline import normalize_title
    long = "one two three four five six seven eight nine ten eleven"
    result = normalize_title(long)
    assert len(result.split()) == 10

def test_normalize_title_returns_empty_for_uuid_only():
    from services.pipeline import normalize_title
    result = normalize_title("bebc4a35-1234-5678-abcd-ef0123456789")
    assert result == ""
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/yug/Desktop/SpecFlow/backend && python -m pytest tests/test_pipeline.py -v -k "normalize_title" 2>&1 | tail -20`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/pipeline.py backend/tests/test_pipeline.py
git commit -m "feat: add normalize_title — strips UUIDs/timestamps from problem titles"
```

---

## Task 9: Add Memory Blocks to decompose.yaml and tasks.yaml (Layer 3)

**Files:**
- Modify: `backend/config/agents/decompose.yaml`
- Modify: `backend/config/agents/tasks.yaml`

Add `memory.read` + `memory.write` blocks so each agent reads from the prior step's output in the memory store and writes its own output. Without `memory.write`, `MemoryManager.write_from_agent()` is a no-op.

- [ ] **Step 1: Update decompose.yaml**

Append to the end of `backend/config/agents/decompose.yaml`:

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

- [ ] **Step 2: Update tasks.yaml**

Append to the end of `backend/config/agents/tasks.yaml`:

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

- [ ] **Step 3: Verify YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('backend/config/agents/decompose.yaml')); print('OK')" && python3 -c "import yaml; yaml.safe_load(open('backend/config/agents/tasks.yaml')); print('OK')"`
Expected: `OK` twice

- [ ] **Step 4: Commit**

```bash
git add backend/config/agents/decompose.yaml backend/config/agents/tasks.yaml
git commit -m "feat: add memory read+write blocks to decompose and tasks agents"
```

---

## Task 10: Add Title Length Constraint to problems.yaml (Layer 3)

**Files:**
- Modify: `backend/config/agents/problems.yaml`

Add instruction to keep titles ≤ 10 words. The normalize_title function handles stripping, but this instruction helps the model generate cleaner titles from the start.

- [ ] **Step 1: Add max-length instruction**

In `backend/config/agents/problems.yaml`, find the `instructions:` block. Add this line at the end of the instructions text (before the closing `|`):

```
  Every problem title must be 10 words or fewer and must not contain IDs, timestamps, or technical identifiers.
```

- [ ] **Step 2: Verify YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('backend/config/agents/problems.yaml')); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/config/agents/problems.yaml
git commit -m "fix: add title max-length instruction to problems agent"
```

---

## Task 11: Create StepInspector Component (Layer 4)

**Files:**
- Create: `frontend/components/StepInspector.tsx`

Collapsible component showing field cards per pipeline step output item, quality badges, and copy-JSON button.

- [ ] **Step 1: Create the component**

Create `frontend/components/StepInspector.tsx`:

```tsx
"use client";

import { useState } from "react";

type StepKey = "problems" | "features" | "decompose" | "tasks";

interface FieldDef {
  key: string;
  label: string;
}

const STEP_FIELDS: Record<StepKey, FieldDef[]> = {
  problems: [
    { key: "title", label: "Title" },
    { key: "severity", label: "Severity" },
    { key: "description", label: "Description" },
  ],
  features: [
    { key: "title", label: "Title" },
    { key: "priority", label: "Priority" },
    { key: "acceptance_criteria", label: "Acceptance Criteria" },
  ],
  decompose: [
    { key: "title", label: "Title" },
    { key: "layer", label: "Layer" },
    { key: "user_problem_it_solves", label: "Problem Solved" },
  ],
  tasks: [
    { key: "title", label: "Title" },
    { key: "layer", label: "Layer" },
    { key: "user_problem_it_solves", label: "Problem Solved" },
  ],
};

interface StepInspectorProps {
  step: StepKey;
  items: Record<string, unknown>[];
}

function ItemCard({ item, fields }: { item: Record<string, unknown>; fields: FieldDef[] }) {
  const [issuesOpen, setIssuesOpen] = useState(false);
  const isLowConfidence = item.quality_flag === "low_confidence";
  const qualityIssues = Array.isArray(item.quality_issues) ? item.quality_issues as string[] : [];

  return (
    <div style={{
      background: "#FFFFFF",
      border: `1px solid ${isLowConfidence ? "#E8561B" : "#E5DDD5"}`,
      borderRadius: 8,
      padding: "12px 16px",
      marginBottom: 8,
    }}>
      {isLowConfidence && (
        <div style={{
          display: "inline-block",
          background: "#FFF7ED",
          color: "#C2410C",
          fontSize: 11,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 4,
          marginBottom: 8,
          fontFamily: "Outfit, sans-serif",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>
          Low Confidence
        </div>
      )}
      {fields.map(({ key, label }) => {
        const val = item[key];
        if (!val) return null;
        return (
          <div key={key} style={{ marginBottom: 6 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#9B9189",
              fontFamily: "Outfit, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}>
              {label}
            </span>
            <div style={{
              fontSize: 13,
              color: "#0D0D0D",
              fontFamily: "Outfit, sans-serif",
              marginTop: 2,
            }}>
              {String(val)}
            </div>
          </div>
        );
      })}
      {isLowConfidence && qualityIssues.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setIssuesOpen((o) => !o)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#C2410C",
              fontSize: 12,
              fontFamily: "Outfit, sans-serif",
              padding: 0,
            }}
          >
            {issuesOpen ? "▾" : "▸"} {qualityIssues.length} quality issue{qualityIssues.length !== 1 ? "s" : ""}
          </button>
          {issuesOpen && (
            <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 12, color: "#9A3412", fontFamily: "Outfit, sans-serif" }}>
              {qualityIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function StepInspector({ step, items }: StepInspectorProps) {
  const [open, setOpen] = useState(false);
  const fields = STEP_FIELDS[step] ?? [];

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(items, null, 2)).catch(() => {});
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6B5E52",
            fontSize: 13,
            fontFamily: "Outfit, sans-serif",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {open ? "▾" : "▸"} {items.length} item{items.length !== 1 ? "s" : ""}
        </button>
        <button
          onClick={handleCopy}
          style={{
            background: "none",
            border: "1px solid #E5DDD5",
            borderRadius: 4,
            cursor: "pointer",
            color: "#6B5E52",
            fontSize: 11,
            fontFamily: "Outfit, sans-serif",
            padding: "2px 8px",
          }}
        >
          Copy JSON
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
          {items.map((item, i) => (
            <ItemCard
              key={(item.id as string) ?? i}
              item={item}
              fields={fields}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/yug/Desktop/SpecFlow/frontend && npx tsc --noEmit 2>&1 | grep StepInspector`
Expected: no errors for `StepInspector.tsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/components/StepInspector.tsx
git commit -m "feat: add StepInspector component for inline pipeline output inspection"
```

---

## Task 12: Wire StepInspector into Sessions Page (Layer 4)

**Files:**
- Modify: `frontend/app/sessions/page.tsx`

Import `StepInspector` and render it below each completed step's status indicator using `sessionDetail.state.outputs`.

- [ ] **Step 1: Add import**

At the top of `frontend/app/sessions/page.tsx`, add:
```typescript
import { StepInspector } from "@/components/StepInspector";
```

- [ ] **Step 2: Find the existing OutputInspector block**

Run: `grep -n "OutputInspector\|state\.state\.outputs" frontend/app/sessions/page.tsx`
Expected: line ~1368 shows the `OutputInspector` component rendering all outputs as raw JSON.

The existing `OutputInspector` (defined at line ~307, used at line ~1370) shows a raw JSON collapsible for every output key. Replace it with per-step `StepInspector` instances that show structured field cards.

- [ ] **Step 3: Replace OutputInspector with StepInspector per step**

In `frontend/app/sessions/page.tsx`, find the block around line 1368-1372:
```tsx
                  {/* Outputs inspector */}
                  {detail?.state?.state?.outputs && Object.keys(detail.state.state.outputs).length > 0 && (
                    <div style={{ background: "#FFFFFF", border: "1px solid #E4DDD4", borderRadius: 14, padding: "18px 22px", marginBottom: 18 }}>
                      <OutputInspector outputs={detail.state.state.outputs as Record<string, unknown>} />
                    </div>
                  )}
```

Replace it with:
```tsx
                  {/* Outputs inspector — per-step structured view */}
                  {detail?.state?.state?.outputs && Object.keys(detail.state.state.outputs).length > 0 && (
                    <div style={{ background: "#FFFFFF", border: "1px solid #E4DDD4", borderRadius: 14, padding: "18px 22px", marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9B9189", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                        Outputs
                      </div>
                      {(["problems", "features", "decompose", "tasks"] as const).map((stepKey) => {
                        const items = detail.state?.state?.outputs?.[stepKey];
                        if (!Array.isArray(items) || items.length === 0) return null;
                        return (
                          <div key={stepKey} style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#0D0D0D", marginBottom: 4, textTransform: "capitalize" }}>
                              {stepKey}
                            </div>
                            <StepInspector
                              step={stepKey}
                              items={items as Record<string, unknown>[]}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
```

Note: The `OutputInspector` function definition (lines ~307-350) can be kept or removed — it is no longer called after this change.

- [ ] **Step 4: Verify it renders**

Run: `cd /Users/yug/Desktop/SpecFlow/frontend && npx tsc --noEmit 2>&1 | grep -i "error\|StepInspector" | head -20`
Expected: no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add frontend/app/sessions/page.tsx
git commit -m "feat: wire StepInspector into sessions page for inline output inspection"
```

---

## Task 13: Smoke Test End-to-End

Verify the full fixed flow works: create session → fill context → run pipeline → inspect output.

- [ ] **Step 1: Start backend**

Run: `cd /Users/yug/Desktop/SpecFlow/backend && python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload &`

- [ ] **Step 2: Start frontend**

Run: `cd /Users/yug/Desktop/SpecFlow/frontend && npm run dev &`

- [ ] **Step 3: Check proxy routes respond**

Run: `curl -s http://localhost:3000/api/sessions | head -5`
Expected: JSON response (may be empty sessions array or error — not 404)

- [ ] **Step 4: Verify local pipeline route is gated**

Run: `curl -s -X POST http://localhost:3000/api/pipeline/run -H "Content-Type: application/json" -d '{"step":"problems","inputData":{}}' | python3 -m json.tool`
Expected: `{"error": "Backend service is offline. Please start the backend server."}`

- [ ] **Step 5: Verify pipeline input gate**

Run: `curl -s -X POST http://localhost:8000/session/test-id/run -H "Content-Type: application/json" -d '{"input_data":{}}' | python3 -m json.tool`
Expected: 422 with `{"error": "INCOMPLETE_CONTEXT", "missing": ["companyName", "productName", "productDescription", "ingest"]}`

- [ ] **Step 6: Commit final state if any cleanup needed**

```bash
git add -A && git status
# commit only if there are uncommitted changes
```
