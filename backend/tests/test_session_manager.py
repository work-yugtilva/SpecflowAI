"""
Unit tests for SessionManager — coordination layer over SessionRepository.
Mocks the repository to isolate lifecycle logic.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from services.session.session_manager import SessionManager
from services.db.models.session import Session, SessionState, SessionEvent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_manager():
    """SessionManager with fully mocked repo and memory repo."""
    mgr = SessionManager(client=MagicMock())
    mgr.repo = MagicMock()
    return mgr


def _session(**kwargs):
    d = dict(id="s1", session_name="test", status="active", metadata={},
             project_id=None, user_id=None, created_at=None, updated_at=None)
    d.update(kwargs)
    return Session(**d)


# ---------------------------------------------------------------------------
# create_session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_session_delegates_to_repo():
    mgr = _make_manager()
    expected = _session(id="new-id")
    mgr.repo.create_session = AsyncMock(return_value=expected)

    result = await mgr.create_session("My Session", project_id="p1", user_id="u1")

    mgr.repo.create_session.assert_awaited_once()
    call_arg = mgr.repo.create_session.call_args[0][0]
    assert call_arg.session_name == "My Session"
    assert call_arg.user_id == "u1"
    assert result is expected


@pytest.mark.asyncio
async def test_create_session_defaults_empty_metadata():
    mgr = _make_manager()
    mgr.repo.create_session = AsyncMock(return_value=_session())
    await mgr.create_session("S")
    call_arg = mgr.repo.create_session.call_args[0][0]
    assert call_arg.metadata == {}


# ---------------------------------------------------------------------------
# load_session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_load_session_returns_session():
    mgr = _make_manager()
    sess = _session(id="s1")
    mgr.repo.get_session = AsyncMock(return_value=sess)

    result = await mgr.load_session("s1")
    assert result is sess


@pytest.mark.asyncio
async def test_load_session_raises_value_error_when_not_found():
    mgr = _make_manager()
    mgr.repo.get_session = AsyncMock(return_value=None)

    with pytest.raises(ValueError, match="Session not found"):
        await mgr.load_session("bad-id")


# ---------------------------------------------------------------------------
# list_sessions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_sessions_delegates():
    mgr = _make_manager()
    sessions = [_session(id="s1"), _session(id="s2")]
    mgr.repo.list_sessions = AsyncMock(return_value=sessions)

    result = await mgr.list_sessions()
    assert result is sessions


# ---------------------------------------------------------------------------
# get_current_state / update_state
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_current_state_returns_empty_when_no_row():
    mgr = _make_manager()
    mgr.repo.get_state = AsyncMock(return_value=None)

    result = await mgr.get_current_state("s1")
    assert result == {}


@pytest.mark.asyncio
async def test_get_current_state_returns_state_dict():
    mgr = _make_manager()
    state_row = SessionState(session_id="s1", state={"last": "tasks"})
    mgr.repo.get_state = AsyncMock(return_value=state_row)

    result = await mgr.get_current_state("s1")
    assert result == {"last": "tasks"}


@pytest.mark.asyncio
async def test_update_state_calls_upsert():
    mgr = _make_manager()
    mgr.repo.upsert_state = AsyncMock()

    await mgr.update_state("s1", {"outputs": {}}, step="tasks")

    mgr.repo.upsert_state.assert_awaited_once()
    call_arg = mgr.repo.upsert_state.call_args[0][0]
    assert call_arg.session_id == "s1"
    assert call_arg.step == "tasks"


# ---------------------------------------------------------------------------
# append_event (fire-and-forget — errors must not propagate)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_append_event_delegates():
    mgr = _make_manager()
    mgr.repo.append_event = AsyncMock()

    await mgr.append_event("s1", "output", {"key": "val"})

    mgr.repo.append_event.assert_awaited_once()
    call_arg = mgr.repo.append_event.call_args[0][0]
    assert call_arg.type == "output"
    assert call_arg.payload == {"key": "val"}


@pytest.mark.asyncio
async def test_append_event_swallows_exceptions():
    mgr = _make_manager()
    mgr.repo.append_event = AsyncMock(side_effect=Exception("DB down"))

    # Must NOT raise
    await mgr.append_event("s1", "output")


# ---------------------------------------------------------------------------
# get_full_session
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_full_session_raises_when_not_found():
    mgr = _make_manager()
    mgr.repo.get_session = AsyncMock(return_value=None)

    with pytest.raises(ValueError, match="Session not found"):
        await mgr.get_full_session("bad-id")


@pytest.mark.asyncio
async def test_get_full_session_returns_composite():
    mgr = _make_manager()
    sess = _session(id="s1")
    mgr.repo.get_session = AsyncMock(return_value=sess)
    mgr.repo.get_state = AsyncMock(return_value=None)
    mgr.repo.get_events = AsyncMock(return_value=[])

    result = await mgr.get_full_session("s1")

    assert "session" in result
    assert result["state"] is None
    assert result["events"] == []


@pytest.mark.asyncio
async def test_get_full_session_merges_memory_entries():
    """Memory entries must be merged into state.outputs when state exists."""
    from services.memory.memory_schemas import MemoryEntry

    mgr = _make_manager()
    sess = _session(id="s1")
    state_row = SessionState(session_id="s1", state={"outputs": {"problems": []}})
    prd_entry = MemoryEntry(session_id="s1", agent_name="prd", memory_key="prd",
                             content={"title": "PRD"})

    mgr.repo.get_session = AsyncMock(return_value=sess)
    mgr.repo.get_state = AsyncMock(return_value=state_row)
    mgr.repo.get_events = AsyncMock(return_value=[])

    with patch("services.session.session_manager.MemoryRepository") as MockRepo:
        mock_repo_instance = MagicMock()
        mock_repo_instance.get_by_session = AsyncMock(return_value=[prd_entry])
        MockRepo.return_value = mock_repo_instance

        result = await mgr.get_full_session("s1")

    assert result["state"]["state"]["outputs"]["prd"] == {"title": "PRD"}
