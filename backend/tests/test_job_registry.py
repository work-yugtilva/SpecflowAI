"""
Unit tests for job_registry — lightweight in-memory async job store.
Tests create_job and get_job with no external dependencies.
"""
from unittest.mock import AsyncMock, patch

import pytest
from services.job_registry import create_job, get_job, PipelineJob


@pytest.mark.asyncio
async def test_create_job_returns_pipeline_job():
    with patch("services.job_registry.JobRepository") as repo_cls:
        repo_cls.return_value.create = AsyncMock()
        job = await create_job("session-abc", "user-abc")

    assert isinstance(job, PipelineJob)
    assert job.session_id == "session-abc"
    assert job.user_id == "user-abc"
    assert job.status == "pending"
    repo_cls.return_value.create.assert_awaited_once_with(
        job.job_id, "session-abc", "user-abc"
    )


@pytest.mark.asyncio
async def test_create_job_generates_unique_ids():
    with patch("services.job_registry.JobRepository") as repo_cls:
        repo_cls.return_value.create = AsyncMock()
        job1 = await create_job("s1", "u1")
        job2 = await create_job("s2", "u2")

    assert job1.job_id != job2.job_id


@pytest.mark.asyncio
async def test_create_job_id_is_8_chars():
    with patch("services.job_registry.JobRepository") as repo_cls:
        repo_cls.return_value.create = AsyncMock()
        job = await create_job("s1", "u1")

    assert len(job.job_id) == 8


@pytest.mark.asyncio
async def test_get_job_returns_registered_job():
    with patch("services.job_registry.JobRepository") as repo_cls:
        repo_cls.return_value.create = AsyncMock()
        job = await create_job("sess-xyz", "user-xyz")

    found = get_job(job.job_id)
    assert found is job


def test_get_job_returns_none_for_unknown_id():
    result = get_job("nonexistent-id")
    assert result is None


@pytest.mark.asyncio
async def test_create_job_has_async_queue():
    """The job's queue must be an asyncio.Queue (needed by SSE stream)."""
    import asyncio

    with patch("services.job_registry.JobRepository") as repo_cls:
        repo_cls.return_value.create = AsyncMock()
        job = await create_job("sess-q", "user-q")

    assert isinstance(job.queue, asyncio.Queue)
