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
validate_required_env()

import sentry_sdk

if dsn := os.environ.get("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=dsn,
        traces_sample_rate=0.1,
        environment=os.environ.get("NODE_ENV", "development"),
    )

from dataclasses import dataclass
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import asyncio
from pydantic import BaseModel
from typing import Any, Optional
from urllib.parse import urlparse

from services.pipeline import Pipeline
from services.session.session_manager import SessionManager
from services.db.models.session import SESSION_STATUS_COMPLETED
from services.pipeline_repository import PipelineRepository
from services.db.models.pipeline import PipelineRun, PIPELINE_STATUS_ORPHANED, PIPELINE_STATUS_COMPLETED
from services.agent_factory import AgentFactory
from services.memory.memory_repository import MemoryRepository
from services.memory.memory_schemas import MemoryEntry
from services.job_registry import create_job, get_job
from services.db.supabase_client import get_supabase_client, get_user_supabase_client, verify_supabase_jwt
from services.plan.plan_service import PlanService
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user_id: str
    client: Any  # User-scoped Supabase client (anon key + JWT → RLS enforced)


async def get_auth_context(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[AuthContext]:
    """
    FastAPI dependency: extracts Bearer JWT from Authorization header.
    Returns AuthContext(user_id, user-scoped-client) when a valid JWT is present.
    Invalid or missing credentials return None so callers can choose whether
    the route is public or protected.
    """
    if not credentials:
        return None
    jwt = credentials.credentials
    try:
        user_id = await verify_supabase_jwt(jwt)
        client = get_user_supabase_client(jwt)
        return AuthContext(user_id=user_id, client=client)
    except Exception:
        return None


async def require_auth_context(
    auth: Optional[AuthContext] = Depends(get_auth_context),
) -> AuthContext:
    if auth is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return auth


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


def _build_allowed_hosts() -> list[str]:
    hosts = {
        "localhost",
        "127.0.0.1",
        "test",
        "*.vercel.app",
        "*.loca.lt",
        "*.ngrok-free.app",
        "*.trycloudflare.com",
    }
    raw_hosts = os.environ.get("ALLOWED_HOSTS", "")
    for host in raw_hosts.split(","):
        cleaned = host.strip()
        if cleaned:
            hosts.add(cleaned)

    for env_name in ("FRONTEND_URL", "NEXT_PUBLIC_PIPELINE_URL", "NEXT_PUBLIC_EXPRESS_API_URL"):
        value = os.environ.get(env_name)
        if not value:
            continue
        parsed = urlparse(value)
        if parsed.hostname:
            hosts.add(parsed.hostname)

    return sorted(hosts)


def _build_allowed_origins() -> list[str]:
    origins = set(LOCAL_ORIGINS)
    raw_origins = os.environ.get("ALLOWED_ORIGINS", "")

    for origin in raw_origins.split(","):
        cleaned = origin.strip()
        if cleaned:
            origins.add(cleaned)

    for env_name in (
        "FRONTEND_URL",
        "NEXT_PUBLIC_SITE_URL",
        "NEXT_PUBLIC_APP_URL",
        "URL",
    ):
        value = os.environ.get(env_name)
        if value:
            origins.add(value.strip())

    return sorted(origins)


def _build_allowed_origin_regex() -> str:
    return (
        r"^https:\/\/[a-z0-9-]+\.(vercel\.app|loca\.lt|ngrok-free\.app|trycloudflare\.com)$"
    )


MAX_REQUEST_BODY_BYTES = 512 * 1024  # 512 KB
RATE_LIMIT_AI      = "10/minute"   # AI-triggering endpoints
RATE_LIMIT_DEFAULT = "60/minute"   # All other endpoints

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="SpecFlow Pipeline API",
    version="1.0.0",
    docs_url=None if _is_production() else "/docs",
    redoc_url=None if _is_production() else "/redoc",
    openapi_url=None if _is_production() else "/openapi.json",
)
app.state.limiter = limiter

LOCAL_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]


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


