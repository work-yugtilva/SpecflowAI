# main.py — FastAPI entry point for the SpecFlow pipeline

import json
import logging
import os
import sys

# Ensure imports resolve from this directory
sys.path.insert(0, os.path.dirname(__file__))

from services.config.load_env import load_root_env

REQUIRED_ENV_VARS = [
    "ANTHROPIC_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    # TOKEN_ENCRYPTION_KEY: required to encrypt OAuth tokens; lazy-loaded so the API can
    # start (e.g. Railway /health) before the variable is present — set it for integrations.
]


def validate_required_env() -> None:
    missing = []
    for var in REQUIRED_ENV_VARS:
        if var == "SUPABASE_URL":
            if not (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")):
                missing.append("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)")
        else:
            if not os.environ.get(var):
                missing.append(var)
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}"
        )


load_root_env()
# Monorepo .env often sets NEXT_PUBLIC_SUPABASE_ANON_KEY only; mirror for FastAPI.
if not os.environ.get("SUPABASE_ANON_KEY") and os.environ.get(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
):
    os.environ["SUPABASE_ANON_KEY"] = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
validate_required_env()

import sentry_sdk

if dsn := os.environ.get("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=dsn,
        traces_sample_rate=0.1,
        environment=os.environ.get("NODE_ENV", "development"),
    )

from dataclasses import dataclass
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
import asyncio
from pydantic import BaseModel, Field, model_validator
from typing import Any, Literal, Optional
from urllib.parse import urlparse
from supabase import AsyncClient, acreate_client

from services.pipeline import Pipeline
from services.session.session_manager import SessionManager
from services.db.models.session import SESSION_STATUS_COMPLETED
from services.pipeline_repository import PipelineRepository
from services.db.models.pipeline import PipelineRun, PIPELINE_STATUS_ORPHANED, PIPELINE_STATUS_COMPLETED
from services.agent_factory import AgentFactory
from services.memory.memory_repository import MemoryRepository
from services.memory.memory_schemas import MemoryEntry
from contextlib import asynccontextmanager
from services.job_registry import (
    create_job,
    get_job,
    create_prd_job,
    get_prd_job,
    finish_prd_job,
    PrdJob,
)
from services.job_repository import JobRepository
from services.db.supabase_client import get_supabase_client
from middleware.verify_supabase_token import SupabaseUser, require_auth
from services.plan.plan_service import PlanService
from services.integration_service import (
    save_integration,
    get_integration,
    delete_integration,
)
from services.security.rate_limiter import (
    limiter,
    PIPELINE_RUN_LIMIT,
    AGENT_HANDOFF_LIMIT,
    GENERAL_API_LIMIT,
)
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


@dataclass
class AuthContext:
    user_id: str
    client: Any
    id: str = ""
    email: str = ""
    role: str = ""

    def __post_init__(self) -> None:
        if not self.id:
            self.id = self.user_id


# Backward-compatible export for existing dependency overrides/tests.
require_auth_context = require_auth


def _read_supabase_url() -> str | None:
    return os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")


def _read_supabase_anon_key() -> str | None:
    return os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")


def _parse_bearer_token(auth_header: str | None) -> str:
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = auth_header[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return token


async def _create_user_async_supabase_client(auth_header: str | None) -> AsyncClient:
    token = _parse_bearer_token(auth_header)
    url = _read_supabase_url()
    anon_key = _read_supabase_anon_key()
    if not url or not anon_key:
        raise RuntimeError("Missing Supabase environment variables")
    client = await acreate_client(url, anon_key)
    client.postgrest.auth(token)
    return client


# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------

class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "time": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        })

_handler = logging.StreamHandler()
_handler.setFormatter(_JsonFormatter())
logging.getLogger().addHandler(_handler)
logging.getLogger().setLevel(logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

def _is_production() -> bool:
    return os.environ.get("NODE_ENV", "").lower() == "production"


def _hostname_from_url_or_host(raw: str) -> str | None:
    s = raw.strip()
    if not s:
        return None
    if "://" not in s:
        s = f"https://{s}"
    try:
        host = urlparse(s).hostname
    except ValueError:
        return None
    return host.lower() if host else None


def _build_allowed_hosts() -> list[str]:
    hosts = {"localhost", "127.0.0.1", "test"}
    # Railway deployment healthchecks use this Host header (see Railway healthcheck docs).
    hosts.update({"healthcheck.railway.app", "*.railway.app"})
    if not _is_production():
        hosts.update({"*.loca.lt", "*.ngrok-free.app", "*.trycloudflare.com"})
    raw_hosts = os.environ.get("ALLOWED_HOSTS", "")
    for host in raw_hosts.split(","):
        cleaned = host.strip()
        if cleaned:
            hosts.add(cleaned)

    # Railway public hostname (default *.up.railway.app or custom domain when configured).
    rail_pub = _hostname_from_url_or_host(os.environ.get("RAILWAY_PUBLIC_DOMAIN", ""))
    if rail_pub:
        hosts.add(rail_pub)

    # Browser Origin hosts (e.g. https://specflowai.com) — add api.* via TRUSTED_HOST_SUFFIX below.
    raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
    for part in raw_origins.split(","):
        h = _hostname_from_url_or_host(part)
        if h:
            hosts.add(h)

    for env_name in (
        "FRONTEND_URL",
        "NEXT_PUBLIC_PIPELINE_URL",
        "NEXT_PUBLIC_EXPRESS_API_URL",
        "PIPELINE_PUBLIC_URL",
        "PUBLIC_URL",
    ):
        value = os.environ.get(env_name)
        if not value:
            continue
        parsed = urlparse(value)
        if parsed.hostname:
            hosts.add(parsed.hostname.lower())

    # e.g. TRUSTED_HOST_SUFFIX=specflowai.com → allows api.specflowai.com when CORS only lists https://specflowai.com
    suffix = (os.environ.get("TRUSTED_HOST_SUFFIX") or "").strip().lstrip("*.")
    if suffix:
        hosts.add(suffix)
        hosts.add(f"*.{suffix}")

    return sorted(hosts)


def _get_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "")
    if not raw:
        if _is_production():
            raise RuntimeError(
                "[SECURITY] ALLOWED_ORIGINS must be set in production. "
                "Example: https://app.specflow.ai,https://specflow.ai"
            )
        return [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
        ]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


MAX_REQUEST_BODY_BYTES = 512 * 1024  # 512 KB

@asynccontextmanager
async def lifespan(app):
    """Mark any jobs that were still 'running' when the process last died as failed."""
    if not (os.environ.get("TOKEN_ENCRYPTION_KEY") or "").strip():
        logger.warning(
            "TOKEN_ENCRYPTION_KEY is unset — pipeline and /health run, but OAuth integration "
            "encrypt/decrypt will fail until you set a 32-byte key (base64). See .env.example."
        )
    try:
        repo = JobRepository()
        await repo.mark_stale_as_failed(older_than_minutes=10)
        logger.info("Startup: stale running jobs marked as failed")
    except Exception as e:
        logger.warning(f"Startup stale-job cleanup failed: {e}")
    yield


_background_tasks: set[asyncio.Task] = set()

