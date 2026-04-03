"""
Unit tests for SessionRepository — persistence layer for sessions, session_state,
and session_events tables.  All Supabase I/O is mocked.
"""
import pytest
from unittest.mock import MagicMock, patch
from services.session.session_repository import SessionRepository
from services.db.models.session import Session, SessionState, SessionEvent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_repo():
    client = MagicMock()
    with patch("services.session.session_repository.get_supabase_client", return_value=client):
        repo = SessionRepository()
    repo.client = client
    return repo


def _result(data):
    r = MagicMock()
    r.data = data
    return r


def _chain(data):
    c = MagicMock()
    c.execute.return_value = _result(data)
    return c


def _session_row(**kwargs):
    d = dict(id="sess-1", project_id=None, user_id=None, session_name="test",
             status="active", metadata={}, created_at=None, updated_at=None)
    d.update(kwargs)
    return d


# ---------------------------------------------------------------------------
# create_session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_session_returns_session():
    row = _session_row(id="new-sess")
    repo = _make_repo()
    repo.client.table.return_value.insert.return_value = _chain([row])

    session = Session(session_name="test", status="active")
    result = await repo.create_session(session)
    assert result.id == "new-sess"


@pytest.mark.asyncio
async def test_create_session_returns_original_when_no_rows():
    repo = _make_repo()
    repo.client.table.return_value.insert.return_value = _chain([])

    session = Session(session_name="test")
    result = await repo.create_session(session)
    assert result is session


# ---------------------------------------------------------------------------
# list_sessions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_sessions_returns_sessions():
    rows = [_session_row(id="s1"), _session_row(id="s2")]
    repo = _make_repo()
    (repo.client.table.return_value
        .select.return_value
        .order.return_value) = _chain(rows)

    result = await repo.list_sessions()
    assert len(result) == 2
    assert result[0].id == "s1"


@pytest.mark.asyncio
async def test_list_sessions_returns_empty():
    repo = _make_repo()
    (repo.client.table.return_value
        .select.return_value
        .order.return_value) = _chain([])

    result = await repo.list_sessions()
    assert result == []


# ---------------------------------------------------------------------------
# get_session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_session_returns_session():
    row = _session_row(id="sess-abc", session_name="My Session")
    chain = _chain(row)  # limit(1) returns list of one row
    chain.execute.return_value.data = [row]
    repo = _make_repo()
    (repo.client.table.return_value
        .select.return_value
        .eq.return_value
        .limit.return_value) = chain

    result = await repo.get_session("sess-abc")
    assert result is not None
    assert result.session_name == "My Session"


@pytest.mark.asyncio
async def test_get_session_returns_none_when_not_found():
    chain = MagicMock()
    chain.execute.return_value = _result([])
    repo = _make_repo()
    (repo.client.table.return_value
        .select.return_value
        .eq.return_value
        .limit.return_value) = chain

    result = await repo.get_session("nonexistent")
    assert result is None


# ---------------------------------------------------------------------------
# update_session_status
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_session_status_calls_update():
    repo = _make_repo()
    (repo.client.table.return_value
        .update.return_value
        .eq.return_value) = _chain([])

    await repo.update_session_status("sess-1", "completed")
    repo.client.table.assert_called_with("sessions")


# ---------------------------------------------------------------------------
# get_state / upsert_state
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_state_returns_none_when_missing():
    chain = MagicMock()
    chain.execute.return_value = _result([])
    repo = _make_repo()
    (repo.client.table.return_value
        .select.return_value
        .eq.return_value
        .limit.return_value) = chain

    result = await repo.get_state("sess-1")
    assert result is None


@pytest.mark.asyncio
async def test_get_state_returns_session_state():
    row = {"id": "st1", "session_id": "sess-1", "state": {"last": "tasks"}, "step": "tasks",
           "created_at": None, "updated_at": None}
    chain = MagicMock()
    chain.execute.return_value = _result([row])
    repo = _make_repo()
    (repo.client.table.return_value
        .select.return_value
        .eq.return_value
        .limit.return_value) = chain

    result = await repo.get_state("sess-1")
    assert result is not None
    assert result.step == "tasks"


@pytest.mark.asyncio
async def test_upsert_state_returns_state():
    row = {"id": "st1", "session_id": "sess-1", "state": {}, "step": None,
           "created_at": None, "updated_at": None}
    repo = _make_repo()
    (repo.client.table.return_value
        .upsert.return_value) = _chain([row])

    state = SessionState(session_id="sess-1", state={"outputs": {}})
    result = await repo.upsert_state(state)
    assert result.session_id == "sess-1"


@pytest.mark.asyncio
async def test_upsert_state_returns_original_when_no_rows():
    repo = _make_repo()
    (repo.client.table.return_value
        .upsert.return_value) = _chain([])

    state = SessionState(session_id="sess-1")
    result = await repo.upsert_state(state)
    assert result is state


# ---------------------------------------------------------------------------
# append_event / get_events
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_append_event_returns_event():
    row = {"id": "ev1", "session_id": "sess-1", "type": "output", "payload": {}, "timestamp": None}
    repo = _make_repo()
    repo.client.table.return_value.insert.return_value = _chain([row])

    event = SessionEvent(session_id="sess-1", type="output")
    result = await repo.append_event(event)
    assert result.id == "ev1"


@pytest.mark.asyncio
async def test_get_events_returns_events():
    rows = [
        {"id": "e1", "session_id": "sess-1", "type": "input", "payload": {}, "timestamp": None},
        {"id": "e2", "session_id": "sess-1", "type": "output", "payload": {}, "timestamp": None},
    ]
    repo = _make_repo()
    (repo.client.table.return_value
        .select.return_value
        .eq.return_value
        .order.return_value) = _chain(rows)

    result = await repo.get_events("sess-1")
    assert len(result) == 2
    assert result[0].type == "input"
