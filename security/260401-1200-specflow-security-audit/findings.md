# Security Findings — SpecFlow v2

**Date:** 2026-04-01
**Audit scope:** Entire codebase (15 iterations, STRIDE + OWASP)
**Auto-fix:** Scheduled for Critical + High

---

## Summary

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 4 |
| Medium | 3 |
| Low | 1 |
| Info | 1 |

---

## CRITICAL

### [C1] Unauthenticated `/run` pipeline endpoint
- **File:** `backend/src/main.py:211`
- **OWASP:** A01 Broken Access Control
- **STRIDE:** Spoofing, Elevation of Privilege, Denial of Service
- **Attack:** Any caller with network access to port 8001 (or via SSRF from Next.js) can POST to `/run` with arbitrary `input_data`, triggering a full AI pipeline run. No JWT, no session, no user_id.
- **Impact:** Unbounded Anthropic API cost exposure. Data injection into AI prompts. No attribution or audit trail.
- **Code evidence:**
  ```python
  @app.post("/run")
  async def run_pipeline(req: RunRequest):  # No Depends(require_auth_context)
      pipeline = Pipeline()
      result = await pipeline.run(req.input_data, req.project_id)
  ```
- **Fix:** Add `auth: AuthContext = Depends(require_auth_context)` to signature, or remove the endpoint if it has no active callers.

---

### [C2] Real credentials visible in this audit session
- **File:** `backend/.env`
- **OWASP:** A02 Cryptographic Failures
- **STRIDE:** Information Disclosure
- **Attack:** The `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ANTHROPIC_API_KEY` were read during codebase scanning and are now in Claude's context window. The service role key bypasses all RLS policies — anyone possessing it has full read/write on the entire Supabase database.
- **Impact:** Full database compromise if leaked. Unlimited Anthropic API usage if key leaked.
- **Fix:** **Rotate all three keys immediately:**
  1. Supabase dashboard → Settings → API → regenerate service role key
  2. Anthropic console → API Keys → revoke and reissue
  3. Update `backend/.env` (never commit `.env`)

---

## HIGH

### [H1] Linear sync accepts arbitrary GraphQL mutations from client
- **File:** `frontend/app/api/linear/sync/route.ts:88-98`
- **OWASP:** A03 Injection
- **STRIDE:** Tampering, Elevation of Privilege
- **Attack:** Authenticated user sends a POST with `linear_payload.project.mutation` containing any arbitrary GraphQL mutation string. The server executes it against Linear's API using the **victim's** OAuth token with no validation of what the mutation does.
  ```typescript
  body: JSON.stringify({
    query: mutation_obj.mutation,  // raw string from client request body
    variables: mutation_obj.variables,
  }),
  ```
- **Impact:** Attacker can delete Linear teams, add members, modify any workspace data on behalf of any user who has connected Linear.
- **Fix:** Whitelist allowed mutation operation names server-side. Validate `mutation_obj.operation` against a known set (`createProject`, `createIssue`, `createLabel`). Reject requests with unrecognized operations.

---

### [H2] Synchronous `httpx.get()` blocks the async event loop
- **File:** `backend/src/services/db/supabase_client.py:53`
- **OWASP:** A05 Security Misconfiguration (async DoS)
- **STRIDE:** Denial of Service
- **Attack:** `verify_supabase_jwt()` uses blocking `httpx.get()` to call Supabase Auth on every authenticated request. In an async FastAPI app running on a single event loop, this call blocks all concurrent requests for its duration (~50–300ms per call).
  ```python
  response = httpx.get(  # BLOCKING — stalls the event loop
      f"{url.rstrip('/')}/auth/v1/user",
      ...
      timeout=5.0,  # worst case: 5s block per request
  )
  ```
- **Impact:** 20 concurrent requests × 5s timeout = all requests queued. Effective DoS under moderate load.
- **Fix:** Replace with `httpx.AsyncClient` and `await client.get(...)`.

---

### [H3] No FastAPI request body size limit
- **File:** `backend/src/main.py` (all POST endpoints)
- **OWASP:** A05 Security Misconfiguration
- **STRIDE:** Denial of Service
- **Attack:** `input_data: dict[str, Any]` in `RunRequest`, `SessionRunRequest`, etc. has no maximum size. An attacker can POST a multi-MB JSON body that gets passed to AI agents, causing huge token consumption or memory exhaustion.
- **Impact:** Memory pressure, inflated Anthropic API costs, potential OOM on the server.
- **Fix:** Add Uvicorn's `--limit-max-requests` flag, or add FastAPI middleware to reject requests over a threshold (e.g., 512KB).

---

