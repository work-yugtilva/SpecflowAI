import os
import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))

SESSION_ID = "abcdef1234567890"
SHORT_ID = SESSION_ID[:8]

FIXTURE_HANDOFF = {
    "project_brief": "Build a task management app using FastAPI and React.",
    "architecture_notes": "Use REST endpoints. Store tasks in Supabase.",
    "execution_order": ["Setup DB schema", "Implement API", "Build frontend"],
    "tasks": [
        {
            "id": "task-1",
            "title": "Create tasks table",
            "layer": "infrastructure",
            "implementation_prompt": "Create migration at db/migrations/001_tasks.sql.",
            "acceptance_criteria": "Migration runs without error.",
            "dependencies": [],
            "needs_clarification": False,
            "clarification_reason": "",
            "antipatterns": "Do not hardcode column defaults.",
        },
        {
            "id": "task-2",
            "title": "Implement task CRUD",
            "layer": "backend",
            "implementation_prompt": "Add POST /tasks and GET /tasks in main.py.",
            "acceptance_criteria": "Endpoints return 200 with correct schema.",
            "dependencies": ["task-1"],
            "needs_clarification": True,
            "clarification_reason": "Acceptance criteria do not specify pagination behavior.",
            "antipatterns": "",
        },
    ],
    "needs_clarification_count": 1,
    "estimated_sessions": "2",
}


def _make_entry():
    entry = MagicMock()
    entry.content = {"data": FIXTURE_HANDOFF}
    return entry


@pytest.mark.asyncio
async def test_export_claude_md(client):
    with patch("main.MemoryRepository") as MockRepo:
        MockRepo.return_value.get_by_session_and_key = AsyncMock(return_value=_make_entry())
        resp = await client.get(f"/session/{SESSION_ID}/agent_handoff/export?format=claude_md")

    assert resp.status_code == 200
    assert "text/markdown" in resp.headers["content-type"]
    assert f"CLAUDE-{SHORT_ID}.md" in resp.headers["content-disposition"]
    body = resp.text
    assert "# Agent Implementation Handoff" in body
    assert "Build a task management app" in body
    assert "Create tasks table" in body


@pytest.mark.asyncio
async def test_export_cursor_rules(client):
    with patch("main.MemoryRepository") as MockRepo:
        MockRepo.return_value.get_by_session_and_key = AsyncMock(return_value=_make_entry())
        resp = await client.get(f"/session/{SESSION_ID}/agent_handoff/export?format=cursor_rules")

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert f".cursorrules-{SHORT_ID}" in resp.headers["content-disposition"]
    body = resp.text
    assert ".cursorrules" in body
    assert "Build a task management app" in body
    assert "Create tasks table" in body


@pytest.mark.asyncio
async def test_export_task_list(client):
    with patch("main.MemoryRepository") as MockRepo:
        MockRepo.return_value.get_by_session_and_key = AsyncMock(return_value=_make_entry())
        resp = await client.get(f"/session/{SESSION_ID}/agent_handoff/export?format=task_list")

    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert f"task-prompts-{SHORT_ID}.txt" in resp.headers["content-disposition"]
    body = resp.text
    assert "Task 1: Create tasks table" in body
    assert "Task 2: Implement task CRUD" in body
    assert "NEEDS CLARIFICATION" in body


@pytest.mark.asyncio
async def test_export_unsupported_format(client):
    resp = await client.get(f"/session/{SESSION_ID}/agent_handoff/export?format=invalid")
    assert resp.status_code == 400
    assert "Unsupported format" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_export_not_found(client):
    with patch("main.MemoryRepository") as MockRepo:
        MockRepo.return_value.get_by_session_and_key = AsyncMock(return_value=None)
        resp = await client.get(f"/session/{SESSION_ID}/agent_handoff/export?format=claude_md")

    assert resp.status_code == 404
