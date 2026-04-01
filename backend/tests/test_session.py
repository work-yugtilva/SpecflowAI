import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch


def _mock_session(session_id="sess-abc", name="My Session", status="active"):
    s = MagicMock()
    s.id = session_id
    s.session_name = name
    s.status = status
    s.created_at = datetime(2026, 1, 1)
    s.model_dump.return_value = {
        "id": session_id,
        "session_name": name,
        "status": status,
        "metadata": {},
        "created_at": "2026-01-01T00:00:00",
    }
    return s


# ── POST /session/create ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_session_returns_session_id(client):
    mock_sm = AsyncMock()
    mock_sm.create_session.return_value = _mock_session()
    with patch("main.SessionManager", return_value=mock_sm):
        response = await client.post("/session/create", json={"session_name": "My Session"})
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "sess-abc"
    assert data["session_name"] == "My Session"
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_create_session_missing_name_returns_422(client):
    response = await client.post("/session/create", json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_session_with_metadata(client):
    mock_sm = AsyncMock()
    mock_sm.create_session.return_value = _mock_session()
    with patch("main.SessionManager", return_value=mock_sm):
        response = await client.post(
            "/session/create",
            json={"session_name": "Meta Session", "metadata": {"key": "value"}},
        )
    assert response.status_code == 200
    mock_sm.create_session.assert_called_once_with(
        session_name="Meta Session",
        project_id=None,
        metadata={"key": "value"},
        user_id="test-user-id",
    )


@pytest.mark.asyncio
async def test_create_session_db_error_returns_500(client):
    mock_sm = AsyncMock()
    mock_sm.create_session.side_effect = RuntimeError("DB connection failed")
    with patch("main.SessionManager", return_value=mock_sm):
        response = await client.post("/session/create", json={"session_name": "fail"})
    assert response.status_code == 500


# ── GET /session/{session_id} ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_session_returns_full_detail(client):
    session = _mock_session()
    mock_sm = AsyncMock()
    mock_sm.get_full_session.return_value = {
        "session": session.model_dump(),
        "state": None,
        "events": [],
    }
    with patch("main.SessionManager", return_value=mock_sm):
        response = await client.get("/session/sess-abc")
    assert response.status_code == 200
    data = response.json()
    assert data["session"]["id"] == "sess-abc"
    assert data["state"] is None
    assert data["events"] == []


@pytest.mark.asyncio
async def test_get_session_not_found_returns_404(client):
    mock_sm = AsyncMock()
    mock_sm.get_full_session.side_effect = ValueError("Session not found: bad-id")
    with patch("main.SessionManager", return_value=mock_sm):
        response = await client.get("/session/bad-id")
    assert response.status_code == 404


# ── POST /session/{session_id}/run ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_session_success(client):
    session = _mock_session()
    mock_sm = AsyncMock()
    mock_sm.load_session.return_value = session
    mock_sm.get_current_state.return_value = {"last_completed_step": "problems"}

    mock_pipeline = AsyncMock()
    mock_pipeline.run.return_value = {"problems": [{"title": "Slow search"}]}

    with patch("main.SessionManager", return_value=mock_sm), \
         patch("main.Pipeline", return_value=mock_pipeline):
        response = await client.post(
            "/session/sess-abc/run",
            json={
                "input_data": {"context": {}, "research": [], "ingest": []},
                "step": "problems",
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "problems" in data["data"]


@pytest.mark.asyncio
async def test_run_session_already_completed_returns_400(client):
    from main import SESSION_STATUS_COMPLETED
    session = _mock_session(status=SESSION_STATUS_COMPLETED)
    session.status = SESSION_STATUS_COMPLETED
    mock_sm = AsyncMock()
    mock_sm.load_session.return_value = session
    with patch("main.SessionManager", return_value=mock_sm):
        response = await client.post("/session/sess-abc/run", json={"input_data": {}})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_run_session_not_found_returns_404(client):
    mock_sm = AsyncMock()
    mock_sm.load_session.side_effect = ValueError("Session not found: bad-id")
    with patch("main.SessionManager", return_value=mock_sm):
        response = await client.post("/session/bad-id/run", json={"input_data": {}})
    assert response.status_code == 404
