# Security Best Practices Review

## Executive Summary

This review focused on the active SpecFlow runtime paths in `frontend/` and `backend/` and compared them against secure-by-default guidance for Next.js/React, Express, and FastAPI. The most serious issue is an authorization design flaw in the FastAPI session/pipeline service: several request paths accept missing authentication and then fall back to a service-role Supabase client, which can expose or mutate cross-user session data. A separate Next.js route, `/api/pipeline/autosave`, performs direct service-role writes with no authentication check at all.

I also found a conditional but high-impact third-party mutation path in the Linear sync route, an unsupported Next.js major version, and several missing production hardening controls. I did not verify edge/CDN/WAF behavior, so findings below reflect what is visible in application code.

## Critical Findings

### CR-01: Session and pipeline endpoints allow unauthenticated access to service-role-backed data paths

Rule ID: `FASTAPI-AUTH-001`, `NEXT-SECRETS-001`

Severity: Critical

Location:
- `backend/src/main.py:49-65`
- `backend/src/main.py:189-198`
- `backend/src/main.py:206-219`
- `backend/src/main.py:233-305`
- `backend/src/main.py:440-509`
- `backend/src/main.py:607-748`
- `backend/src/main.py:759-792`
- `backend/src/services/session/session_repository.py:20-21`
- `backend/src/services/pipeline_repository.py:14-16`
- `backend/src/services/db/supabase_client.py:15-31`
- `frontend/lib/supabase/get-auth-header.ts:12-22`
- `frontend/app/api/sessions/route.ts:6-30`
- `frontend/app/api/sessions/[session_id]/route.ts:6-16`
- `frontend/app/api/sessions/[session_id]/run/route.ts:6-19`
- `frontend/app/api/sessions/[session_id]/run/async/route.ts:6-22`
- `frontend/app/api/sessions/[session_id]/prd/route.ts:6-36`
- `frontend/app/api/sessions/[session_id]/prd/export/route.ts:6-28`
- `frontend/app/api/sessions/[session_id]/prd/stream/route.ts:6-21`
- `frontend/app/api/sessions/[session_id]/run/stream/[job_id]/route.ts:6-21`

Evidence:
- `get_auth_context()` returns `None` whenever the bearer token is missing or invalid instead of rejecting the request.
- Session/PRD routes accept `auth: Optional[AuthContext]` and repeatedly construct repositories with `client=auth.client if auth else None`.
- `SessionRepository` and `PipelineRepository` default `None` clients to `get_supabase_client()`, which uses the service-role key when available.
- The Next.js proxy helper `getAuthHeader()` returns `{}` when there is no user session, and the API route handlers forward requests upstream anyway.

Impact:
- An unauthenticated caller can hit public Next.js API routes or the FastAPI service directly and reach session, PRD, and pipeline operations through a privileged backend client.
- In practice this can enable session enumeration, cross-user session reads, PRD reads/exports, pipeline execution, and pipeline attachment without a verified user context.

Fix:
- Make authentication mandatory for all session, PRD, and pipeline routes. Missing or invalid bearer tokens should return `401`, not fall back to a privileged client.
- Replace `Optional[AuthContext]` with a required auth dependency on protected routers/routes.
- Remove service-role fallback from request-facing repositories. Service-role access should be reserved for strictly internal jobs that are not directly reachable from the web.
- In the Next.js API proxy layer, reject unauthenticated calls before proxying upstream.

Mitigation:
- If some endpoints truly need public access, split them into a separate explicitly-public router with no service-role repository fallback.
- Add regression tests that assert unauthenticated calls to `/sessions`, `/session/{id}`, `/session/{id}/run`, `/session/{id}/prd`, `/pipelines/*` all return `401`.

False positive notes:
- If an API gateway already blocks these paths before traffic reaches app code, verify that separately. No such enforcement is visible in this repository.

### CR-02: `/api/pipeline/autosave` performs unauthenticated service-role writes to `memory_entries`

Rule ID: `NEXT-SECRETS-001`, `FASTAPI-AUTH-001`

Severity: Critical

Location:
- `frontend/app/api/pipeline/autosave/route.ts:4-15`
- `frontend/app/api/pipeline/autosave/route.ts:17-68`
- `frontend/middleware.ts:9-21`
- `frontend/middleware.ts:57-76`

Evidence:
- `createAdminClient()` creates a Supabase client with `SUPABASE_SERVICE_ROLE_KEY`.
- The `POST` handler accepts `session_id`, `output_key`, and `updated_content`, then updates `memory_entries` directly with no user/session ownership check.
- The middleware protects only page paths such as `/sessions` and `/tasks`; it does not require authentication for `/api/pipeline/autosave`.

Impact:
- Anyone who can reach the app can attempt arbitrary writes to stored generated outputs by providing a session id and memory key.
- This becomes especially severe when combined with CR-01, which exposes session discovery paths.

Fix:
- Require authentication in the route handler and resolve the current user before any write.
- Authorize the write against a session row owned by that user.
- Prefer a user-scoped Supabase client plus RLS rather than a service-role client for request-driven updates.
- Consider replacing free-form `session_id` and `output_key` inputs with server-side lookup of the active user-owned session record.

Mitigation:
- Add database-side ownership checks and an allowlist of editable memory keys.
- Add audit logging for user id, session id, and key on every autosave mutation.

False positive notes:
- None. The missing auth check and direct service-role write are explicit in the route.

## High Findings

### HI-01: `LINEAR_API_KEY` fallback allows anonymous callers to drive server-side Linear mutations when configured

