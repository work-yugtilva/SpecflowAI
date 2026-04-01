# services/job_registry.py
#
# Lightweight in-memory async job store.
# Each pipeline background run gets a PipelineJob with its own asyncio.Queue
# so the SSE stream endpoint can read events as they are produced.
#
# Note: state is process-local. For multi-worker deployments a Redis-backed
# queue (e.g. via aioredis) would be required. This is acceptable for the
# single-worker Uvicorn setup used in development and staging.

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PipelineJob:
    job_id: str
    session_id: str
    status: str = "queued"  # queued | running | completed | failed
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)


_jobs: dict[str, PipelineJob] = {}


def create_job(session_id: str) -> PipelineJob:
    """Create and register a new job. Returns the job with a fresh 8-char id."""
    job_id = str(uuid.uuid4())[:8]
    job = PipelineJob(job_id=job_id, session_id=session_id)
    _jobs[job_id] = job
    return job


def get_job(job_id: str) -> Optional[PipelineJob]:
    """Return the job for the given id, or None if not found."""
    return _jobs.get(job_id)
