import logging
import os
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))


def _quality_gate_config() -> dict:
    return {
        "role": "Quality reviewer",
        "instructions": "Review quality.",
        "model": "claude-haiku-4-5-20251001",
        "temperature": 0.1,
        "thresholds": {"default": 65},
        "binary_checks": [
            {
                "name": "evidence_cited",
                "pass_condition": "Evidence exists",
                "fail_condition": "Evidence missing",
            }
        ],
    }


class FakeQualityScoresTable:
    def __init__(self, error: Exception | None = None):
        self.error = error
        self.payload = None
        self.executed = False

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        self.executed = True
        if self.error is not None:
            raise self.error
        return SimpleNamespace(data=[self.payload])


class FakeSupabaseClient:
    def __init__(self, table):
        self.quality_scores_table = table
        self.table_names = []

    def table(self, name):
        self.table_names.append(name)
        assert name == "quality_scores"
        return self.quality_scores_table


@pytest.mark.asyncio
async def test_quality_gate_async_persists_successful_llm_score(monkeypatch):
    from services.agents import quality_gate_agent
    from services.agents.quality_gate_agent import QualityGateAgent

    raw = """
    {
      "reasoning": "All checks pass.",
      "items": [
        {
          "index": 0,
          "binary_checks": {"evidence_cited": true},
          "quality_issues": [],
          "quality_flag": null
        }
      ],
      "critical_issues": []
    }
    """
    table = FakeQualityScoresTable()
    monkeypatch.setattr(
        quality_gate_agent,
        "get_supabase_client",
        lambda: FakeSupabaseClient(table),
    )

    agent = QualityGateAgent("quality_gate", _quality_gate_config())
    agent.session_id = "session-1"

    with patch("services.agents.quality_gate_agent.run_ai_async", new=AsyncMock(return_value=raw)):
        result = await agent.evaluate_async(
            "problems",
            [{"id": "p1", "title": "Problem", "research_evidence": "[Source: Interview]"}],
            {"ingest": [{"quote": "Users asked for it"}]},
        )

    assert result["score"] == 100
    assert result["passed"] is True
    assert table.payload == {
        "session_id": "session-1",
        "step_name": "problems",
        "score": 100,
        "passed": True,
        "critical_issues": [],
        "item_scores": [{"id": "p1", "score": 100}],
        "created_at": "now()",
    }
    assert table.executed is True


@pytest.mark.asyncio
async def test_quality_gate_async_persists_deterministic_failure(monkeypatch):
    from services.agents import quality_gate_agent
    from services.agents.quality_gate_agent import QualityGateAgent

    table = FakeQualityScoresTable()
    monkeypatch.setattr(
        quality_gate_agent,
        "get_supabase_client",
        lambda: FakeSupabaseClient(table),
    )

    agent = QualityGateAgent("quality_gate", _quality_gate_config())
    agent.session_id = "session-1"

    with patch("services.agents.quality_gate_agent.run_ai_async", new=AsyncMock()) as llm:
        result = await agent.evaluate_async(
            "features",
            [{"id": "f1", "title": "Feature", "linked_problems": ["P1"]}],
            {},
        )

    assert result["score"] == 0
    assert result["passed"] is False
    assert any("acceptance_criteria" in issue for issue in result["critical_issues"])
    assert table.payload["session_id"] == "session-1"
    assert table.payload["step_name"] == "features"
    assert table.payload["score"] == 0
    assert table.payload["passed"] is False
    assert table.payload["critical_issues"] == result["critical_issues"]
    llm.assert_not_awaited()


@pytest.mark.asyncio
async def test_quality_gate_async_persists_malformed_output(monkeypatch):
    from services.agents import quality_gate_agent
    from services.agents.quality_gate_agent import QualityGateAgent

    table = FakeQualityScoresTable()
    monkeypatch.setattr(
        quality_gate_agent,
        "get_supabase_client",
        lambda: FakeSupabaseClient(table),
    )

    agent = QualityGateAgent("quality_gate", _quality_gate_config())
    agent.session_id = "session-1"

    result = await agent.evaluate_async("tasks", {}, {})

    assert result["score"] == 0
    assert result["passed"] is False
    assert table.payload["session_id"] == "session-1"
    assert table.payload["step_name"] == "tasks"
    assert table.payload["critical_issues"] == result["critical_issues"]


@pytest.mark.asyncio
async def test_quality_score_insert_failure_is_logged_not_raised(monkeypatch, caplog):
    from services.agents import quality_gate_agent
    from services.agents.quality_gate_agent import QualityGateAgent

    table = FakeQualityScoresTable(error=RuntimeError("database offline"))
    monkeypatch.setattr(
        quality_gate_agent,
        "get_supabase_client",
        lambda: FakeSupabaseClient(table),
    )

    agent = QualityGateAgent("quality_gate", _quality_gate_config())
    agent.session_id = "session-1"

    with caplog.at_level(logging.ERROR, logger="specflow.quality_gate"):
        result = await agent.evaluate_async("tasks", {}, {})

    assert result["score"] == 0
    assert result["passed"] is False
    assert "Failed to persist quality score" in caplog.text


@pytest.mark.asyncio
async def test_quality_score_persistence_skips_without_session_id(monkeypatch, caplog):
    from services.agents import quality_gate_agent
    from services.agents.quality_gate_agent import QualityGateAgent

    get_client = AsyncMock()
    monkeypatch.setattr(quality_gate_agent, "get_supabase_client", get_client)

    agent = QualityGateAgent("quality_gate", _quality_gate_config())

    with caplog.at_level(logging.DEBUG, logger="specflow.quality_gate"):
        result = await agent.evaluate_async("tasks", {}, {})

    assert result["score"] == 0
    assert get_client.await_count == 0
    assert "Skipping quality score persistence" in caplog.text