app = FastAPI(
    title="SpecFlow Pipeline API",
    version="1.0.0",
    docs_url=None if _is_production() else "/docs",
    redoc_url=None if _is_production() else "/redoc",
    openapi_url=None if _is_production() else "/openapi.json",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

class RequestBodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Fast path: Content-Length header present
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                if int(content_length) > MAX_REQUEST_BODY_BYTES:
                    return JSONResponse(
                        status_code=413,
                        content={"error": "Request body too large"},
                    )
            except ValueError:
                pass  # Invalid content-length header, let it through
            return await call_next(request)

        # Slow path: no Content-Length — stream and count actual bytes
        # Only do this for requests that might have a body (POST, PUT, PATCH)
        if request.method not in ("POST", "PUT", "PATCH"):
            return await call_next(request)

        body = b""
        try:
            async for chunk in request.stream():
                body += chunk
                if len(body) > MAX_REQUEST_BODY_BYTES:
                    return JSONResponse(
                        status_code=413,
                        content={"error": "Request body too large"},
                    )
        except Exception:
            # If we can't read the body, let downstream handle it
            return await call_next(request)

        # Replay the consumed body for downstream handlers using a proper async generator
        body_sent = False

        async def receive():
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            # This shouldn't normally be called again, but return disconnect if it is
            return {"type": "http.disconnect"}

        # Replace the receive callable in the scope
        request.scope["receive"] = receive
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'none'"
        return response


app.add_middleware(SecurityHeadersMiddleware)
# Railway (and similar) terminate TLS at the edge; internal HTTP healthchecks must not get
# 307 loops. Only enforce app-level HTTPS redirect in production when not on Railway.
if (
    os.getenv("ENVIRONMENT", "").lower() == "production"
    and not os.getenv("RAILWAY_PROJECT_ID")
):
    app.add_middleware(HTTPSRedirectMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
    max_age=600,
)
app.add_middleware(SentryAsgiMiddleware)
app.add_middleware(RequestBodySizeLimitMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=_build_allowed_hosts())


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    get_validation_errors = exc.errors
    validation_errors = get_validation_errors()
    logger.warning(
        "Validation error on %s %s: %s",
        request.method,
        request.url.path,
        validation_errors,
        extra={
            "user_id": getattr(
                getattr(request.state, "user", None), "user_id", "anonymous"
            )
        },
    )
    safe_errors = [
        {
            "field": " -> ".join(str(loc) for loc in err.get("loc", [])),
            "message": err.get("msg", "Invalid value"),
        }
        for err in validation_errors
    ]
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation failed",
            "details": safe_errors,
            "detail": safe_errors,
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    if exc.status_code >= 500:
        logger.error(
            "HTTP %s on %s %s",
            exc.status_code,
            request.method,
            request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "An internal error occurred.",
                "detail": "An internal error occurred.",
            },
        )
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": detail, "detail": detail},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "Unhandled exception on %s %s",
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={"error": "An internal error occurred."},
    )


# NOTE: This handler catches all unguarded ValueErrors across the application.
# Any route that needs a different status code for ValueError (e.g., 404)
# must catch the exception locally before it reaches this handler.
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    msg = exc.__str__()
    if msg.startswith("INCOMPLETE_CONTEXT:"):
        fields = msg.split(":", 1)[1].split(",")
        return JSONResponse(
            status_code=422,
            content={"error": "INCOMPLETE_CONTEXT", "missing": fields}
        )
    # All other ValueErrors: log internally, return generic error to client
    logger.error("Unhandled ValueError: %s", msg)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

_MAX_INPUT_NESTING = 10


def _check_dict_depth(value: Any, max_depth: int = _MAX_INPUT_NESTING, current: int = 0) -> None:
    """Reject payloads with dict/list nesting deeper than max_depth to prevent memory exhaustion."""
    if current > max_depth:
        raise ValueError(f"Input data nesting depth exceeds maximum of {max_depth} levels")
    if isinstance(value, dict):
        for v in value.values():
            _check_dict_depth(v, max_depth, current + 1)
    elif isinstance(value, list):
        for item in value:
            _check_dict_depth(item, max_depth, current + 1)


class RunRequest(BaseModel):
    input_data: dict[str, Any]
    project_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_nesting_depth(self) -> "RunRequest":
        _check_dict_depth(self.input_data)
        return self


class CreateSessionRequest(BaseModel):
    session_name: str = Field(..., min_length=1, max_length=200)
    project_id: Optional[str] = None
    metadata: Optional[dict] = Field(default={})


class SessionRunRequest(BaseModel):
    input_data: dict[str, Any]
    step: Optional[str] = None      # agent name for interactive step-by-step mode

    @model_validator(mode="after")
    def validate_nesting_depth(self) -> "SessionRunRequest":
        _check_dict_depth(self.input_data)
        return self


class AttachPipelineRequest(BaseModel):
    pipeline_id: str
    session_id: str


class EditPRDSectionRequest(BaseModel):
    section_key: str = Field(..., max_length=200)
    instruction: str = Field(..., max_length=10_000)
    current_section_value: Any
    full_prd: dict


class FeedbackEntry(BaseModel):
    prd_section: str
    prd_item_title: str
    feedback_type: Literal["validated", "invalidated", "partial", "deferred"]
    outcome_note: Optional[str] = ""
    linked_problem_ids: Optional[list[str]] = []
    linked_research_ids: Optional[list[str]] = []


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=50_000)


class ConversationRequest(BaseModel):
    messages: list[ConversationMessage]
    session_context_keys: Optional[list[str]] = []


class QueryRequest(BaseModel):
    question: str = Field(..., max_length=10_000)


class IntegrationUpsertRequest(BaseModel):
    access_token: str = Field(..., max_length=4_096)
    refresh_token: Optional[str] = Field(None, max_length=4_096)
    metadata: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Routes — health + legacy /run (unchanged)
# ---------------------------------------------------------------------------

PIPELINE_PORT = int(os.environ.get("PIPELINE_PORT", "8001"))

IntegrationProvider = Literal["github", "jira", "linear", "notion", "confluence"]


@app.get("/health")
async def health(request: Request):
    """Liveness probe — no auth, no rate limit (Railway/K8s healthchecks)."""
    return {"status": "ok", "service": "specflow-pipeline"}


