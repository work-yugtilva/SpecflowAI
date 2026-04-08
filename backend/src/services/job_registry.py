# services/job_registry.py
#
# In-memory async job store + Supabase-backed persistence.
# Each pipeline background run gets a PipelineJob with its own asyncio.Queue
# so the SSE stream endpoint can read events as they are produced.
# Job status/result/error are also written to the `jobs` Supabase table so
# they survive backend restarts and are queryable via the status endpoint.
#
# Note: the asyncio.Queue is process-local. For multi-worker deployments a
# Redis-backed queue (e.g. via aioredis) would be required. This is acceptable
# for the single-worker Uvicorn setup used in development and staging.

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Optional

from services.job_repository import JobRepository


@dataclass
class PipelineJob:
    job_id: str
    session_id: str
    user_id: str
    status: str = "pending"  # pending | running | completed | failed
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)


@dataclass
class PrdJob:
    """
    In-memory state for a background PRD generation task.

    Uses two mechanisms for consumer coordination:
    - queue: receives phase-update events during active streaming (consumed by first connection)
    - done_event: signals completion to any reconnecting clients (survives first connection)

    The complete_payload / error_message fields are set by finish_prd_job() before
    done_event is fired, so waiting clients always see a consistent final state.
    """
    job_id: str
    session_id: str
    user_id: str
    status: str = "running"  # running | completed | failed
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    done_event: asyncio.Event = field(default_factory=asyncio.Event)
    complete_payload: Optional[dict] = None   # set on success; includes type/prd/quality_score/citations
    error_message: Optional[str] = None       # set on failure


_jobs: dict[str, PipelineJob] = {}
_prd_jobs: dict[str, PrdJob] = {}

_PRD_JOB_TTL_SECONDS = 300  # evict completed PrdJobs after 5 minutes


async def create_job(session_id: str, user_id: str) -> PipelineJob:
    """Create and register a new job. Persists a row to Supabase and returns the job."""
    job_id = str(uuid.uuid4())[:8]
    job = PipelineJob(job_id=job_id, session_id=session_id, user_id=user_id)
    _jobs[job_id] = job
    repo = JobRepository()
    await repo.create(job_id, session_id, user_id)
    return job


def get_job(job_id: str) -> Optional[PipelineJob]:
    """Return the in-memory job for the given id, or None if not found."""
    return _jobs.get(job_id)


async def create_prd_job(session_id: str, user_id: str) -> PrdJob:
    """Create and register a new PRD background job. Persists to Supabase with job_type='prd'."""
    job_id = str(uuid.uuid4())[:8]
    job = PrdJob(job_id=job_id, session_id=session_id, user_id=user_id)
    _prd_jobs[job_id] = job
    repo = JobRepository()
    await repo.create(job_id, session_id, user_id, job_type="prd")
    return job


def get_prd_job(job_id: str) -> Optional[PrdJob]:
    """Return the in-memory PrdJob for the given id, or None if not found / already evicted."""
    return _prd_jobs.get(job_id)


async def finish_prd_job(
    job_id: str,
    *,
    payload: Optional[dict] = None,
    error: Optional[str] = None,
) -> None:
    """
    Mark a PrdJob as done (completed or failed).

    Sets complete_payload or error_message, updates status, fires done_event so any
    reconnecting SSE clients unblock, pushes a '_done' sentinel to the queue so the
    initial streaming connection's loop exits cleanly, persists final status to DB,
    and schedules eviction of the in-memory job after TTL.
    """
    job = _prd_jobs.get(job_id)
    if job is None:
        return

    if payload is not None:
        job.complete_payload = payload
        job.status = "completed"
    else:
        job.error_message = error or "PRD generation failed"
        job.status = "failed"

    # Unblock any waiting reconnect clients
    job.done_event.set()

    # Signal the first-connection queue reader to stop
    await job.queue.put({"type": "_done"})

    # Persist to Supabase
    repo = JobRepository()
    if payload is not None:
        await repo.update_status(
            job_id,
            "completed",
            result={k: v for k, v in payload.items() if k != "type"},
        )
    else:
        await repo.update_status(job_id, "failed", error=job.error_message)

    # Schedule TTL eviction
    loop = asyncio.get_event_loop()
    loop.call_later(_PRD_JOB_TTL_SECONDS, _prd_jobs.pop, job_id, None)