### [H4] Frontend `/api/pipeline/run` has no authentication check
- **File:** `frontend/app/api/pipeline/run/route.ts:76`
- **OWASP:** A01 Broken Access Control
- **STRIDE:** Spoofing, Denial of Service
- **Attack:** When `NEXT_PUBLIC_USE_LOCAL_PIPELINE=true`, this route is fully active with no Supabase auth check. Any unauthenticated caller can POST arbitrary `step` + `inputData` and use the `ANTHROPIC_API_KEY`.
  ```typescript
  export async function POST(req: NextRequest) {
    if (!USE_LOCAL) { return 503; }
    // ← no auth check here
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const client = new Anthropic({ apiKey });
  ```
  Additionally, `inputData.context` goes directly into the prompt — prompt injection is trivially exploitable.
- **Fix:** Add Supabase auth check before `USE_LOCAL` gate; this route should require authentication regardless of local vs backend mode.

---

## MEDIUM

### [M1] Raw exception messages exposed to clients (5 locations)
- **File:** `backend/src/main.py:248,275,555,647,802`
- **OWASP:** A09 Security Logging and Monitoring Failures
- **STRIDE:** Information Disclosure
- **Attack:** `detail=str(e)` / `message: str(e)` sends raw Python exception text to the client. Can leak: Supabase error messages containing row data, internal file paths, query structure, or ORM details.
- **Fix:** Replace with generic user-facing messages. Log the full exception server-side only.

---

### [M2] No rate limiting on any endpoint
- **File:** `backend/src/main.py` (all routes)
- **OWASP:** A05 Security Misconfiguration
- **STRIDE:** Denial of Service
- **Attack:** No per-IP or per-user rate limiting. Combined with C1 (unauthenticated `/run`), an attacker can exhaust Anthropic API quota within minutes.
- **Fix:** Add `slowapi` or Nginx rate limiting. Minimum: 10 req/min per IP on AI endpoints.

---

### [M3] MemoryRepository defaults to service-role client
- **File:** `backend/src/services/memory/memory_repository.py:28`
- **OWASP:** A01 Broken Access Control
- **STRIDE:** Elevation of Privilege
- **Attack:** `MemoryRepository()` (no args) uses `get_supabase_client()` which is the service-role key singleton. Any code path that constructs `MemoryRepository()` without passing a user-scoped client bypasses RLS and can read/write all memory entries across all users.
- **Current exposure:** `generate_prd` (main.py:539) and `generate_prd_stream` (main.py:622) both call `MemoryRepository()` without a client. They do pass `user_id` in the entry, but since RLS is bypassed, a compromised agent could write to another user's `session_id`.
- **Fix:** Either always pass `client=auth.client`, or assert that service-role-constructed repos are never used in user-facing request handlers.

---

## LOW

### [L1] `optionalAuth` middleware has a silent error path
- **File:** `backend/src/middleware/auth.ts:49`
- **OWASP:** A07 Identification and Authentication Failures
- **STRIDE:** Spoofing
- **Note:** Currently unused (`optionalAuth` is defined but never imported in any route). Low risk at present.
- **Attack:** If added to a route that appears to require auth, the `.then()` without `await` means auth failures silently set `req.user = undefined` and call `next()` — allowing unauthenticated access.
- **Fix:** Convert to `async/await` pattern, or remove since it's unused.

---

## INFO

### [I1] Express backend has strong security defaults
- **File:** `backend/src/index.ts:22-37`
- `x-powered-by` header disabled
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
- 1MB request body limit
- CORS restricted to localhost + `FRONTEND_URL`

---

## OWASP Top 10 Coverage

| # | Category | Tested | Findings |
|---|---|---|---|
| A01 | Broken Access Control | ✅ | C1, H4, M3 |
| A02 | Cryptographic Failures | ✅ | C2 |
| A03 | Injection | ✅ | H1 |
| A04 | Insecure Design | ✅ | None |
| A05 | Security Misconfiguration | ✅ | H2, H3, M2 |
| A06 | Vulnerable Components | ⚠️ | Not deep-audited |
| A07 | Auth Failures | ✅ | L1 |
| A08 | Software Integrity | ⚠️ | Not audited |
| A09 | Logging/Monitoring | ✅ | M1 |
| A10 | SSRF | ✅ | No findings |

---

## STRIDE Coverage

| Threat | Tested | Findings |
|---|---|---|
| Spoofing | ✅ | C1, L1 |
| Tampering | ✅ | H1 |
| Repudiation | ✅ | C1 (no attribution on /run) |
| Information Disclosure | ✅ | C2, M1 |
| Denial of Service | ✅ | H2, H3, M2 |
| Elevation of Privilege | ✅ | C1, H1, H4, M3 |