@app.get("/integrations/{provider}")
@limiter.limit(GENERAL_API_LIMIT)
async def get_user_integration(
    request: Request,
    provider: IntegrationProvider,
    auth: SupabaseUser = Depends(require_auth),
):
    try:
        user_client = await _create_user_async_supabase_client(
            request.headers.get("authorization")
        )
        integration = await get_integration(user_client, auth.user_id, provider)
        return {"success": True, "data": integration}
    except ValueError:
        raise HTTPException(
            status_code=500,
            detail="Failed to decrypt integration token",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_user_integration error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.put("/integrations/{provider}")
@limiter.limit(GENERAL_API_LIMIT)
async def upsert_user_integration(
    request: Request,
    provider: IntegrationProvider,
    req: IntegrationUpsertRequest,
    auth: SupabaseUser = Depends(require_auth),
):
    try:
        user_client = await _create_user_async_supabase_client(
            request.headers.get("authorization")
        )
        saved = await save_integration(
            client=user_client,
            user_id=auth.user_id,
            provider=provider,
            access_token=req.access_token,
            refresh_token=req.refresh_token,
            metadata=req.metadata,
        )
        return {"success": True, "data": saved}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("upsert_user_integration error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/integrations/{provider}")
@limiter.limit(GENERAL_API_LIMIT)
async def remove_user_integration(
    request: Request,
    provider: IntegrationProvider,
    auth: SupabaseUser = Depends(require_auth),
):
    try:
        user_client = await _create_user_async_supabase_client(
            request.headers.get("authorization")
        )
        await delete_integration(user_client, auth.user_id, provider)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("remove_user_integration error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/run")
@limiter.limit(GENERAL_API_LIMIT)
async def run_pipeline(request: Request, req: RunRequest, auth: SupabaseUser = Depends(require_auth)):
    try:
        logger.info("[pipeline] Starting run | project_id=%s", req.project_id)
        pipeline = Pipeline()
        result = await pipeline.run(req.input_data, req.project_id)
        logger.info("[pipeline] Run complete | keys=%s", list(result.keys()))
        return {"success": True, "data": result}
    except ValueError:
        raise
    except Exception as e:
        logger.exception("[pipeline] Error")
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# Routes — User Plan
# ---------------------------------------------------------------------------

@app.get("/user/plan")
@limiter.limit(GENERAL_API_LIMIT)
async def get_user_plan(request: Request, auth: SupabaseUser = Depends(require_auth)):
    """Return the authenticated user's plan and current usage."""
    try:
        plan_svc = PlanService()
        return await plan_svc.get_user_plan(auth.user_id)
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_user_plan failed")
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# Routes — Session System
# IMPORTANT: /session/create must be declared BEFORE /session/{session_id}
# so FastAPI does not treat the literal "create" as a session_id path param.
# ---------------------------------------------------------------------------

@app.get("/sessions")
@limiter.limit(GENERAL_API_LIMIT)
async def list_sessions(request: Request, auth: SupabaseUser = Depends(require_auth)):
    """Return all sessions ordered by created_at DESC."""
    try:
        logger.info("[session] Listing sessions")
        sm = SessionManager(client=auth.client)
        logger.info("[session] SessionManager instantiated")
        sessions = await sm.list_sessions()
        logger.info("[session] Found %s sessions", len(sessions))
        return {"sessions": [s.model_dump() for s in sessions]}
    except Exception as e:
        logger.exception("[session] Error listing sessions")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/create")
@limiter.limit(GENERAL_API_LIMIT)
async def create_session(request: Request, req: CreateSessionRequest, auth: SupabaseUser = Depends(require_auth)):
    """Create a new session. Returns session_id to use in subsequent /session/{id}/run calls."""
    try:
        logger.info("[session] Creating session: %s", req.session_name)
        sm = SessionManager(client=auth.client)
        logger.info("[session] SessionManager instantiated")
        session = await sm.create_session(
            session_name=req.session_name,
            project_id=req.project_id,
            metadata=req.metadata,
            user_id=auth.user_id,
        )
        logger.info("[session] Session created: %s", session.id)
        return {
            "session_id": session.id,
            "session_name": session.session_name,
            "status": session.status,
            "created_at": session.created_at.isoformat() if session.created_at else None,
        }
    except Exception as e:
        logger.exception("[session] Error creating session")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/{session_id}/run")
@limiter.limit(PIPELINE_RUN_LIMIT)
async def run_session(request: Request, session_id: str, req: SessionRunRequest, auth: SupabaseUser = Depends(require_auth)):
    """
    Run the pipeline (or a single step) for an existing session.

    Resumability:
    - On retry after failure: pipeline automatically skips completed steps.
    - Interactive mode: pass `step` to run only that one agent.

    Returns the full output data and current session state snapshot.
    """
    try:
        sm = SessionManager(client=auth.client)
        session = await sm.load_session(session_id)
        if session.user_id != auth.user_id:
            raise HTTPException(status_code=404, detail="Session not found")

        # Only block full-pipeline re-runs on completed sessions.
        # Single-step re-runs (req.step is set) are always allowed so users
        # can regenerate individual steps after the pipeline finishes.
        if session.status == SESSION_STATUS_COMPLETED and req.step is None:
            raise HTTPException(
                status_code=400,
                detail=f"Session {session_id} is already completed.",
            )

        # Check regeneration limit for single-step re-runs (3 per step).
        if req.step is not None:
            pre_state = await sm.get_current_state(session_id)
            regen_counts = (pre_state or {}).get("regeneration_counts", {})
            if regen_counts.get(req.step, 0) >= 3:
                raise HTTPException(
                    status_code=403,
                    detail="Regeneration limit reached. Please edit the document manually.",
                )

        # Enforce plan-based run limits before spending API credit.
        plan_svc = PlanService()
        await plan_svc.check_limit(auth.user_id, is_full_run=(req.step is None))

        pipeline = Pipeline()
        result = await pipeline.run(
            input_data=req.input_data,
            project_id=session.project_id,
            session_id=session_id,
            session_manager=sm,
            step=req.step,
            user_id=auth.user_id,
        )

        # Record usage after a successful run.
        await plan_svc.record_usage(auth.user_id, is_full_run=(req.step is None))

        current_state = await sm.get_current_state(session_id)

        # Increment regeneration counter after a successful single-step run.
        if req.step is not None:
            regen_counts = current_state.get("regeneration_counts", {})
            regen_counts[req.step] = regen_counts.get(req.step, 0) + 1
            current_state["regeneration_counts"] = regen_counts
            await sm.update_state(
                session_id,
                current_state,
                step=current_state.get("last_completed_step", req.step),
            )

        return {
            "success": True,
            "data": result,
            "session_state": current_state,
        }
    except ValueError as e:
        msg = str(e)
        if msg.startswith("INCOMPLETE_CONTEXT:"):
            raise
        raise HTTPException(status_code=404, detail=msg)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("run_session failed for session_id=%s", session_id)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/{session_id}/run/async", status_code=202)
@limiter.limit(PIPELINE_RUN_LIMIT)
async def run_session_async(request: Request, session_id: str, req: SessionRunRequest, auth: SupabaseUser = Depends(require_auth)):
    """
    Non-blocking pipeline start. Immediately returns {job_id} with 202 Accepted
    and runs the pipeline as a background asyncio.Task.

    Subscribe to GET /session/{session_id}/run/stream/{job_id} for SSE progress events.
    """
    try:
        sm = SessionManager(client=auth.client)
        session = await sm.load_session(session_id)
        if session.user_id != auth.user_id:
            raise HTTPException(status_code=404, detail="Session not found")

        if session.status == SESSION_STATUS_COMPLETED and req.step is None:
            raise HTTPException(
                status_code=400,
                detail=f"Session {session_id} is already completed.",
            )

        if req.step is not None:
            pre_state = await sm.get_current_state(session_id)
            regen_counts = (pre_state or {}).get("regeneration_counts", {})
            if regen_counts.get(req.step, 0) >= 3:
                raise HTTPException(
                    status_code=403,
                    detail="Regeneration limit reached. Please edit the document manually.",
                )

        # Enforce plan-based run limits before queuing the background job.
        plan_svc = PlanService()
        await plan_svc.check_limit(auth.user_id, is_full_run=(req.step is None))

        # Capture is_full_run for the closure below.
        _is_full_run = req.step is None
        _user_id_for_plan = auth.user_id

        job = await create_job(session_id, user_id=auth.user_id)

        async def _run_bg():
            # INTERNAL BACKGROUND OPERATION: Use service-role client for all DB operations.
            # Rationale: The user's JWT (auth.client) expires during long-running pipeline runs.
            # Authorization was already verified above before this task was queued.
            # This is necessary to persist job status, session state, and memory entries
            # independent of the user's session lifetime.
            bg_sm = SessionManager(client=get_supabase_client())
            repo = JobRepository()
            job.status = "running"
            await repo.update_status(job.job_id, "running")
            # Defense-in-depth: re-verify session ownership with service-role client.
            bg_session = await bg_sm.load_session(session_id)
            if bg_session.user_id != auth.user_id:
                logger.error("_run_bg ownership mismatch for session_id=%s user_id=%s", session_id, auth.user_id)
                job.status = "failed"
                await repo.update_status(job.job_id, "failed", error="Internal server error")
                await job.queue.put({"type": "error", "message": "Internal server error"})
                await job.queue.put(None)
                return
            try:
                async def _cb(event: dict):
                    await job.queue.put(event)

                pipeline = Pipeline()
                result = await pipeline.run(
                    input_data=req.input_data,
                    project_id=session.project_id,
                    session_id=session_id,
                    session_manager=bg_sm,
                    step=req.step,
                    progress_callback=_cb,
                    user_id=auth.user_id,
                )

                # Record usage after a successful background run.
                await plan_svc.record_usage(_user_id_for_plan, is_full_run=_is_full_run)

                current_state = await bg_sm.get_current_state(session_id)

                if req.step is not None:
                    regen_counts = current_state.get("regeneration_counts", {})
                    regen_counts[req.step] = regen_counts.get(req.step, 0) + 1
                    current_state["regeneration_counts"] = regen_counts
                    await bg_sm.update_state(
                        session_id,
                        current_state,
                        step=current_state.get("last_completed_step", req.step),
                    )

                try:
                    completion_event = {
                        "type": "complete",
                        "data": result,
                        "session_state": current_state,
                    }
                    # Verify the event is JSON-serializable before putting it in the queue
                    json.dumps(completion_event)
                    await job.queue.put(completion_event)
                except (TypeError, ValueError) as ser_err:
                    logger.error("[stream] Serialization error for completion event: %s", ser_err, exc_info=True)
                    await job.queue.put({"type": "error", "message": "Failed to serialize pipeline result"})

                job.status = "completed"
                await repo.update_status(job.job_id, "completed", result=result)
            except HTTPException as e:
                await job.queue.put({"type": "error", "message": e.detail, "status_code": e.status_code})
                job.status = "failed"
                await repo.update_status(job.job_id, "failed", error=e.detail)
            except ValueError as e:
                msg = str(e)
                await job.queue.put({"type": "error", "message": msg})
                job.status = "failed"
                await repo.update_status(job.job_id, "failed", error=msg)
            except Exception as e:
                logger.exception(
                    "run_session_async background failure for session_id=%s",
                    session_id,
                )
                await job.queue.put({"type": "error", "message": "Internal server error"})
                job.status = "failed"
                await repo.update_status(job.job_id, "failed", error="Internal server error")
            finally:
                await job.queue.put(None)  # sentinel — tells SSE generator to close

        task = asyncio.create_task(_run_bg())
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
        return {"job_id": job.job_id, "status": "pending"}

    except HTTPException:
        raise
    except ValueError as e:
        msg = str(e)
        if msg.startswith("INCOMPLETE_CONTEXT:"):
            raise
        raise HTTPException(status_code=404, detail=msg)
    except Exception:
        logger.exception("run_session_async failed for session_id=%s", session_id)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/session/{session_id}/run/stream/{job_id}")
async def stream_run(request: Request, session_id: str, job_id: str, auth: SupabaseUser = Depends(require_auth)):
    """
    SSE stream for a background pipeline job started via POST /session/{id}/run/async.

    Events:
      {"type": "connected"}                          — immediate on subscribe
      {"type": "step_complete", "step": "problems"}  — after each step finishes
      {"type": "complete", "data": {...}, "session_state": {...}} — pipeline done
      {"type": "error", "message": "..."}            — on failure
      {"type": "heartbeat"}                          — every 25s to keep connection alive
    """
    sm = SessionManager(client=auth.client)
    await sm.load_session(session_id)

    job = get_job(job_id)
    if not job or job.session_id != session_id or job.user_id != auth.user_id:
        raise HTTPException(status_code=404, detail="Job not found")

    async def _generate():
        deadline = asyncio.get_event_loop().time() + 600
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"
        received_completion = False
        while True:
            if asyncio.get_event_loop().time() > deadline:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Stream timeout'})}\n\n"
                break
            try:
                event = await asyncio.wait_for(job.queue.get(), timeout=25.0)
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                continue
            if event is None:  # sentinel
                if not received_completion:
                    logger.warning("[stream] Stream ended without completion event for job_id=%s", job_id)
                break
            try:
                yield f"data: {json.dumps(event)}\n\n"
            except (TypeError, ValueError) as e:
                logger.error("[stream] Failed to serialize event: %s event=%s", e, event, exc_info=True)
                yield f"data: {json.dumps({'type': 'error', 'message': 'Serialization error'})}\n\n"
                break
            if event.get("type") in ("complete", "error"):
                received_completion = True
                break

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/session/{session_id}/job/{job_id}/status")
async def get_job_status(
    request: Request,
    session_id: str,
    job_id: str,
    auth: SupabaseUser = Depends(require_auth),
):
    """
    Poll durable job state after SSE disconnect or on reconnect.

    Returns current status from the `jobs` table. When status is 'completed'
    the result is included; when 'failed' the error message is included.
    Use this endpoint instead of reconnecting to the SSE stream after a disconnect.
    """
    repo = JobRepository()
    row = await repo.get_by_id(job_id)
    if not row or row["session_id"] != session_id or row["user_id"] != auth.user_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job_id,
        "session_id": session_id,
        "status": row["status"],
        "job_type": row["job_type"],
        "result": row.get("result"),
        "error": row.get("error"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


@app.post("/session/{session_id}/prd")
@limiter.limit(GENERAL_API_LIMIT)
async def generate_prd(request: Request, session_id: str, auth: SupabaseUser = Depends(require_auth)):
    """
    Generate a PRD for an existing session using the accumulated pipeline outputs.
    Reads problems, features, decompositions, tasks from session state and runs PRDAgent.
    Returns 422 if any prerequisite step output is missing.
    """
    try:
        sm = SessionManager(client=auth.client)
        session = await sm.load_session(session_id)
        if session.user_id != auth.user_id:
            raise HTTPException(status_code=404, detail="Session not found")

        current_state = await sm.get_current_state(session_id)

        # Check regeneration limit for PRD (3 regenerations max).
        regen_counts = (current_state or {}).get("regeneration_counts", {})
        if regen_counts.get("prd", 0) >= 3:
            raise HTTPException(
                status_code=403,
                detail="Regeneration limit reached. Please edit the document manually.",
            )

        outputs = (current_state or {}).get("outputs", {})

        context = {
            key: Pipeline._unwrap_persisted_content(outputs.get(key, []))
            for key in ("product_context", "problems", "features", "decompositions", "tasks")
        }
        if outputs.get("rag_context"):
            context["rag_context"] = Pipeline._unwrap_persisted_content(outputs["rag_context"])

        # Validate prerequisites (product_context is optional)
        missing = [k for k in ("problems", "features", "decompositions", "tasks")
                    if not context.get(k)]
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Run {', '.join(missing)} first",
            )

        agent = AgentFactory.create("prd")
        result, quality = await agent.run(context)
        result = Pipeline._strip_reasoning_field(result)
        quality = Pipeline._strip_reasoning_field(quality)
        _, citation_metadata = Pipeline._extract_citation_metadata(
            result.get("features", []) if isinstance(result, dict) else result
        )

        # Persist to memory
        entry = MemoryEntry(
            session_id=session_id,
            user_id=auth.user_id,
            agent_name="prd",
            memory_key="prd",
            content=result if isinstance(result, dict) else {"data": result},
            metadata={"quality_score": quality, "citations": citation_metadata},
        )
        memory_repo = MemoryRepository(client=auth.client)
        await memory_repo.save_for_session(entry)

        # Increment PRD regeneration counter.
        regen_counts["prd"] = regen_counts.get("prd", 0) + 1
        current_state["regeneration_counts"] = regen_counts
        await sm.update_state(
            session_id,
            current_state,
            step=current_state.get("last_completed_step", "prd"),
        )

        return {"success": True, "prd": result, "quality_score": quality}
    except HTTPException:
        raise
    except ValueError as e:
        logger.error("generate_prd ValueError: %s", e, exc_info=True)
        raise HTTPException(status_code=422, detail="Invalid input data")
    except Exception:
        logger.exception("generate_prd failed for session_id=%s", session_id)
        raise HTTPException(status_code=500, detail="Internal server error")


async def _run_prd_background(
    job: PrdJob,
    context: dict,
    session_id: str,
    auth_user_id: str,
    sm: SessionManager,
    current_state: dict,
) -> None:
    """
    Background task for PRD generation. Runs independently of the HTTP connection so
    the result survives a client disconnect. Pushes phase-update events to job.queue
    for the initial SSE consumer, then calls finish_prd_job() which signals done_event
    and writes to the jobs table so reconnecting clients can retrieve the outcome.
    """
    try:
        repo = JobRepository()
        await repo.update_status(job.job_id, "running")
        # Defense-in-depth: re-verify session ownership with service-role client.
        svc_sm = SessionManager(client=get_supabase_client())
        bg_session = await svc_sm.load_session(session_id)
        if bg_session.user_id != auth_user_id:
            logger.error("_run_prd_background ownership mismatch for session_id=%s user_id=%s", session_id, auth_user_id)
            await finish_prd_job(job.job_id, error="Internal server error")
            return

        agent = AgentFactory.create("prd")
        result_container: dict = {}

        async def run_agent() -> None:
            result, quality = await agent.run(context)
            result_container["result"] = result
            result_container["quality"] = quality

        agent_task = asyncio.create_task(run_agent())

        progress = 30
        await job.queue.put({"type": "phase", "phase": "Drafting PRD...", "progress": progress})
        while not agent_task.done():
            await asyncio.sleep(2)
            if not agent_task.done():
                progress = min(progress + 10, 85)
                await job.queue.put({"type": "phase", "phase": "Drafting PRD...", "progress": progress})

        await agent_task  # propagate exceptions

        result = result_container["result"]
        quality = result_container["quality"]
        result = Pipeline._strip_reasoning_field(result)
        quality = Pipeline._strip_reasoning_field(quality)
        _, citation_metadata = Pipeline._extract_citation_metadata(
            result.get("features", []) if isinstance(result, dict) else result
        )

        await job.queue.put({"type": "phase", "phase": "Quality check...", "progress": 90})

        entry = MemoryEntry(
            session_id=session_id,
            user_id=auth_user_id,
            agent_name="prd",
            memory_key="prd",
            content=result if isinstance(result, dict) else {"data": result},
            metadata={"quality_score": quality, "citations": citation_metadata},
        )
        memory_repo = MemoryRepository(client=get_supabase_client())
        await memory_repo.save_for_session(entry)

        # Increment PRD regeneration counter.
        regen_counts = (current_state or {}).get("regeneration_counts", {})
        regen_counts["prd"] = regen_counts.get("prd", 0) + 1
        current_state["regeneration_counts"] = regen_counts
        await sm.update_state(
            session_id,
            current_state,
            step=current_state.get("last_completed_step", "prd"),
        )

        complete_payload = {
            "type": "complete",
            "prd": result,
            "quality_score": quality,
            "citations": citation_metadata,
            "progress": 100,
        }
        await finish_prd_job(job.job_id, payload=complete_payload)

    except Exception:
        logger.exception("_run_prd_background failed for session_id=%s", session_id)
        await finish_prd_job(job.job_id, error="Internal server error")


@app.post("/session/{session_id}/prd/stream")
@limiter.limit(GENERAL_API_LIMIT)
async def generate_prd_stream(
    request: Request,
    session_id: str,
    job_id: Optional[str] = Query(None),
    auth: SupabaseUser = Depends(require_auth),
):
    """
    SSE streaming PRD generation. Sends phase updates then final result.

    Pass ?job_id=<id> to reconnect after a disconnect rather than restarting generation.
    Reconnect behaviour:
      - Job in memory + running  → wait for completion, then emit stored result/error
      - Job in memory + done     → emit stored result/error immediately
      - Job in DB as completed   → fetch from memory_entries, emit complete event
      - Job in DB as failed      → emit error event
      - Orphaned / not found     → emit error asking user to regenerate
    """
    _SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}

    # ── Reconnect path ────────────────────────────────────────────────────────
    if job_id:
        async def reconnect_stream():
            prd_job = get_prd_job(job_id)
            if prd_job is not None:
                # Verify ownership
                if prd_job.session_id != session_id or prd_job.user_id != auth.user_id:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Job not found.'})}\n\n"
                    return
                if not prd_job.done_event.is_set():
                    yield f"data: {json.dumps({'type': 'phase', 'phase': 'Resuming generation...', 'progress': 50})}\n\n"
                    await prd_job.done_event.wait()
                if prd_job.complete_payload:
                    yield f"data: {json.dumps(prd_job.complete_payload)}\n\n"
                else:
                    msg = prd_job.error_message or "PRD generation failed"
                    yield f"data: {json.dumps({'type': 'error', 'message': msg})}\n\n"
                return

            # Job evicted from memory — check DB
            repo = JobRepository()
            row = await repo.get_by_id(job_id)
            if (
                not row
                or row.get("session_id") != session_id
                or row.get("user_id") != auth.user_id
            ):
                yield f"data: {json.dumps({'type': 'error', 'message': 'Job not found. Please generate a new PRD.'})}\n\n"
                return

            db_status = row.get("status")
            if db_status == "completed":
                memory_repo = MemoryRepository(client=auth.client)
                mem_entry = await memory_repo.get_by_session_and_key(session_id, "prd")
                if mem_entry:
                    stored = Pipeline._unwrap_persisted_content(mem_entry.content)
                    meta = mem_entry.metadata or {}
                    yield f"data: {json.dumps({'type': 'complete', 'prd': stored, 'quality_score': meta.get('quality_score'), 'citations': meta.get('citations'), 'progress': 100})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'PRD result not found in storage. Please regenerate.'})}\n\n"
            elif db_status == "failed":
                err = row.get("error") or "PRD generation failed on the server."
                yield f"data: {json.dumps({'type': 'error', 'message': err})}\n\n"
            else:
                # running in DB but not in memory = orphaned by backend restart
                yield f"data: {json.dumps({'type': 'error', 'message': 'Generation was interrupted by a server restart. Please generate again.'})}\n\n"

        return StreamingResponse(reconnect_stream(), media_type="text/event-stream", headers=_SSE_HEADERS)

    # ── New generation path ───────────────────────────────────────────────────
    async def event_stream():
        try:
            sm = SessionManager(client=auth.client)
            session = await sm.load_session(session_id)
            if session.user_id != auth.user_id:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
                return
            current_state = await sm.get_current_state(session_id)

            # Check regeneration limit for PRD (3 regenerations max).
            regen_counts = (current_state or {}).get("regeneration_counts", {})
            if regen_counts.get("prd", 0) >= 3:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Regeneration limit reached. Please edit the document manually.'})}\n\n"
                return

            outputs = (current_state or {}).get("outputs", {})

            context = {
                key: Pipeline._unwrap_persisted_content(outputs.get(key, []))
                for key in ("product_context", "problems", "features", "decompositions", "tasks")
            }
            if outputs.get("rag_context"):
                context["rag_context"] = Pipeline._unwrap_persisted_content(outputs["rag_context"])

            missing = [k for k in ("problems", "features", "decompositions", "tasks")
                       if not context.get(k)]
            if missing:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Run {chr(44).join(missing)} first'})}\n\n"
                return

            # Create background job and emit job_id so client can resume on disconnect
            prd_job = await create_prd_job(session_id, auth.user_id)
            yield f"data: {json.dumps({'type': 'job_created', 'job_id': prd_job.job_id})}\n\n"

            yield f"data: {json.dumps({'type': 'phase', 'phase': 'Loading context...', 'progress': 10})}\n\n"
            await asyncio.sleep(0.1)

            # Launch background task — survives client disconnect
            _prd_task = asyncio.create_task(
                _run_prd_background(
                    job=prd_job,
                    context=context,
                    session_id=session_id,
                    auth_user_id=auth.user_id,
                    sm=sm,
                    current_state=current_state,
                )
            )
            _background_tasks.add(_prd_task)
            _prd_task.add_done_callback(_background_tasks.discard)

            # Stream phase updates from background task queue until _done sentinel
            while True:
                event = await prd_job.queue.get()
                if event.get("type") == "_done":
                    break
                yield f"data: {json.dumps(event)}\n\n"

            # Emit final result (already stored in prd_job by finish_prd_job)
            if prd_job.complete_payload:
                yield f"data: {json.dumps(prd_job.complete_payload)}\n\n"
            else:
                msg = prd_job.error_message or "PRD generation failed"
                yield f"data: {json.dumps({'type': 'error', 'message': msg})}\n\n"

        except Exception:
            logger.exception("generate_prd_stream event_stream failed for session_id=%s", session_id)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Internal server error'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=_SSE_HEADERS)


