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
from fastapi.responses import JSONResponse, Response, StreamingResponse
import asyncio
from pydantic import BaseModel
from typing import Any, Optional

from services.pipeline import Pipeline
from services.session.session_manager import SessionManager
from services.db.models.session import SESSION_STATUS_COMPLETED
from services.pipeline_repository import PipelineRepository
from services.db.models.pipeline import PipelineRun, PIPELINE_STATUS_ORPHANED, PIPELINE_STATUS_COMPLETED
from services.agent_factory import AgentFactory
from services.memory.memory_repository import MemoryRepository
from services.memory.memory_schemas import MemoryEntry


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
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------------------------------------------
# Routes — Session System
# IMPORTANT: /session/create must be declared BEFORE /session/{session_id}
# so FastAPI does not treat the literal "create" as a session_id path param.
# ---------------------------------------------------------------------------

@app.get("/sessions")
async def list_sessions():
    """Return all sessions ordered by created_at DESC."""
    try:
        print(f"[session] Listing sessions")
        sm = SessionManager()
        print(f"[session] SessionManager instantiated")
        sessions = await sm.list_sessions()
        print(f"[session] Found {len(sessions)} sessions")
        return {"sessions": [s.model_dump() for s in sessions]}
    except Exception as e:
        import traceback
        print(f"[session] Error listing sessions: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/session/create")
async def create_session(req: CreateSessionRequest):
    """Create a new session. Returns session_id to use in subsequent /session/{id}/run calls."""
    try:
        print(f"[session] Creating session: {req.session_name}")
        sm = SessionManager()
        print(f"[session] SessionManager instantiated")
        session = await sm.create_session(
            session_name=req.session_name,
            metadata=req.metadata,
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

        # Only block full-pipeline re-runs on completed sessions.
        # Single-step re-runs (req.step is set) are always allowed so users
        # can regenerate individual steps after the pipeline finishes.
        if session.status == SESSION_STATUS_COMPLETED and req.step is None:
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
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/{session_id}/prd")
async def generate_prd(session_id: str):
    """
    Generate a PRD for an existing session using the accumulated pipeline outputs.
    Reads problems, features, decompositions, tasks from session state and runs PRDAgent.
    Returns 422 if any prerequisite step output is missing.
    """
    try:
        sm = SessionManager()
        await sm.load_session(session_id)

        current_state = await sm.get_current_state(session_id)
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

        # Persist to memory
        entry = MemoryEntry(
            session_id=session_id,
            agent_name="prd",
            memory_key="prd",
            content=result if isinstance(result, dict) else {"data": result},
            metadata={"quality_score": quality},
        )
        memory_repo = MemoryRepository()
        await memory_repo.save_for_session(entry)

        return {"success": True, "prd": result, "quality_score": quality}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/session/{session_id}/prd/stream")
async def generate_prd_stream(session_id: str):
    """SSE streaming PRD generation. Sends phase updates then final result."""

    async def event_stream():
        try:
            sm = SessionManager()
            await sm.load_session(session_id)
            current_state = await sm.get_current_state(session_id)
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

            yield f"data: {json.dumps({'type': 'phase', 'phase': 'Quality check...', 'progress': 90})}\n\n"

            entry = MemoryEntry(
                session_id=session_id,
                agent_name="prd",
                memory_key="prd",
                content=result if isinstance(result, dict) else {"data": result},
                metadata={"quality_score": quality},
            )
            memory_repo = MemoryRepository()
            await memory_repo.save_for_session(entry)

            yield f"data: {json.dumps({'type': 'complete', 'prd': result, 'quality_score': quality, 'progress': 100})}\n\n"

        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/session/{session_id}/prd")
async def get_prd(session_id: str):
    """Load stored PRD from memory_entries for a session."""
    try:
        memory_repo = MemoryRepository()
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
async def export_prd_markdown(session_id: str):
    """
    Export the session's PRD as a downloadable markdown file.
    """
    try:
        memory_repo = MemoryRepository()
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
                    if isinstance(item, dict):
                        lines.append(f"- **{item.get('title', item.get('name', ''))}**: {item.get('description', json.dumps(item))}")
                    else:
                        lines.append(f"- {item}")
            elif isinstance(val, str):
                lines.append(val)
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
async def get_session(session_id: str):
    """Get a session with its current state and full event log."""
    try:
        sm = SessionManager()
        full = await sm.get_full_session(session_id)
        return full
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


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
        raise HTTPException(status_code=500, detail="Internal server error")


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
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/pipelines/{session_id}")
async def list_session_pipelines(session_id: str):
    """List all pipeline runs for a session."""
    try:
        repo = PipelineRepository()
        runs = await repo.list_by_session(session_id)
        return {"pipelines": [r.model_dump() for r in runs]}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PIPELINE_PORT, reload=True)
