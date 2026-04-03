"""
Unit tests for PipelineRepository — persistence layer for the pipelines table.
All Supabase I/O is mocked.
"""
import pytest
from unittest.mock import MagicMock, patch
from services.pipeline_repository import PipelineRepository, _is_missing_user_id_column_error
from services.db.models.pipeline import PipelineRun


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_repo():
    client = MagicMock()
    with patch("services.pipeline_repository.get_supabase_client", return_value=client):
        repo = PipelineRepository()
    repo.client = client
    return repo


def _chain(rows=None, is_dict=False):
    """Return a mock chain whose execute() returns a result with .data."""
    result = MagicMock()
    if is_dict:
        result.data = rows  # maybe_single returns dict
    else:
        result.data = rows or []
    chain = MagicMock()
    chain.execute.return_value = result
    return chain


def _make_row(**kwargs):
    defaults = dict(id="pipe-1", session_id="sess-1", user_id=None,
                    status="pending", input_data={}, output_data={},
                    current_step=None, error_message=None,
                    created_at=None, updated_at=None)
    defaults.update(kwargs)
    return defaults


# ---------------------------------------------------------------------------
# _is_missing_user_id_column_error
# ---------------------------------------------------------------------------

def test_missing_user_id_error_matches():
    exc = Exception("PGRST204 'user_id' column not found in 'pipelines' schema")
    assert _is_missing_user_id_column_error(exc) is True


def test_missing_user_id_error_wrong_table():
    exc = Exception("PGRST204 'user_id' column not found in 'sessions' schema")
    assert _is_missing_user_id_column_error(exc) is False


# ---------------------------------------------------------------------------
# _without_user_id
# ---------------------------------------------------------------------------

def test_without_user_id_strips_field():
    data = {"id": "1", "user_id": "u", "status": "pending"}
    result = PipelineRepository._without_user_id(data)
    assert "user_id" not in result
    assert result["status"] == "pending"


def test_without_user_id_passthrough():
    data = {"id": "1", "status": "pending"}
    assert PipelineRepository._without_user_id(data) is data


# ---------------------------------------------------------------------------
# create
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_returns_pipeline_run():
    row = _make_row(id="new-pipe")
    repo = _make_repo()
    insert_chain = _chain(rows=[row])
    repo.client.table.return_value.insert.return_value = insert_chain

    run = PipelineRun(session_id="sess-1", status="pending")
    result = await repo.create(run)
    assert result.id == "new-pipe"


@pytest.mark.asyncio
async def test_create_returns_original_when_no_rows():
    repo = _make_repo()
    insert_chain = _chain(rows=[])
    repo.client.table.return_value.insert.return_value = insert_chain

    run = PipelineRun(session_id="sess-1")
    result = await repo.create(run)
    assert result is run


@pytest.mark.asyncio
async def test_create_fallback_on_missing_user_id_column():
    repo = _make_repo()
    first_chain = MagicMock()
    first_chain.execute.side_effect = Exception(
        "PGRST204 'user_id' column not found in 'pipelines' schema"
    )
    fallback_chain = _chain(rows=[])
    repo.client.table.return_value.insert.side_effect = [first_chain, fallback_chain]

    run = PipelineRun(session_id="sess-1", user_id="u1")
    result = await repo.create(run)
    assert result is run  # fallback returned no rows → original


# ---------------------------------------------------------------------------
# get
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_returns_pipeline_run():
    row = _make_row(id="pipe-99", status="running")
    chain = _chain(rows=[row])
    repo = _make_repo()
    (repo.client.table.return_value
        .select.return_value
        .eq.return_value
        .limit.return_value) = chain

    result = await repo.get("pipe-99")
    assert result is not None
    assert result.status == "running"


@pytest.mark.asyncio
async def test_get_returns_none_when_not_found():
    chain = _chain(rows=[])
    repo = _make_repo()
    (repo.client.table.return_value
        .select.return_value
        .eq.return_value
        .limit.return_value) = chain

    result = await repo.get("nonexistent")
    assert result is None


# ---------------------------------------------------------------------------
# update
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_calls_table_update():
    repo = _make_repo()
    update_chain = _chain(rows=[])
    (repo.client.table.return_value
        .update.return_value
        .eq.return_value) = update_chain

    await repo.update("pipe-1", status="completed")
    repo.client.table.assert_called_with("pipelines")


@pytest.mark.asyncio
async def test_update_fallback_on_missing_user_id_column():
    repo = _make_repo()
    first_chain = MagicMock()
    first_chain.execute.side_effect = Exception(
        "PGRST204 'user_id' column not found in 'pipelines' schema"
    )
    fallback_chain = _chain(rows=[])
    (repo.client.table.return_value
        .update.return_value
        .eq.return_value) = first_chain

    calls = []

    async def patched_run_sync(fn):
        calls.append(fn)
        if len(calls) == 1:
            raise Exception("PGRST204 'user_id' column not found in 'pipelines' schema")
        return fallback_chain.execute()

    import services.pipeline_repository as pr_mod
    original = pr_mod.run_sync
    pr_mod.run_sync = patched_run_sync
    try:
        await repo.update("pipe-1", user_id="u1", status="completed")
    finally:
        pr_mod.run_sync = original


# ---------------------------------------------------------------------------
# list_orphaned
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_orphaned_returns_runs():
    rows = [_make_row(id="p1", session_id=None), _make_row(id="p2", session_id=None)]
    repo = _make_repo()
    chain = _chain(rows=rows)
    (repo.client.table.return_value
        .select.return_value
        .is_.return_value
        .order.return_value) = chain

    result = await repo.list_orphaned()
    assert len(result) == 2
    assert result[0].id == "p1"


@pytest.mark.asyncio
async def test_list_orphaned_returns_empty():
    repo = _make_repo()
    chain = _chain(rows=[])
    (repo.client.table.return_value
        .select.return_value
        .is_.return_value
        .order.return_value) = chain

    result = await repo.list_orphaned()
    assert result == []


# ---------------------------------------------------------------------------
# list_by_session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_by_session_returns_runs():
    rows = [_make_row(id="p3", session_id="sess-abc")]
    repo = _make_repo()
    chain = _chain(rows=rows)
    (repo.client.table.return_value
        .select.return_value
        .eq.return_value
        .order.return_value) = chain

    result = await repo.list_by_session("sess-abc")
    assert len(result) == 1
    assert result[0].session_id == "sess-abc"