app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(),
    allow_origin_regex=_build_allowed_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SentryAsgiMiddleware)
app.add_middleware(RequestBodySizeLimitMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=_build_allowed_hosts())


# NOTE: This handler catches all unguarded ValueErrors across the application.
# Any route that needs a different status code for ValueError (e.g., 404)
# must catch the exception locally before it reaches this handler.
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    msg = str(exc)
    if msg.startswith("INCOMPLETE_CONTEXT:"):
        fields = msg.split(":", 1)[1].split(",")
        return JSONResponse(
            status_code=422,
            content={"error": "INCOMPLETE_CONTEXT", "missing": fields}
        )
    # All other ValueErrors: log internally, return generic error to client
    import logging
    logging.getLogger(__name__).error("Unhandled ValueError: %s", msg)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class RunRequest(BaseModel):
    input_data: dict[str, Any]
    project_id: Optional[str] = None


class CreateSessionRequest(BaseModel):
    session_name: str
    project_id: Optional[str] = None
    metadata: Optional[dict] = {}


class SessionRunRequest(BaseModel):
    input_data: dict[str, Any]
    step: Optional[str] = None      # agent name for interactive step-by-step mode


class AttachPipelineRequest(BaseModel):
    pipeline_id: str
    session_id: str


# ---------------------------------------------------------------------------
# Routes — health + legacy /run (unchanged)
# ---------------------------------------------------------------------------

PIPELINE_PORT = int(os.environ.get("PIPELINE_PORT", "8001"))


@app.get("/health")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def health(request: Request):
    return {"status": "ok", "service": "specflow-pipeline"}