Rule ID: `NEXT-SECRETS-001`

Severity: High

Location:
- `frontend/app/api/linear/sync/route.ts:18-38`
- `frontend/app/api/linear/sync/route.ts:69-111`
- `.env.example:32-41`
- `frontend/middleware.ts:9-21`

Evidence:
- The route reads the current Supabase user, but if no user token is present it falls back to `process.env.LINEAR_API_KEY`.
- The handler then forwards caller-supplied GraphQL mutation payloads to the Linear API using that server-side bearer token.
- The codebase documents `LINEAR_API_KEY` as a supported fallback mode.

Impact:
- If `LINEAR_API_KEY` is configured in any deployed environment, anonymous callers can trigger project/label/issue mutations against the connected Linear workspace.
- This is effectively a public mutation proxy backed by a privileged server token.

Fix:
- Remove the global API-key fallback from the web route, or gate it behind a separate admin-only path with strong authentication.
- Require an authenticated user and fetch only that user’s stored OAuth token.
- Validate the allowed mutation set server-side instead of forwarding caller-controlled GraphQL operations directly.

Mitigation:
- If you must keep a single-user fallback for local development, disable the route outside local/dev environments.
- Add request authentication plus structured allowlists for operations and variables.

False positive notes:
- This is exploitable only when `LINEAR_API_KEY` is actually configured. The code path is present today even if the variable is absent in your current local env.

### HI-02: Frontend is pinned to unsupported Next.js 14.x

Rule ID: `NEXT-SUPPLY-001`

Severity: High

Location:
- `frontend/package.json:22`

Evidence:
- The frontend depends on `next: "14.2.29"`.
- As of March 31, 2026, the official Next.js support policy lists `16.x` as Active LTS and `15.x` as Maintenance LTS, with `14.x` marked unsupported: [Next.js Support Policy](https://nextjs.org/support-policy).

Impact:
- Unsupported majors stop receiving normal security fixes, which increases exposure to future framework disclosures and ecosystem breakage.

Fix:
- Plan an upgrade to a currently supported Next.js major, ideally the latest maintained LTS line.
- Add dependency hygiene checks so framework majors do not age out unnoticed.

Mitigation:
- If the upgrade cannot happen immediately, at least track current advisories and patch to the newest supported line on a scheduled cadence.

False positive notes:
- None. The installed version is visible in `frontend/package.json`, and support status is currently documented upstream.

## Medium Findings

### ME-01: Production hardening baseline is incomplete across Next.js, Express, and FastAPI

Rule ID: `EXPRESS-HEADERS-001`, `FASTAPI-OPENAPI-001`, `FASTAPI-DEPLOY-001`

Severity: Medium

Location:
- `backend/src/index.ts:21-29`
- `backend/src/index.ts:66-78`
- `frontend/next.config.mjs:25-35`
- `backend/src/main.py:91-108`
- `backend/src/main.py:797-800`
- `backend/scripts/run-pipeline.mjs:44-61`

Evidence:
- Express does not set a visible security-header baseline such as Helmet, and `x-powered-by` is not disabled.
- The Next.js config does not define any global response headers such as CSP, `X-Content-Type-Options`, or clickjacking protections.
- FastAPI is instantiated with default docs behavior, so `/docs`, `/redoc`, and `/openapi.json` remain exposed unless blocked externally.
- The local pipeline entrypoints use `uvicorn ... --reload` and bind to `0.0.0.0`; that is correct for local development but unsafe if reused in internet-facing environments.

Impact:
- Missing baseline headers and public docs increase information disclosure and reduce browser-enforced defenses.
- If dev-style runtime commands leak into shared staging/production environments, reload/debug-oriented behavior expands attack surface.

Fix:
- Add a production header baseline. For Express that usually means `helmet()` plus disabling `x-powered-by`; for Next.js add global security headers at the framework or edge layer.
- Disable or protect FastAPI docs in production (`docs_url=None`, `redoc_url=None`, `openapi_url=None`), and add `TrustedHostMiddleware` with an explicit host allowlist.
- Keep `--reload` strictly local/dev and use a production ASGI process model for deployed environments.

Mitigation:
- If these controls already exist at the CDN/reverse proxy, document that explicitly and add runtime header verification to CI or smoke tests.

False positive notes:
- Some protections may exist outside app code. They are not visible in this repository.

## Operational Note

### OP-01: Long-lived secrets are present in ignored local env files

Location:
- `.env:1-13`
- `backend/.env:1-11`

Observation:
- The local workspace contains plaintext Supabase and Anthropic credentials in ignored env files. I did not reproduce the values here.

Recommendation:
- Rotate any long-lived secrets that may have been shared across environments.
- Prefer per-environment secret managers over repo-adjacent plaintext files for non-local deployments.
- Keep `service_role` keys out of developer workspaces unless they are strictly necessary for local admin tooling.

## Secure-by-Default Improvements

1. Enforce authentication at every request-facing API boundary before touching Supabase or third-party APIs.
2. Remove service-role clients from user-driven request paths; use user-scoped clients plus RLS wherever possible.
3. Add authorization tests for all `/api/sessions/*`, `/api/pipeline/autosave`, `/api/linear/sync`, and FastAPI `/session/*` and `/pipelines/*` routes.
4. Upgrade Next.js to a supported major and add dependency review to CI.
5. Add a documented production hardening baseline: security headers, FastAPI docs disabled in prod, host allowlists, and a production ASGI launch command.