@app.get("/session/{session_id}/prd")
async def get_prd(request: Request, session_id: str, auth: SupabaseUser = Depends(require_auth)):
    """Load stored PRD from memory_entries for a session."""
    try:
        memory_repo = MemoryRepository(client=auth.client)
        entry = await memory_repo.get_by_session_and_key(session_id, "prd")
        if not entry:
            raise HTTPException(status_code=404, detail="No PRD found for this session")
        prd = Pipeline._unwrap_persisted_content(entry.content)
        quality = entry.metadata.get("quality_score") if entry.metadata else None
        citations = entry.metadata.get("citations") if entry.metadata else None
        return {"prd": prd, "quality_score": quality, "citations": citations}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


EXPORT_SECTIONS = {
    "full": ["executive_summary", "problem_statement", "goals", "features", "architecture", "implementation_plan", "risks", "success_metrics"],
    "engineering": ["features", "architecture", "implementation_plan"],
    "executive": ["executive_summary", "problem_statement", "goals", "risks", "success_metrics"],
}


@app.get("/session/{session_id}/prd/export")
async def export_prd_markdown(request: Request, session_id: str, view: str = "full", auth: SupabaseUser = Depends(require_auth)):
    """
    Export the session's PRD as a downloadable markdown file.
    """
    try:
        memory_repo = MemoryRepository(client=auth.client)
        entry = await memory_repo.get_by_session_and_key(session_id, "prd")
        if not entry:
            raise HTTPException(status_code=404, detail="No PRD found for this session")

        prd = Pipeline._unwrap_persisted_content(entry.content)
        if not isinstance(prd, dict):
            raise HTTPException(status_code=404, detail="PRD data is malformed")

        # Validate view param
        if view not in EXPORT_SECTIONS:
            view = "full"

        # Convert JSON sections to markdown
        lines = ["# Product Requirements Document\n"]
        section_titles = {
            "executive_summary": "Executive Summary",
            "problem_statement": "Problem Statement",
            "goals": "Goals",
            "features": "Features",
            "architecture": "Architecture",
            "implementation_plan": "Implementation Plan",
            "risks": "Risks",
            "success_metrics": "Success Metrics",
        }
        filtered_sections = {k: v for k, v in section_titles.items() if k in EXPORT_SECTIONS[view]}
        for key, title in filtered_sections.items():
            val = prd.get(key)
            if val is None:
                continue
            lines.append(f"## {title}\n")
            if isinstance(val, list):
                for item in val:
                    if not isinstance(item, dict):
                        lines.append(f"- {item}")
                        continue

                    if key == "implementation_plan":
                        phase = item.get("phase", "")
                        duration = item.get("duration", "")
                        deliverables = item.get("deliverables", [])
                        lines.append(f"\n### {phase}" + (f" ({duration})" if duration else ""))
                        for d in deliverables:
                            lines.append(f"- {d}")

                    elif key == "goals":
                        goal = item.get("goal", item.get("title", ""))
                        metric = item.get("metric", "")
                        target = item.get("target", "")
                        timeline = item.get("timeline", "")
                        lines.append(f"\n**{goal}**")
                        if metric: lines.append(f"- Metric: {metric}")
                        if target: lines.append(f"- Target: {target}")
                        if timeline: lines.append(f"- Timeline: {timeline}")

                    elif key == "features":
                        title = item.get("title", "")
                        description = item.get("description", "")
                        ac = item.get("acceptance_criteria", "")
                        linked = item.get("linked_problem", "")
                        lines.append(f"\n**{title}**")
                        if description: lines.append(description)
                        if linked: lines.append(f"*Solves: {linked}*")
                        if ac: lines.append(f"\n```\n{ac}\n```")

                    elif key == "risks":
                        risk = item.get("risk", "")
                        likelihood = item.get("likelihood", "").upper()
                        mitigation = item.get("mitigation", "")
                        lines.append(f"\n**{likelihood}: {risk}**")
                        if mitigation: lines.append(f"↳ {mitigation}")

                    elif key == "success_metrics":
                        metric = item.get("metric", "")
                        baseline = item.get("baseline", "")
                        target = item.get("target", "")
                        measurement = item.get("measurement", "")
                        lines.append(f"\n**{metric}**")
                        if baseline: lines.append(f"- Baseline: {baseline}")
                        if target: lines.append(f"- Target: {target}")
                        if measurement: lines.append(f"- Measurement: {measurement}")

                    else:
                        title = item.get("title", item.get("name", ""))
                        description = item.get("description", "")
                        if title and description:
                            lines.append(f"- **{title}**: {description}")
                        elif title:
                            lines.append(f"- {title}")
                        else:
                            lines.append(f"- {json.dumps(item)}")

            elif isinstance(val, str):
                lines.append(val)
            elif isinstance(val, dict):
                for sub_key, sub_val in val.items():
                    lines.append(f"\n**{sub_key.upper()}**")
                    lines.append(str(sub_val))
            else:
                lines.append(json.dumps(val, indent=2))
            lines.append("")

        md = "\n".join(lines)
        short_id = session_id[:8]
        if view == "engineering":
            filename = f"prd-engineering-{short_id}.md"
        elif view == "executive":
            filename = f"prd-executive-{short_id}.md"
        else:
            filename = f"prd-{short_id}.md"
        return Response(
            content=md,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("export_prd_markdown failed for session_id=%s", session_id)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/{session_id}/prd/edit")
@limiter.limit(GENERAL_API_LIMIT)
async def edit_prd_section(
    request: Request,
    session_id: str,
    body: EditPRDSectionRequest,
    auth: SupabaseUser = Depends(require_auth),
):
    """
    Rewrite a single PRD section based on a user instruction.
    Uses the full PRD as context but returns only the updated section value.
    Does NOT persist — the caller handles saving via autosave.
    """
    try:
        from services.ai.client import run_ai_async
        from json_repair import loads as repair_loads

        sm = SessionManager(client=auth.client)
        await sm.load_session(session_id)
        current_state = await sm.get_current_state(session_id)

        # Respect the PRD regeneration cap (shared counter with generate_prd)
        regen_counts = (current_state or {}).get("regeneration_counts", {})
        if regen_counts.get("prd", 0) >= 3:
            raise HTTPException(
                status_code=403,
                detail="Regeneration limit reached. Please edit the document manually.",
            )

        prompt = "\n\n".join([
            "<role>\nYou are a senior product manager rewriting a single PRD section.\n</role>",
            f"<full_prd>\n{json.dumps(body.full_prd, indent=2)}\n</full_prd>",
            f"<section_key>\n{body.section_key}\n</section_key>",
            f"<current_section_value>\n{json.dumps(body.current_section_value, indent=2)}\n</current_section_value>",
            f"<instruction>\n{body.instruction}\n</instruction>",
            (
                "<response_contract>\n"
                "Return ONLY the rewritten section value as valid JSON.\n"
                "Match the exact shape of current_section_value (string, list of objects, or dict).\n"
                "Do not wrap in an outer key. Do not emit markdown, prose, or code fences.\n"
                "</response_contract>"
            ),
        ])

        raw = await run_ai_async(prompt, max_tokens=2048)
        try:
            updated = repair_loads(raw)
        except Exception:
            raise HTTPException(status_code=500, detail="AI returned unparseable output")

        # Strip reasoning field if the model included one at the top level
        if isinstance(updated, dict) and "reasoning" in updated:
            updated = {k: v for k, v in updated.items() if k != "reasoning"}

        return {"success": True, "updated_section": updated}
    except HTTPException:
        raise
    except Exception:
        logger.error("edit_prd_section failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/{session_id}/agent_handoff")
@limiter.limit(AGENT_HANDOFF_LIMIT)
async def generate_agent_handoff(request: Request, session_id: str, auth: SupabaseUser = Depends(require_auth)):
    """Generate and persist an on-demand agent handoff for a completed session."""
    try:
        memory_repo = MemoryRepository(client=auth.client)
        required_keys: dict[str, Any] = {
            "problems": [],
            "features": [],
            "decompositions": [],
            "tasks": [],
        }
        optional_keys: dict[str, Any] = {
            "product_context": {},
            "prd": {},
        }

        context: dict[str, Any] = {}
        missing: list[str] = []
        for key, default_value in required_keys.items():
            memory_entry = await memory_repo.get_by_session_and_key(session_id, key)
            if memory_entry is None:
                missing.append(key)
                context[key] = default_value
                continue

            value = Pipeline._unwrap_persisted_content(memory_entry.content)
            context[key] = default_value if value is None else value

        for key, default_value in optional_keys.items():
            memory_entry = await memory_repo.get_by_session_and_key(session_id, key)
            if memory_entry is not None:
                value = Pipeline._unwrap_persisted_content(memory_entry.content)
                context[key] = value if value is not None else default_value
            else:
                context[key] = default_value

        if missing:
            raise HTTPException(status_code=422, detail=f"Run {', '.join(missing)} first")

        agent = AgentFactory.create("agent_handoff")
        if hasattr(agent, "run"):
            result = await agent.run(context)
        else:
            result = await agent.execute_async(
                "Generate a complete agent-ready handoff payload for the implementation tasks in this product session.",
                context=context,
            )
        result = Pipeline._strip_reasoning_field(result)

        output_entry = MemoryEntry(
            session_id=session_id,
            user_id=auth.user_id,
            agent_name="agent_handoff",
            memory_key="agent_handoff",
            content=result if isinstance(result, dict) else {"data": result},
            metadata={},
        )
        await memory_repo.save_for_session(output_entry)

        return {"handoff": result}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("generate_agent_handoff failed", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error ({type(exc).__name__})")


@app.get("/session/{session_id}/agent_handoff")
async def get_agent_handoff(request: Request, session_id: str, auth: SupabaseUser = Depends(require_auth)):
    """Load a stored agent handoff payload from memory_entries for a session."""
    try:
        memory_repo = MemoryRepository(client=auth.client)
        entry = await memory_repo.get_by_session_and_key(session_id, "agent_handoff")
        if not entry:
            raise HTTPException(status_code=404, detail="No agent handoff found for this session")
        handoff = Pipeline._unwrap_persisted_content(entry.content)
        return {"handoff": handoff}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/session/{session_id}/agent_handoff/export")
async def export_agent_handoff_markdown(request: Request, session_id: str, auth: SupabaseUser = Depends(require_auth)):
    """
    Export the session's agent handoff as a downloadable CLAUDE.md-style markdown file.
    """
    try:
        memory_repo = MemoryRepository(client=auth.client)
        entry = await memory_repo.get_by_session_and_key(session_id, "agent_handoff")
        if not entry:
            raise HTTPException(status_code=404, detail="No agent handoff found for this session")

        handoff = Pipeline._unwrap_persisted_content(entry.content)
        if not isinstance(handoff, dict):
            raise HTTPException(status_code=404, detail="Handoff data is malformed")

        lines = ["# Agent Implementation Handoff\n"]

        project_brief = handoff.get("project_brief", "")
        if project_brief:
            lines.append("## Project Brief\n")
            lines.append(project_brief)
            lines.append("")

        architecture_notes = handoff.get("architecture_notes", "")
        if architecture_notes:
            lines.append("## Architecture Notes\n")
            lines.append(architecture_notes)
            lines.append("")

        execution_order = handoff.get("execution_order", [])
        if execution_order:
            lines.append("## Execution Order\n")
            for i, step in enumerate(execution_order, 1):
                label = step if isinstance(step, str) else step.get("title", str(step))
                lines.append(f"{i}. {label}")
            lines.append("")

        raw_tasks = handoff.get("tasks", [])
        if isinstance(raw_tasks, dict):
            raw_tasks = raw_tasks.get("items", [])
        tasks = raw_tasks if isinstance(raw_tasks, list) else []
        if tasks:
            lines.append("## Implementation Tasks\n")
            for task in tasks:
                title = task.get("title", "Untitled")
                layer = task.get("layer", "")
                header = f"### {title}"
                if layer:
                    header += f" [{layer}]"
                lines.append(header)
                lines.append("")

                impl_prompt = task.get("implementation_prompt", "")
                if impl_prompt:
                    lines.append(impl_prompt)
                    lines.append("")

                acceptance_criteria = task.get("acceptance_criteria", "")
                if acceptance_criteria:
                    lines.append("**Acceptance Criteria:**")
                    lines.append(acceptance_criteria)
                    lines.append("")

                deps = task.get("dependencies", [])
                dep_str = ", ".join(deps) if deps else "None"
                lines.append(f"**Dependencies:** {dep_str}")
                lines.append("")

                if task.get("needs_clarification"):
                    reason = task.get("clarification_reason", "")
                    lines.append(f"⚠ NEEDS_CLARIFICATION: {reason}")
                    lines.append("")

                lines.append("---")
                lines.append("")

        needs_count = handoff.get("needs_clarification_count", 0)
        estimated = handoff.get("estimated_sessions", "")
        lines.append("## Summary\n")
        lines.append(f"- Tasks: {len(tasks)}")
        lines.append(f"- Needs clarification: {needs_count}")
        if estimated:
            lines.append(f"- Estimated sessions: {estimated}")

        md = "\n".join(lines)
        short_id = session_id[:8]
        filename = f"handoff-{short_id}.md"
        return Response(
            content=md,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("export_handoff_markdown failed for session_id=%s", session_id)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/session/{session_id}/handoff")
async def get_handoff(request: Request, session_id: str, auth: SupabaseUser = Depends(require_auth)):
    """
    Load stored agent handoff from memory_entries.
    Strips reasoning field and surfaces needs_clarification_count and estimated_sessions
    as top-level response keys.
    """
    try:
        memory_repo = MemoryRepository(client=auth.client)
        entry = await memory_repo.get_by_session_and_key(session_id, "agent_handoff")
        if not entry:
            raise HTTPException(status_code=404, detail="No agent handoff found for this session")
        handoff = Pipeline._unwrap_persisted_content(entry.content)
        handoff = Pipeline._strip_reasoning_field(handoff)
        return {
            "handoff": handoff,
            "needs_clarification_count": handoff.get("needs_clarification_count", 0) if isinstance(handoff, dict) else 0,
            "estimated_sessions": handoff.get("estimated_sessions") if isinstance(handoff, dict) else None,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/session/{session_id}/handoff/export")
async def export_handoff(
    request: Request,
    session_id: str,
    format: str = "claude_md",
    auth: SupabaseUser = Depends(require_auth),
):
    """
    Export the agent handoff in one of three formats:
    - claude_md  (default): CLAUDE.md ready to drop into a repo
    - cursor_rules: .cursorrules project context file
    - task_list: plain .txt with one task block per entry, for pasting into Claude Code
    NEEDS_CLARIFICATION tasks are prefixed with ⚠ in all formats.
    """
    try:
        memory_repo = MemoryRepository(client=auth.client)
        entry = await memory_repo.get_by_session_and_key(session_id, "agent_handoff")
        if not entry:
            raise HTTPException(status_code=404, detail="No agent handoff found for this session")

        handoff = Pipeline._unwrap_persisted_content(entry.content)
        if not isinstance(handoff, dict):
            raise HTTPException(status_code=404, detail="Handoff data is malformed")

        handoff = Pipeline._strip_reasoning_field(handoff)

        project_brief = handoff.get("project_brief", "")
        architecture_notes = handoff.get("architecture_notes", "")
        execution_order = handoff.get("execution_order", [])
        raw_tasks = handoff.get("tasks", [])
        if isinstance(raw_tasks, dict):
            raw_tasks = raw_tasks.get("items", [])
        tasks = raw_tasks if isinstance(raw_tasks, list) else []
        needs_count = handoff.get("needs_clarification_count", 0)
        estimated = handoff.get("estimated_sessions", "")

        def _task_title(task: dict) -> str:
            prefix = "⚠ " if task.get("needs_clarification") else ""
            return f"{prefix}{task.get('title', 'Untitled')}"

        def _deps(task: dict) -> str:
            deps = task.get("dependencies", [])
            return ", ".join(deps) if deps else "none"

        short_id = session_id[:8]

        if format == "cursor_rules":
            lines = []
            if project_brief:
                lines.append("## Project Context\n")
                lines.append(project_brief)
                lines.append("")
            if architecture_notes:
                lines.append("## Architecture\n")
                lines.append(architecture_notes)
                lines.append("")
            if tasks:
                lines.append("## Current Sprint Tasks\n")
                for i, task in enumerate(tasks, 1):
                    layer = task.get("layer", "")
                    tag = f" [{layer}]" if layer else ""
                    lines.append(f"{i}. {_task_title(task)}{tag}")
            content = "\n".join(lines)
            filename = ".cursorrules"
            media_type = "text/plain"

        elif format == "task_list":
            blocks = []
            for task in tasks:
                layer = task.get("layer", "")
                impl = task.get("implementation_prompt", "")
                ac = task.get("acceptance_criteria", "")
                block_lines = [
                    f"TASK: {_task_title(task)}",
                    f"LAYER: {layer}",
                    f"DEPENDS ON: {_deps(task)}",
                ]
                if impl:
                    block_lines.append(impl)
                block_lines.append("DONE WHEN:")
                if ac:
                    block_lines.append(ac)
                blocks.append("\n".join(block_lines))
            content = "\n\n---\n\n".join(blocks)
            filename = f"tasks-{short_id}.txt"
            media_type = "text/plain"

        else:
            # claude_md (default)
            lines = ["# CLAUDE.md\n"]
            if project_brief:
                lines.append(project_brief)
                lines.append("")
            if architecture_notes:
                lines.append("## Architecture Notes\n")
                lines.append(architecture_notes)
                lines.append("")
            if execution_order:
                lines.append("## Execution Order\n")
                for i, step in enumerate(execution_order, 1):
                    label = step if isinstance(step, str) else step.get("title", str(step))
                    layer = step.get("layer", "") if isinstance(step, dict) else ""
                    tag = f" [{layer}]" if layer else ""
                    lines.append(f"{i}. {label}{tag}")
                lines.append("")
            if tasks:
                lines.append("## Tasks\n")
                for task in tasks:
                    layer = task.get("layer", "")
                    impl = task.get("implementation_prompt", "")
                    ac = task.get("acceptance_criteria", "")
                    lines.append(f"### {_task_title(task)}")
                    if layer:
                        lines.append(f"**Layer:** {layer}")
                    lines.append(f"**Dependencies:** {_deps(task)}")
                    if impl:
                        lines.append("")
                        lines.append(impl)
                    if ac:
                        lines.append("")
                        lines.append("**Acceptance Criteria:**")
                        lines.append(ac)
                    lines.append("")
            if needs_count or estimated:
                lines.append("---\n")
                if needs_count:
                    lines.append(f"⚠ {needs_count} task(s) flagged NEEDS_CLARIFICATION — resolve before handing off.")
                if estimated:
                    lines.append(f"Estimated sessions: {estimated}")
            content = "\n".join(lines)
            filename = "CLAUDE.md"
            media_type = "text/markdown"

        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("export_handoff failed for session_id=%s", session_id)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/{session_id}/feedback")
@limiter.limit(GENERAL_API_LIMIT)
async def create_feedback_entry(
    request: Request,
    session_id: str,
    req: FeedbackEntry,
    auth: SupabaseUser = Depends(require_auth),
):
    try:
        result = auth.client.table("feedback_entries").insert({
            "session_id": session_id,
            "user_id": auth.user_id,
            "prd_section": req.prd_section,
            "prd_item_title": req.prd_item_title,
            "feedback_type": req.feedback_type,
            "outcome_note": req.outcome_note or "",
            "linked_problem_ids": req.linked_problem_ids or [],
            "linked_research_ids": req.linked_research_ids or [],
        }).execute()
        entry = result.data[0] if result.data else {}
        return {"success": True, "entry": entry}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("create_feedback_entry error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/session/{session_id}/feedback")
async def list_feedback_entries(
    request: Request,
    session_id: str,
    auth: SupabaseUser = Depends(require_auth),
):
    try:
        result = (
            auth.client.table("feedback_entries")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"entries": result.data or []}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("list_feedback_entries error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/session/{session_id}/feedback/{entry_id}")
@limiter.limit(GENERAL_API_LIMIT)
async def delete_feedback_entry(
    request: Request,
    session_id: str,
    entry_id: str,
    auth: SupabaseUser = Depends(require_auth),
):
    try:
        result = (
            auth.client.table("feedback_entries")
            .delete()
            .eq("id", entry_id)
            .eq("session_id", session_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Feedback entry not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_feedback_entry error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


_VALID_CONTEXT_KEYS = {"problems", "features", "decompositions", "tasks", "prd"}


def build_conversation_system_prompt(session_outputs: dict, requested_keys: list[str]) -> str:
    lines = [
        "You are a product strategy assistant embedded in SpecFlow, an AI-powered PM tool.",
        "You help product managers understand, critique, and improve their pipeline outputs.",
        "",
        "## What you can help with",
        "- Explain any part of the pipeline outputs below",
        "- Identify gaps, inconsistencies, or missing detail",
        "- Suggest improvements grounded in the session data",
        "- Answer product management methodology questions",
        "",
        "## Constraints",
        "- Stay grounded in the session data provided. Flag clearly when you speculate beyond it.",
        "- Keep responses concise (under 150 words) unless the user explicitly asks for detail.",
        "- Never reproduce full JSON dumps — summarize and reference items by title or key.",
        "",
        "## Session Context",
    ]

    safe_keys = [k for k in requested_keys if k in _VALID_CONTEXT_KEYS]
    if safe_keys:
        for key in safe_keys:
            val = session_outputs.get(key)
            if val is None:
                continue
            val = Pipeline._unwrap_persisted_content(val)
            snippet = json.dumps(val)
            if len(snippet) > 800:
                snippet = snippet[:800] + "... [truncated]"
            lines.append(f"\n### {key}\n```json\n{snippet}\n```")
    else:
        lines.append("(No session context requested.)")

    return "\n".join(lines)


@app.post("/session/{session_id}/conversation")
@limiter.limit(GENERAL_API_LIMIT)
async def stream_conversation(
    request: Request,
    session_id: str,
    body: ConversationRequest,
    auth: SupabaseUser = Depends(require_auth),
):
    """Token-by-token SSE conversation endpoint. History is stateless — client manages it."""
    from services.ai.client import get_async_client

    async def event_stream():
        try:
            sm = SessionManager(client=auth.client)
            try:
                await sm.load_session(session_id)
            except ValueError:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
                return

            current_state = await sm.get_current_state(session_id)
            outputs = (current_state or {}).get("outputs", {})

            system_prompt = build_conversation_system_prompt(
                outputs, body.session_context_keys or []
            )

            messages = [{"role": m.role, "content": m.content} for m in body.messages[-20:]]

            ai_client = get_async_client()
            async with ai_client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                temperature=0.4,
                system=system_prompt,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception:
            logger.error("stream_conversation failed", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Internal server error'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/session/{session_id}/query")
@limiter.limit(GENERAL_API_LIMIT)
async def query_session(
    request: Request,
    session_id: str,
    body: QueryRequest,
    auth: SupabaseUser = Depends(require_auth),
):
    """Answer a question grounded in the session's research entries, problems, and PRD."""
    from services.rag.retrieval_service import RetrievalService

    try:
        sm = SessionManager(client=auth.client)
        try:
            await sm.load_session(session_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Session not found")

        retrieval = RetrievalService()
        entries = await retrieval.retrieve(
            query=body.question,
            user_id=auth.user_id,
            session_id=session_id,
            top_k=12,
        )

        memory_repo = MemoryRepository(client=auth.client)
        problems_entry = await memory_repo.get_by_session_and_key(session_id, "problems")
        problems = Pipeline._unwrap_persisted_content(
            problems_entry.content if problems_entry else []
        )
        prd_entry = await memory_repo.get_by_session_and_key(session_id, "prd")
        prd = Pipeline._unwrap_persisted_content(prd_entry.content) if prd_entry else None

        agent = AgentFactory.create("query")
        result = await agent.execute_async(
            task=body.question,
            context={"research_entries": entries, "problems": problems, "prd": prd},
        )

        if isinstance(result, dict):
            return {
                "answer": result.get("answer", ""),
                "cited_sources": result.get("cited_sources", []),
                "suggested_next_steps": result.get("suggested_next_steps", []),
            }

        raise HTTPException(status_code=500, detail="Internal server error")

    except HTTPException:
        raise
    except Exception:
        logger.error("query_session failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/session/{session_id}")
async def get_session(request: Request, session_id: str, auth: SupabaseUser = Depends(require_auth)):
    """Get a session with its current state and full event log."""
    try:
        sm = SessionManager(client=auth.client)
        full = await sm.get_full_session(session_id)
        return full
    except ValueError as e:
        logger.error("get_session failed: %s", e, exc_info=True)
        raise HTTPException(status_code=404, detail="Internal server error")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# Routes — Pipeline Runs (orphaned pipeline support)
# ---------------------------------------------------------------------------

@app.get("/pipelines/orphaned")
async def list_orphaned_pipelines(request: Request, auth: SupabaseUser = Depends(require_auth)):
    """List pipeline runs not attached to any session."""
    try:
        repo = PipelineRepository(client=auth.client)
        runs = await repo.list_orphaned()
        return {"pipelines": [r.model_dump() for r in runs]}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/pipelines/attach")
@limiter.limit(GENERAL_API_LIMIT)
async def attach_pipeline_to_session(
    request: Request,
    req: AttachPipelineRequest,
    auth: SupabaseUser = Depends(require_auth),
):
    """Attach an orphaned pipeline run to a session."""
    try:
        repo = PipelineRepository(client=auth.client)
        run = await repo.get(req.pipeline_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Pipeline run not found")
        await repo.attach_to_session(req.pipeline_id, req.session_id)
        return {"success": True, "pipeline_id": req.pipeline_id, "session_id": req.session_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/pipelines/{session_id}")
async def list_session_pipelines(request: Request, session_id: str, auth: SupabaseUser = Depends(require_auth)):
    """List all pipeline runs for a session."""
    try:
        repo = PipelineRepository(client=auth.client)
        runs = await repo.list_by_session(session_id)
        return {"pipelines": [r.model_dump() for r in runs]}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


class EmbedRequest(BaseModel):
    entry_id: str
    title: str
    content: str


@app.post("/research/embed")
@limiter.limit(GENERAL_API_LIMIT)
async def embed_research_entry(request: Request, req: EmbedRequest, auth: SupabaseUser = Depends(require_auth)):
    """Generate and store a vector embedding for a research entry."""
    try:
        from services.rag.embedding_service import get_embedding_service
        svc = get_embedding_service()
        success = await svc.embed_and_store(req.entry_id, req.title, req.content, auth.client)
        return {"success": success}
    except Exception:
        return {"success": False}


if __name__ == "__main__":
    import uvicorn

    # Default: reload only src/ + config/ (not whole backend/) to avoid reload storms
    # from __pycache__, tests, tooling, etc. Set PIPELINE_RELOAD=false for a stable process.
    _here = os.path.dirname(os.path.abspath(__file__))
    _backend_root = os.path.abspath(os.path.join(_here, ".."))
    _reload_dirs = [
        os.path.join(_backend_root, "src"),
        os.path.join(_backend_root, "config"),
    ]
    _reload = os.environ.get("PIPELINE_RELOAD", "true").lower() in (
        "1",
        "true",
        "yes",
    )
    _run_kw: dict = {"host": "0.0.0.0", "port": PIPELINE_PORT}
    if _reload:
        _run_kw["reload"] = True
        _run_kw["reload_dirs"] = _reload_dirs
        _run_kw["reload_excludes"] = [
            "**/__pycache__/**",
            "**/*.py[cod]",
            "**/.pytest_cache/**",
            "**/.ruff_cache/**",
            "**/.mypy_cache/**",
        ]
    else:
        _run_kw["reload"] = False

    uvicorn.run("main:app", **_run_kw)
