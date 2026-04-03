# Recommendations — SpecFlow v2 Security Audit

## Immediate (before next deploy)

1. **Rotate credentials** — The Supabase service role key, anon key, and Anthropic API key in `backend/.env` were read during this audit session. Rotate all three now:
   - Supabase: Settings → API → "Reset service_role key"
   - Anthropic: console.anthropic.com → API Keys → revoke and reissue
   - Update `backend/.env` locally with new values

2. **Auto-fixed in this session:**
   - ✅ `POST /run` now requires authentication (C1)
   - ✅ `verify_supabase_jwt` is now async — no longer blocks the event loop (H2)
   - ✅ `str(e)` error leaks replaced with "Internal server error" in 3 SSE/session locations (M1)
   - ✅ `/api/pipeline/run` frontend route now requires Supabase auth (H4)
   - ✅ Linear sync now validates `operation` against a whitelist of 5 allowed operations (H1)

## Short-term (next sprint)

3. **Add FastAPI request body size limit** (H3)
   ```python
   # In uvicorn startup or as middleware
   uvicorn main:app --limit-max-requests 1000 --h11-max-incomplete-event-size 524288
   # Or add middleware that rejects Content-Length > 512KB
   ```

4. **Add rate limiting** (M2)
   ```python
   pip install slowapi
   # 10 req/min per IP on /run, /session/*/run, /session/*/prd
   ```

5. **Lock down MemoryRepository** (M3) — Pass `client=auth.client` in `generate_prd` and `generate_prd_stream` so those paths enforce RLS instead of using service-role.

## Medium-term

6. **Linear GraphQL mutation validation** — Beyond operation name whitelisting, consider validating `variables` to reject mutations targeting resources outside the user's workspace.

7. **Remove or archive `frontend/app/api/pipeline/run/route.ts`** — This "local mode" pipeline is a security liability. If it's no longer needed, delete it. If kept, the auth fix applied here is the minimum.

8. **Add security headers to FastAPI** — Express backend already has them; FastAPI is missing `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`.
