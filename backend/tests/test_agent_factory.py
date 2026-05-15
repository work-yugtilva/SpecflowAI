import logging
import os
import sys

import pytest

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))


def test_agent_factory_merges_google_feature_routing():
    from services.agent_factory import AgentFactory

    agent = AgentFactory.create("features")

    assert agent.config["provider"] == "google"
    assert agent.config["model"] == "gemini-2.5-flash"
    assert agent.config["use_cache"] is False
    assert agent.config["use_batch"] is False


def test_agent_factory_merges_quality_gate_batch_routing():
    from services.agent_factory import AgentFactory

    agent = AgentFactory.create("quality_gate")

    assert agent.config["provider"] == "anthropic"
    assert agent.config["model"] == "claude-haiku-4-5-20251001"
    assert agent.config["use_cache"] is False
    assert agent.config["use_batch"] is False


def test_agent_factory_defaults_when_agent_missing_from_routing():
    from services.agent_factory import AgentFactory
    from services.config.config_manager import ConfigManager

    original_config = ConfigManager.load_agent("agent_handoff")
    agent = AgentFactory.create("agent_handoff")

    assert agent.config["provider"] == "anthropic"
    assert agent.config["model"] == original_config.model
    assert agent.config["use_cache"] is False
    assert agent.config["use_batch"] is False


def test_agent_factory_logs_resolved_provider_and_model(caplog):
    from services.agent_factory import AgentFactory

    with caplog.at_level(logging.INFO, logger="specflow.agent_factory"):
        AgentFactory.create("features")

    assert "provider=google" in caplog.text
    assert "model=gemini-2.5-flash" in caplog.text


@pytest.mark.asyncio
async def test_problems_agent_returns_empty_without_calling_model_for_empty_evidence():
    from unittest.mock import AsyncMock, patch

    from services.agents.problems_agent import ProblemsAgent
    from services.config.config_manager import ConfigManager

    agent = ProblemsAgent("problems", ConfigManager.load_agent("problems").model_dump())

    async def fake_structured_response(_prompt, response_model, **_kwargs):
        return response_model(
            reasoning="No usable evidence, but fabricating a placeholder anyway.",
            items=[
                {
                    "id": "PROB-001",
                    "title": "Insufficient source data",
                    "description": "The session lacks enough source material to identify real user problems.",
                    "user_problem_it_solves": "Users need to know more evidence is required.",
                    "severity": "low",
                    "confidence": 0,
                    "acceptance_criteria": "Upload source material.",
                    "research_evidence": "Insufficient source data",
                    "source_ids": [],
                    "citation_confidence": "insufficient",
                }
            ],
        )

    with patch(
        "services.ai.client.run_ai_structured_async",
        new=AsyncMock(side_effect=fake_structured_response),
    ) as run_ai:
        result = await agent.execute_async(
            "Find problems",
            context={
                "product_context": {
                    "companyName": "Acme",
                    "productName": "Widget",
                    "productDescription": "A widget for users",
                },
                "ingest": [],
                "research": [],
            },
        )

    assert result == []
    run_ai.assert_not_awaited()
