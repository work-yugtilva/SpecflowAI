"""
Unit tests for MemoryRepository — session-scoped persistence layer used by
the PRD endpoints and session manager.  All Supabase I/O is mocked.
"""
import pytest
from unittest.mock import MagicMock
from services.memory.memory_repository import MemoryRepository, _is_missing_user_id_column_error
from services.memory.memory_schemas import MemoryEntry


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def _make_client(rows=None):
    """Return a mock Supabase client whose execute() returns rows."""
    result = MagicMock()
    result.data = rows or []
    chain = MagicMock()
    chain.execute.return_value = result
    client = MagicMock()
    client.table.return_value.upsert.return_value = chain
    client.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value = chain
    client.table.return_value.select.return_value.eq.return_value.order.return_value = chain
    client.table.return_value.delete.return_value.eq.return_value.eq.return_value = chain
    return client


def _make_entry(**kwargs):
    defaults = dict(
        session_id="sess-123",
        user_id="user-abc",
        agent_name="prd",
        memory_key="prd",
        content={"title": "My PRD"},
    )
    defaults.update(kwargs)
    return MemoryEntry(**defaults)


# ---------------------------------------------------------------------------
# _is_missing_user_id_column_error
# ---------------------------------------------------------------------------

def test_is_missing_user_id_column_error_matches():
    exc = Exception("PGRST204 'user_id' column not found in 'memory_entries' schema")
    assert _is_missing_user_id_column_error(exc) is True


def test_is_missing_user_id_column_error_wrong_code():
    exc = Exception("PGRST404 'user_id' column not found in 'memory_entries' schema")
    assert _is_missing_user_id_column_error(exc) is False


def test_is_missing_user_id_column_error_wrong_column():
    exc = Exception("PGRST204 'other_col' column not found in 'memory_entries' schema")
    assert _is_missing_user_id_column_error(exc) is False


def test_is_missing_user_id_column_error_wrong_table():
    exc = Exception("PGRST204 'user_id' column not found in 'sessions' schema")
    assert _is_missing_user_id_column_error(exc) is False


# ---------------------------------------------------------------------------
# _without_user_id
# ---------------------------------------------------------------------------

def test_without_user_id_strips_field():
    data = {"session_id": "s", "user_id": "u", "memory_key": "prd"}
    result = MemoryRepository._without_user_id(data)
    assert "user_id" not in result
    assert result["session_id"] == "s"


def test_without_user_id_passthrough_when_absent():
    data = {"session_id": "s", "memory_key": "prd"}
    result = MemoryRepository._without_user_id(data)
    assert result is data  # same object — no copy made


# ---------------------------------------------------------------------------
# save_for_session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_save_for_session_calls_upsert():
    row = {"id": "r1", "session_id": "sess-123", "memory_key": "prd",
           "agent_name": "prd", "content": {"title": "PRD"}, "metadata": {},
           "user_id": "user-abc", "project_id": None, "created_at": None, "updated_at": None}
    client = _make_client(rows=[row])
    repo = MemoryRepository(client=client)
    entry = _make_entry()
    result = await repo.save_for_session(entry)
    client.table.assert_called_with("memory_entries")
    assert result.session_id == "sess-123"


@pytest.mark.asyncio
async def test_save_for_session_returns_entry_when_no_rows():
    """If Supabase returns no rows, the original entry is returned unchanged."""
    client = _make_client(rows=[])
    repo = MemoryRepository(client=client)
    entry = _make_entry()
    result = await repo.save_for_session(entry)
    assert result is entry


@pytest.mark.asyncio
async def test_save_for_session_fallback_on_missing_user_id_column():
    """If upsert raises user_id column error, retries without user_id field."""
    fallback_result = MagicMock()
    fallback_result.data = []
    fallback_chain = MagicMock()
    fallback_chain.execute.return_value = fallback_result

    # First upsert raises; second (fallback) succeeds
    first_chain = MagicMock()
    first_chain.execute.side_effect = Exception(
        "PGRST204 'user_id' column not found in 'memory_entries' schema"
    )

    client = MagicMock()
    client.table.return_value.upsert.side_effect = [first_chain, fallback_chain]

    repo = MemoryRepository(client=client)
    entry = _make_entry()
    # Should not raise — falls back cleanly
    result = await repo.save_for_session(entry)
    assert result is entry  # fallback returned no rows → original entry


# ---------------------------------------------------------------------------
# get_by_session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_by_session_returns_entries():
    rows = [
        {"id": "r1", "session_id": "sess-1", "memory_key": "problems",
         "agent_name": "problems", "content": {}, "metadata": {},
         "user_id": None, "project_id": None, "created_at": None, "updated_at": None},
        {"id": "r2", "session_id": "sess-1", "memory_key": "features",
         "agent_name": "features", "content": {}, "metadata": {},
         "user_id": None, "project_id": None, "created_at": None, "updated_at": None},
    ]
    result_mock = MagicMock()
    result_mock.data = rows
    chain = MagicMock()
    chain.execute.return_value = result_mock
    client = MagicMock()
    client.table.return_value.select.return_value.eq.return_value.order.return_value = chain

    repo = MemoryRepository(client=client)
    entries = await repo.get_by_session("sess-1")
    assert len(entries) == 2
    assert entries[0].memory_key == "problems"
    assert entries[1].memory_key == "features"


@pytest.mark.asyncio
async def test_get_by_session_returns_empty_list():
    result_mock = MagicMock()
    result_mock.data = []
    chain = MagicMock()
    chain.execute.return_value = result_mock
    client = MagicMock()
    client.table.return_value.select.return_value.eq.return_value.order.return_value = chain

    repo = MemoryRepository(client=client)
    entries = await repo.get_by_session("no-such-session")
    assert entries == []


# ---------------------------------------------------------------------------
# get_by_session_and_key
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_by_session_and_key_returns_entry():
    row = {"id": "r1", "session_id": "sess-1", "memory_key": "prd",
           "agent_name": "prd", "content": {"title": "PRD"}, "metadata": {},
           "user_id": None, "project_id": None, "created_at": None, "updated_at": None}
    result_mock = MagicMock()
    result_mock.data = row  # maybe_single returns a dict, not a list
    chain = MagicMock()
    chain.execute.return_value = result_mock
    client = MagicMock()
    (client.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .maybe_single.return_value) = chain

    repo = MemoryRepository(client=client)
    entry = await repo.get_by_session_and_key("sess-1", "prd")
    assert entry is not None
    assert entry.memory_key == "prd"


@pytest.mark.asyncio
async def test_get_by_session_and_key_returns_none_when_missing():
    result_mock = MagicMock()
    result_mock.data = None
    chain = MagicMock()
    chain.execute.return_value = result_mock
    client = MagicMock()
    (client.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .maybe_single.return_value) = chain

    repo = MemoryRepository(client=client)
    entry = await repo.get_by_session_and_key("sess-1", "nonexistent")
    assert entry is None