@app.post("/run")
@limiter.limit(RATE_LIMIT_AI)
async def run_pipeline(request: Request, req: RunRequest, auth: AuthContext = Depends(require_auth_context)):
    try:
        print(f"[pipeline] Starting run | project_id={req.project_id}")
        pipeline = Pipeline()
        result = await pipeline.run(req.input_data, req.project_id)
        print(f"[pipeline] Run complete | keys={list(result.keys())}")
        return {"success": True, "data": result}
    except ValueError as e:
        raise
    except Exception as e:
        import traceback
        print(f"[pipeline] Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# Routes — User Plan
# ---------------------------------------------------------------------------

@app.get("/user/plan")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def get_user_plan(request: Request, auth: AuthContext = Depends(require_auth_context)):
    """Return the authenticated user's plan and current usage."""
    try:
        plan_svc = PlanService()
        return await plan_svc.get_user_plan(auth.user_id)
    except HTTPException:
        raise
    except Exception:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# Routes — Session System
# IMPORTANT: /session/create must be declared BEFORE /session/{session_id}
# so FastAPI does not treat the literal "create" as a session_id path param.
# ---------------------------------------------------------------------------

@app.get("/sessions")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def list_sessions(request: Request, auth: AuthContext = Depends(require_auth_context)):
    """Return all sessions ordered by created_at DESC."""
    try:
        print(f"[session] Listing sessions")
        sm = SessionManager(client=auth.client)
        print(f"[session] SessionManager instantiated")
        sessions = await sm.list_sessions()
        print(f"[session] Found {len(sessions)} sessions")
        return {"sessions": [s.model_dump() for s in sessions]}
    except Exception as e:
        import traceback
        print(f"[session] Error listing sessions: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/create")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def create_session(request: Request, req: CreateSessionRequest, auth: AuthContext = Depends(require_auth_context)):
    """Create a new session. Returns session_id to use in subsequent /session/{id}/run calls."""
    try:
        print(f"[session] Creating session: {req.session_name}")
        sm = SessionManager(client=auth.client)
        print(f"[session] SessionManager instantiated")
        session = await sm.create_session(
            session_name=req.session_name,
            project_id=req.project_id,
            metadata=req.metadata,
            user_id=auth.user_id,
        )
        print(f"[session] Session created: {session.id}")
        return {
            "session_id": session.id,
            "session_name": session.session_name,
            "status": session.status,
            "created_at": session.created_at.isoformat() if session.created_at else None,
        }
    except Exception as e:
        import traceback
        print(f"[session] Error creating session: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/{session_id}/run")
@limiter.limit(RATE_LIMIT_AI)
async def run_session(request: Request, session_id: str, req: SessionRunRequest, auth: AuthContext = Depends(require_auth_context)):
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/{session_id}/run/async", status_code=202)
@limiter.limit(RATE_LIMIT_DEFAULT)
async def run_session_async(request: Request, session_id: str, req: SessionRunRequest, auth: AuthContext = Depends(require_auth_context)):
    """
    Non-blocking pipeline start. Immediately returns {job_id} with 202 Accepted
    and runs the pipeline as a background asyncio.Task.

    Subscribe to GET /session/{session_id}/run/stream/{job_id} for SSE progress events.
    """
    try:
        sm = SessionManager(client=auth.client)
        session = await sm.load_session(session_id)

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

        job = create_job(session_id)

        async def _run_bg():
            # Use service-role client for all DB operations inside the background task.
            # The user's JWT (auth.client) expires during long-running pipeline runs.
            # Authorization was already verified above before this task was queued.
            bg_sm = SessionManager(client=get_supabase_client())
            job.status = "running"
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

                await job.queue.put({
                    "type": "complete",
                    "data": result,
                    "session_state": current_state,
                })
                job.status = "completed"
            except HTTPException as e:
                await job.queue.put({"type": "error", "message": e.detail, "status_code": e.status_code})
                job.status = "failed"
            except ValueError as e:
                msg = str(e)
                await job.queue.put({"type": "error", "message": msg})
                job.status = "failed"
            except Exception as e:
                import traceback
                traceback.print_exc()
                await job.queue.put({"type": "error", "message": "Internal server error"})
                job.status = "failed"
            finally:
                await job.queue.put(None)  # sentinel — tells SSE generator to close

        asyncio.create_task(_run_bg())
        return {"job_id": job.job_id, "status": "queued"}

    except HTTPException:
        raise
    except ValueError as e:
        msg = str(e)
        if msg.startswith("INCOMPLETE_CONTEXT:"):
            raise
        raise HTTPException(status_code=404, detail=msg)
    except Exception:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/session/{session_id}/run/stream/{job_id}")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def stream_run(request: Request, session_id: str, job_id: str, auth: AuthContext = Depends(require_auth_context)):
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
    if not job or job.session_id != session_id:
        raise HTTPException(status_code=404, detail="Job not found")

    async def _generate():
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"
        while True:
            try:
                event = await asyncio.wait_for(job.queue.get(), timeout=25.0)
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                continue
            if event is None:  # sentinel
                break
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") in ("complete", "error"):
                break

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/session/{session_id}/prd")
@limiter.limit(RATE_LIMIT_AI)
async def generate_prd(request: Request, session_id: str, auth: AuthContext = Depends(require_auth_context)):
    """
    Generate a PRD for an existing session using the accumulated pipeline outputs.
    Reads problems, features, decompositions, tasks from session state and runs PRDAgent.
    Returns 422 if any prerequisite step output is missing.
    """
    try:
        sm = SessionManager(client=auth.client)
        await sm.load_session(session_id)

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

        # Persist to memory
        entry = MemoryEntry(
            session_id=session_id,
            user_id=auth.user_id,
            agent_name="prd",
            memory_key="prd",
            content=result if isinstance(result, dict) else {"data": result},
            metadata={"quality_score": quality},
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
        logger.error("generate_prd failed: %s", e, exc_info=True)
        raise HTTPException(status_code=404, detail="Internal server error")
    except Exception:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/{session_id}/prd/stream")
@limiter.limit(RATE_LIMIT_AI)
async def generate_prd_stream(request: Request, session_id: str, auth: AuthContext = Depends(require_auth_context)):
    """SSE streaming PRD generation. Sends phase updates then final result."""

    async def event_stream():
        try:
            sm = SessionManager(client=auth.client)
            await sm.load_session(session_id)
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

            missing = [k for k in ("problems", "features", "decompositions", "tasks")
                       if not context.get(k)]
            if missing:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Run {chr(44).join(missing)} first'})}\n\n"
                return

            yield f"data: {json.dumps({'type': 'phase', 'phase': 'Loading context...', 'progress': 10})}\n\n"
            await asyncio.sleep(0.1)

            yield f"data: {json.dumps({'type': 'phase', 'phase': 'Drafting PRD...', 'progress': 30})}\n\n"

            agent = AgentFactory.create("prd")
            result_container = {}

            async def run_agent():
                result, quality = await agent.run(context)
                result_container["result"] = result
                result_container["quality"] = quality

            agent_task = asyncio.create_task(run_agent())

            progress = 30
            while not agent_task.done():
                await asyncio.sleep(2)
                if not agent_task.done():
                    progress = min(progress + 10, 85)
                    yield f"data: {json.dumps({'type': 'phase', 'phase': 'Drafting PRD...', 'progress': progress})}\n\n"

            await agent_task  # propagate exceptions

            result = result_container["result"]
            quality = result_container["quality"]
            result = Pipeline._strip_reasoning_field(result)
            quality = Pipeline._strip_reasoning_field(quality)

            yield f"data: {json.dumps({'type': 'phase', 'phase': 'Quality check...', 'progress': 90})}\n\n"

            entry = MemoryEntry(
                session_id=session_id,
                user_id=auth.user_id,
                agent_name="prd",
                memory_key="prd",
                content=result if isinstance(result, dict) else {"data": result},
                metadata={"quality_score": quality},
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

            yield f"data: {json.dumps({'type': 'complete', 'prd': result, 'quality_score': quality, 'progress': 100})}\n\n"

        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': 'Internal server error'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/session/{session_id}/prd")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def get_prd(request: Request, session_id: str, auth: AuthContext = Depends(require_auth_context)):
    """Load stored PRD from memory_entries for a session."""
    try:
        memory_repo = MemoryRepository(client=auth.client)
        entry = await memory_repo.get_by_session_and_key(session_id, "prd")
        if not entry:
            raise HTTPException(status_code=404, detail="No PRD found for this session")
        prd = Pipeline._unwrap_persisted_content(entry.content)
        quality = entry.metadata.get("quality_score") if entry.metadata else None
        return {"prd": prd, "quality_score": quality}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/session/{session_id}/prd/export")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def export_prd_markdown(request: Request, session_id: str, auth: AuthContext = Depends(require_auth_context)):
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
        for key, title in section_titles.items():
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
        return Response(
            content=md,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="prd-{short_id}.md"'},
        )
    except HTTPException:
        raise
    except Exception:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/session/{session_id}")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def get_session(request: Request, session_id: str, auth: AuthContext = Depends(require_auth_context)):
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
@limiter.limit(RATE_LIMIT_DEFAULT)
async def list_orphaned_pipelines(request: Request, auth: AuthContext = Depends(require_auth_context)):
    """List pipeline runs not attached to any session."""
    try:
        repo = PipelineRepository(client=auth.client)
        runs = await repo.list_orphaned()
        return {"pipelines": [r.model_dump() for r in runs]}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/pipelines/attach")
@limiter.limit(RATE_LIMIT_DEFAULT)
async def attach_pipeline_to_session(
    request: Request,
    req: AttachPipelineRequest,
    auth: AuthContext = Depends(require_auth_context),
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
@limiter.limit(RATE_LIMIT_DEFAULT)
async def list_session_pipelines(request: Request, session_id: str, auth: AuthContext = Depends(require_auth_context)):
    """List all pipeline runs for a session."""
    try:
        repo = PipelineRepository(client=auth.client)
        runs = await repo.list_by_session(session_id)
        return {"pipelines": [r.model_dump() for r in runs]}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PIPELINE_PORT, reload=True)
