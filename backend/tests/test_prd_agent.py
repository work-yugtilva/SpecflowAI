import os
import sys

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))

import pytest
from unittest.mock import AsyncMock, patch


@pytest.fixture
def agent():
    from services.config.load_env import load_root_env
    load_root_env()
    from services.agent_factory import AgentFactory
    return AgentFactory.create("prd")


MINIMAL_MEMORY = {
    "product_context": {"companyName": "Acme", "productName": "Widget"},
    "problems": [{"title": "Problem 1"}],
    "features": [{"title": "Feature 1"}],
    "decompositions": [{"component": "Auth"}],
    "tasks": [{"title": "Task 1"}],
}


# ─── build_prompt() ───────────────────────────────────────────────────────────

def test_build_prompt_includes_product_context(agent):
    prompt = agent.build_prompt("make prd", context=MINIMAL_MEMORY)
    assert "product_context" in prompt
    assert "Acme" in prompt


def test_build_prompt_unwraps_data_wrapper(agent):
    import json
    ctx = {**MINIMAL_MEMORY, "problems": {"data": [{"title": "Unwrapped Problem"}]}}
    prompt = agent.build_prompt("make prd", context=ctx)
    assert "Unwrapped Problem" in prompt
    # Extract the JSON context block and verify problems is a flat list (not wrapped)
    ctx_block = prompt.split("CONTEXT (pipeline outputs")[1].split("INSTRUCTIONS:")[0]
    json_start = ctx_block.index("{")
    parsed = json.loads(ctx_block[json_start:].strip())
    assert isinstance(parsed["problems"], list), "problems should be unwrapped to a flat list"
    assert parsed["problems"][0]["title"] == "Unwrapped Problem"


def test_build_prompt_nested_schema_keys_present(agent):
    prompt = agent.build_prompt("make prd", context=MINIMAL_MEMORY)
    for key in ("acceptance_criteria", "linked_problem", "likelihood", "baseline", "measurement"):
        assert key in prompt, f"Missing nested schema key: {key}"
    assert '"frontend"' in prompt


def test_build_prompt_includes_gaps_note(agent):
    ctx = {**MINIMAL_MEMORY, "_prd_gaps": "Fix: missing metrics"}
    prompt = agent.build_prompt("make prd", context=ctx)
    assert "PREVIOUS ATTEMPT GAPS" in prompt
    assert "Fix: missing metrics" in prompt


def test_build_prompt_instructs_json_object_not_array(agent):
    prompt = agent.build_prompt("make prd", context=MINIMAL_MEMORY)
    assert "SINGLE JSON object" in prompt
    assert "NOT an array" in prompt


# ─── self_critique() ──────────────────────────────────────────────────────────

def test_self_critique_parses_score_and_gaps(agent):
    with patch("services.agents.prd_agent.run_ai", return_value='{"score": 82, "critical_gaps": []}'):
        result = agent.self_critique({"executive_summary": "test"})
    assert result["score"] == 82
    assert result["critical_gaps"] == []


def test_self_critique_strips_markdown_fences(agent):
    raw = '```json\n{"score": 75, "critical_gaps": ["gap1"]}\n```'
    with patch("services.agents.prd_agent.run_ai", return_value=raw):
        result = agent.self_critique({})
    assert result["score"] == 75
    assert result["critical_gaps"] == ["gap1"]


def test_self_critique_returns_zero_on_exception(agent):
    with patch("services.agents.prd_agent.run_ai", side_effect=Exception("timeout")):
        result = agent.self_critique({})
    assert result["score"] == 0
    assert result["critical_gaps"] == ["Self-critique failed"]


# ─── run() ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_returns_draft_and_quality_tuple(agent):
    draft = {"executive_summary": "test", "goals": []}
    with patch.object(agent, "execute_async", new=AsyncMock(return_value=draft)):
        with patch.object(agent, "self_critique", return_value={"score": 85, "critical_gaps": []}):
            result = await agent.run(dict(MINIMAL_MEMORY))
    assert result[0] == draft
    assert result[1]["score"] == 85


@pytest.mark.asyncio
async def test_run_retries_once_when_score_below_70(agent):
    draft = {"executive_summary": "v1"}
    mock_execute = AsyncMock(return_value=draft)
    critiques = [
        {"score": 50, "critical_gaps": ["missing metrics"]},
        {"score": 80, "critical_gaps": []},
    ]
    with patch.object(agent, "execute_async", new=mock_execute):
        with patch.object(agent, "self_critique", side_effect=critiques):
            memory = dict(MINIMAL_MEMORY)
            result_draft, result_quality = await agent.run(memory)
    assert mock_execute.call_count == 2
    assert result_quality["score"] == 80
    assert memory.get("_prd_retry") is True


@pytest.mark.asyncio
async def test_run_does_not_retry_when_flag_already_set(agent):
    draft = {"executive_summary": "test"}
    mock_execute = AsyncMock(return_value=draft)
    with patch.object(agent, "execute_async", new=mock_execute):
        with patch.object(agent, "self_critique", return_value={"score": 40, "critical_gaps": ["x"]}):
            memory = {**MINIMAL_MEMORY, "_prd_retry": True}
            await agent.run(memory)
    assert mock_execute.call_count == 1


@pytest.mark.asyncio
async def test_run_sets_gaps_context_on_retry(agent):
    draft = {"executive_summary": "v1"}
    mock_execute = AsyncMock(return_value=draft)
    critiques = [
        {"score": 55, "critical_gaps": ["no metrics", "vague arch"]},
        {"score": 80, "critical_gaps": []},
    ]
    with patch.object(agent, "execute_async", new=mock_execute):
        with patch.object(agent, "self_critique", side_effect=critiques):
            memory = dict(MINIMAL_MEMORY)
            await agent.run(memory)
    assert "no metrics" in memory["_prd_gaps"]
    assert "55/100" in memory["_prd_gaps"]


# ─── Config sanity ────────────────────────────────────────────────────────────

def test_tasks_yaml_uses_decompositions_key():
    import yaml
    path = os.path.join(os.path.dirname(__file__), "../config/agents/tasks.yaml")
    with open(path) as f:
        config = yaml.safe_load(f)
    keys = config["memory"]["read"]["keys"]
    assert "decompositions" in keys, "tasks.yaml must use 'decompositions' not 'decompose'"
    assert "decompose" not in keys
