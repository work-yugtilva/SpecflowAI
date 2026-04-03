# Threat Model — SpecFlow v2

**Date:** 2026-04-01
**Auditor:** Autoresearch Security Audit
**Stack:** Next.js 14 (App Router) · FastAPI (port 8001) · Supabase · Anthropic SDK · Linear OAuth

---

## Assets

| Asset | Sensitivity | Location |
|---|---|---|
| Anthropic API key | Critical | `backend/.env` |
| Supabase service role key | Critical | `backend/.env` → `supabase_client.py` |
| Supabase anon key | High | `backend/.env`, `frontend/.env.local` |
| Linear OAuth access tokens | High | `user_integrations` table |
| Session outputs (PRDs, tasks) | High | `session_state.outputs`, `memory_entries` |
| User session data | Medium | `sessions` table |
| Linear `client_secret` | High | Server-side env only |

---

## Trust Boundaries

```
[Browser] ──HTTPS──▶ [Next.js API Routes] ──HTTP──▶ [FastAPI :8001]
                              │                              │
                              ▼                              ▼
                       [Supabase Auth]              [Supabase DB (RLS)]
                              │                              │
                              └──────────────────────────────┘
                                                             │
                                                   [Linear OAuth API]
```

**Key boundaries:**
1. Browser → Next.js: Public internet. JWT in Authorization header.
2. Next.js → FastAPI: Internal. FastAPI trusts the forwarded JWT header.
3. FastAPI → Supabase: Service role (bypasses RLS) vs anon+JWT (enforces RLS).
4. Next.js → Linear: OAuth access token stored in `user_integrations`.

---

## STRIDE Analysis

### S — Spoofing
| Threat | Target | Notes |
|---|---|---|
| JWT bypass on `/run` | No auth on legacy endpoint | Anyone can call it |
| JWT replay | `verify_supabase_jwt` | No token revocation cache |
| session_id enumeration | `/session/{id}` | UUID-based but no ownership check at FastAPI layer without RLS |

### T — Tampering
| Threat | Target | Notes |
|---|---|---|
| Arbitrary GraphQL injection | `/api/linear/sync` | Client controls `mutation` string sent to Linear |
| Input data injection | `POST /run` → AI prompts | Unauthenticated; can inject prompt content |
| Memory key collision | `memory_repository.save()` | `project_id,memory_key` conflict — no session isolation |

### R — Repudiation
| Threat | Target | Notes |
|---|---|---|
| Unattributed `/run` calls | No user_id logged on `/run` | Cannot attribute AI usage to a user |

### I — Information Disclosure
| Threat | Target | Notes |
|---|---|---|
| Raw exception messages in SSE stream | `generate_prd_stream` line 647 | `str(e)` sent to client |
| Internal error details in HTTP responses | `list_sessions` line 248 | `detail=str(e)` |
| Service role key in singleton | `get_supabase_client()` | Shared across all unauthenticated paths |
| Credentials in `.env` | `backend/.env` | Not git-committed but plaintext on disk |

### D — Denial of Service
| Threat | Target | Notes |
|---|---|---|
| No rate limiting | All endpoints | Unlimited AI calls via `/run` |
| No request body size limit | `POST /run`, `/session/{id}/run` | `input_data` could be unbounded |
| Sync HTTP in async context | `verify_supabase_jwt` | `httpx.get()` blocks event loop; can starve all requests |
| Unbounded regeneration (no limit on `/run`) | `/run` | No session, no counter |

### E — Elevation of Privilege
| Threat | Target | Notes |
|---|---|---|
| Service role default in MemoryRepository | `MemoryRepository()` | Default ctor uses service role, bypasses RLS |
| Cross-user data access via `/run` | Pipeline → MemoryRepository | `/run` has no user_id, uses service role |
| Linear token escalation | `/api/linear/sync` | Attacker controls arbitrary mutations on victim's Linear workspace |
