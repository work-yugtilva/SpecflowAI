# main.py — FastAPI entry point for the SpecFlow pipeline

import json
import logging
import os
import sys

# Ensure imports resolve from this directory
sys.path.insert(0, os.path.dirname(__file__))

from services.config.load_env import load_root_env

load_root_env()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any, Optional

from services.pipeline import Pipeline
from services.session.session_manager import SessionManager
from services.db.models.session import SESSION_STATUS_COMPLETED
from services.pipeline_repository import PipelineRepository
from services.db.models.pipeline import PipelineRun, PIPELINE_STATUS_ORPHANED, PIPELINE_STATUS_COMPLETED


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


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="SpecFlow Pipeline API", version="1.0.0")

LOCAL_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
async def health():
    return {"status": "ok", "service": "specflow-pipeline"}


@app.post("/run")
async def run_pipeline(req: RunRequest):
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
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Routes — Session System
# IMPORTANT: /session/create must be declared BEFORE /session/{session_id}
# so FastAPI does not treat the literal "create" as a session_id path param.
# ---------------------------------------------------------------------------

@app.get("/sessions")
async def list_sessions():
    """Return all sessions ordered by created_at DESC."""
    try:
        sm = SessionManager()
        sessions = await sm.list_sessions()
        return {"sessions": [s.model_dump() for s in sessions]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/session/create")
async def create_session(req: CreateSessionRequest):
    """Create a new session. Returns session_id to use in subsequent /session/{id}/run calls."""
    try:
        sm = SessionManager()
        session = await sm.create_session(
            session_name=req.session_name,
            metadata=req.metadata,
        )
        return {
            "session_id": session.id,
            "session_name": session.session_name,
            "status": session.status,
            "created_at": session.created_at.isoformat() if session.created_at else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/session/{session_id}/run")
async def run_session(session_id: str, req: SessionRunRequest):
    """
    Run the pipeline (or a single step) for an existing session.

    Resumability:
    - On retry after failure: pipeline automatically skips completed steps.
    - Interactive mode: pass `step` to run only that one agent.

    Returns the full output data and current session state snapshot.
    """
    try:
        sm = SessionManager()
        session = await sm.load_session(session_id)

        if session.status == SESSION_STATUS_COMPLETED:
            raise HTTPException(
                status_code=400,
                detail=f"Session {session_id} is already completed.",
            )

        pipeline = Pipeline()
        result = await pipeline.run(
            input_data=req.input_data,
            project_id=None,
            session_id=session_id,
            session_manager=sm,
            step=req.step,
        )

        current_state = await sm.get_current_state(session_id)
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
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get a session with its current state and full event log."""
    try:
        sm = SessionManager()
        full = await sm.get_full_session(session_id)
        return full
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Routes — Pipeline Runs (orphaned pipeline support)
# ---------------------------------------------------------------------------

@app.get("/pipelines/orphaned")
async def list_orphaned_pipelines():
    """List pipeline runs not attached to any session."""
    try:
        repo = PipelineRepository()
        runs = await repo.list_orphaned()
        return {"pipelines": [r.model_dump() for r in runs]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipelines/attach")
async def attach_pipeline_to_session(req: AttachPipelineRequest):
    """Attach an orphaned pipeline run to a session."""
    try:
        repo = PipelineRepository()
        run = await repo.get(req.pipeline_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Pipeline run not found")
        await repo.attach_to_session(req.pipeline_id, req.session_id)
        return {"success": True, "pipeline_id": req.pipeline_id, "session_id": req.session_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/pipelines/{session_id}")
async def list_session_pipelines(session_id: str):
    """List all pipeline runs for a session."""
    try:
        repo = PipelineRepository()
        runs = await repo.list_by_session(session_id)
        return {"pipelines": [r.model_dump() for r in runs]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PIPELINE_PORT, reload=True)
