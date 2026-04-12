import os
import sys

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_generate_prd_success(client):
    mock_sm = AsyncMock()
    mock_sm.load_session.return_value.user_id = "test-user-id"
    mock_sm.get_current_state.return_value = {
        "outputs": {
            "product_context": {"companyName": "Acme"},
            "problems": [{"title": "p1"}],
            "features": [{"title": "f1"}],
            "decompositions": [{"component": "Auth"}],
            "tasks": [{"title": "t1"}],
        }
    }
    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(return_value=(
        {"executive_summary": "test"},
        {"score": 85, "critical_gaps": []},
    ))
    mock_memory_repo = AsyncMock()

    with patch("main.SessionManager", return_value=mock_sm), \
         patch("main.AgentFactory.create", return_value=mock_agent), \
         patch("main.MemoryRepository", return_value=mock_memory_repo):
        response = await client.post("/session/test-session-id/prd")

    assert response.status_code == 200
    body = response.json()
    assert "prd" in body
    assert "quality_score" in body
    assert body["quality_score"]["score"] == 85
    mock_agent.run.assert_called_once()


@pytest.mark.asyncio
async def test_generate_prd_missing_prerequisites_returns_422(client):
    mock_sm = AsyncMock()
    mock_sm.load_session.return_value.user_id = "test-user-id"
    mock_sm.get_current_state.return_value = {
        "outputs": {
            "problems": [{"title": "p1"}],
            # features, decompositions, tasks all missing
        }
    }
    with patch("main.SessionManager", return_value=mock_sm):
        response = await client.post("/session/test-session-id/prd")

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any(k in detail for k in ("features", "decompositions", "tasks"))


@pytest.mark.asyncio
async def test_generate_prd_passes_product_context_to_agent(client):
    mock_sm = AsyncMock()
    mock_sm.load_session.return_value.user_id = "test-user-id"
    mock_sm.get_current_state.return_value = {
        "outputs": {
            "product_context": {"companyName": "TestCo"},
            "problems": [{"title": "p1"}],
            "features": [{"title": "f1"}],
            "decompositions": [{"component": "Auth"}],
            "tasks": [{"title": "t1"}],
        }
    }
    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(return_value=(
        {"executive_summary": "ok"},
        {"score": 90, "critical_gaps": []},
    ))
    mock_memory_repo = AsyncMock()

    with patch("main.SessionManager", return_value=mock_sm), \
         patch("main.AgentFactory.create", return_value=mock_agent), \
         patch("main.MemoryRepository", return_value=mock_memory_repo):
        await client.post("/session/test-session-id/prd")

    context_arg = mock_agent.run.call_args[0][0]
    assert "product_context" in context_arg
    assert context_arg["product_context"]["companyName"] == "TestCo"
