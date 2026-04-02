"""
Unit tests for job_registry — lightweight in-memory async job store.
Tests create_job and get_job with no external dependencies.
"""
import pytest
from services.job_registry import create_job, get_job, PipelineJob


def test_create_job_returns_pipeline_job():
    job = create_job("session-abc")
    assert isinstance(job, PipelineJob)
    assert job.session_id == "session-abc"
    assert job.status == "queued"


def test_create_job_generates_unique_ids():
    job1 = create_job("s1")
    job2 = create_job("s2")
    assert job1.job_id != job2.job_id


def test_create_job_id_is_8_chars():
    job = create_job("s1")
    assert len(job.job_id) == 8


def test_get_job_returns_registered_job():
    job = create_job("sess-xyz")
    found = get_job(job.job_id)
    assert found is job


def test_get_job_returns_none_for_unknown_id():
    result = get_job("nonexistent-id")
    assert result is None


def test_create_job_has_async_queue():
    """The job's queue must be an asyncio.Queue (needed by SSE stream)."""
    import asyncio
    job = create_job("sess-q")
    assert isinstance(job.queue, asyncio.Queue)
