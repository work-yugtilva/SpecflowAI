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
    assert "<product_context>" in prompt
    assert "Acme" in prompt


def test_build_prompt_unwraps_data_wrapper(agent):
    ctx = {**MINIMAL_MEMORY, "problems": {"data": [{"title": "Unwrapped Problem"}]}}
    prompt = agent.build_prompt("make prd", context=ctx)
    assert "Unwrapped Problem" in prompt
    assert "<prior_problems>" in prompt


def test_build_prompt_nested_schema_keys_present(agent):
    prompt = agent.build_prompt("make prd", context=MINIMAL_MEMORY)
    for key in ("reasoning", "acceptance_criteria", "linked_problem", "likelihood", "baseline", "measurement"):
        assert key in prompt, f"Missing nested schema key: {key}"
    assert '"frontend"' in prompt


def test_build_prompt_includes_gaps_note(agent):
    ctx = {
        **MINIMAL_MEMORY,
        "previous_attempt_failure": {
            "source": "prd_self_critique",
            "critical_issues": ["missing metrics"],
        },
    }
    prompt = agent.build_prompt("make prd", context=ctx)
    assert "<previous_attempt_failure>" in prompt
    assert "missing metrics" in prompt


def test_build_prompt_ignores_prd_gaps_without_normalized_retry_context(agent):
    ctx = {**MINIMAL_MEMORY, "_prd_gaps": {"source": "prd_self_critique", "critical_issues": ["missing metrics"]}}
    prompt = agent.build_prompt("make prd", context=ctx)
    assert "<previous_attempt_failure>" not in prompt


def test_build_prompt_uses_yaml_guidance_and_base_response_contract(agent):
    prompt = agent.build_prompt("make prd", context=MINIMAL_MEMORY)
    assert "Use this exact output structure" in prompt
    assert "Schema:" in prompt
    assert "<response_contract>" in prompt


# ─── self_critique() ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_self_critique_parses_score_and_gaps(agent):
    valid_prd = {
        "executive_summary": "This is the PRD.",
        "architecture": {"frontend": "React", "backend": "Node"}
    }
    with patch("services.agents.prd_agent.run_ai_async", new=AsyncMock(return_value='{"reasoning": "Grounded and specific.", "score": 82, "critical_gaps": []}')):
        result = await agent.self_critique(valid_prd)
    assert result["reasoning"] == "Grounded and specific."
    assert result["score"] == 82
    assert result["critical_gaps"] == []


@pytest.mark.asyncio
async def test_self_critique_strips_markdown_fences(agent):
    valid_prd = {
        "executive_summary": "This is the PRD.",
        "architecture": {"frontend": "React", "backend": "Node"}
    }
    raw = '```json\n{"reasoning": "Missing one metric.", "score": 75, "critical_gaps": ["gap1"]}\n```'
    with patch("services.agents.prd_agent.run_ai_async", new=AsyncMock(return_value=raw)):
        result = await agent.self_critique(valid_prd)
    assert result["reasoning"] == "Missing one metric."
    assert result["score"] == 75
    assert result["critical_gaps"] == ["gap1"]


@pytest.mark.asyncio
async def test_self_critique_returns_zero_on_exception(agent):
    valid_prd = {
        "executive_summary": "This is the PRD.",
        "architecture": {"frontend": "React", "backend": "Node"}
    }
    with patch("services.agents.prd_agent.run_ai_async", new=AsyncMock(side_effect=Exception("timeout"))):
        result = await agent.self_critique(valid_prd)
    assert result["score"] == 0
    assert result["reasoning"]
    assert result["critical_gaps"] == ["Self-critique failed"]


# ─── run() ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_returns_draft_and_quality_tuple(agent):
    draft = {"executive_summary": "test", "goals": []}
    with patch.object(agent, "execute_async", new=AsyncMock(return_value=draft)):
        with patch.object(agent, "self_critique", new=AsyncMock(return_value={"score": 85, "critical_gaps": []})):
            result = await agent.run(dict(MINIMAL_MEMORY))
    assert result[0] == draft
    assert result[1]["score"] == 85


@pytest.mark.asyncio
async def test_run_retries_once_when_score_below_70(agent):
    draft = {"executive_summary": "v1"}
    mock_execute = AsyncMock(return_value=draft)
    critiques = [
        {"reasoning": "No metrics in goals.", "score": 50, "critical_gaps": ["missing metrics"]},
        {"reasoning": "Improved.", "score": 80, "critical_gaps": []},
    ]
    with patch.object(agent, "execute_async", new=mock_execute):
        with patch.object(agent, "self_critique", new=AsyncMock(side_effect=critiques)):
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
        with patch.object(agent, "self_critique", new=AsyncMock(return_value={"reasoning": "Still weak.", "score": 40, "critical_gaps": ["x"]})):
            memory = {**MINIMAL_MEMORY, "_prd_retry": True}
            await agent.run(memory)
    assert mock_execute.call_count == 1


@pytest.mark.asyncio
async def test_run_sets_structured_failure_context_on_retry(agent):
    draft = {"executive_summary": "v1"}
    mock_execute = AsyncMock(return_value=draft)
    critiques = [
        {"reasoning": "No metrics and vague architecture.", "score": 55, "critical_gaps": ["no metrics", "vague arch"]},
        {"reasoning": "Resolved.", "score": 80, "critical_gaps": []},
    ]
    with patch.object(agent, "execute_async", new=mock_execute):
        with patch.object(agent, "self_critique", new=AsyncMock(side_effect=critiques)):
            memory = dict(MINIMAL_MEMORY)
            await agent.run(memory)
    assert memory["_prd_gaps"]["source"] == "prd_self_critique"
    assert memory["_prd_gaps"]["score"] == 55
    assert memory["_prd_gaps"]["critical_issues"] == ["no metrics", "vague arch"]
    assert memory["_prd_gaps"]["reasoning"] == "No metrics and vague architecture."


@pytest.mark.asyncio
async def test_run_passes_previous_attempt_failure_to_retry(agent):
    draft = {"executive_summary": "v1"}
    mock_execute = AsyncMock(side_effect=[draft, draft])
    critiques = [
        {"reasoning": "Missing metrics.", "score": 55, "critical_gaps": ["no metrics"]},
        {"reasoning": "Resolved.", "score": 80, "critical_gaps": []},
    ]
    with patch.object(agent, "execute_async", new=mock_execute):
        with patch.object(agent, "self_critique", new=AsyncMock(side_effect=critiques)):
            await agent.run(dict(MINIMAL_MEMORY))

    second_call = mock_execute.await_args_list[1]
    retry_context = second_call.kwargs["context"]
    assert retry_context["previous_attempt_failure"]["source"] == "prd_self_critique"
    assert retry_context["previous_attempt_failure"]["score"] == 55
    assert retry_context["previous_attempt_failure"]["critical_issues"] == ["no metrics"]


# ─── Deterministic Checks ─────────────────────────────────────────────────────

def test_prd_deterministic_checks_missing_executive_summary():
    from services.agents.prd_agent import PRDAgent
    prd = {}
    failures = PRDAgent._run_prd_deterministic_checks(prd)
    assert any("executive_summary" in f for f in failures)


def test_prd_deterministic_checks_missing_architecture():
    from services.agents.prd_agent import PRDAgent
    prd = {"executive_summary": "This is the PRD."}
    failures = PRDAgent._run_prd_deterministic_checks(prd)
    assert any("architecture" in f for f in failures)


def test_prd_deterministic_checks_missing_frontend_backend():
    from services.agents.prd_agent import PRDAgent
    prd = {
        "executive_summary": "This is the PRD.",
        "architecture": {"data": "Schema design"}
    }
    failures = PRDAgent._run_prd_deterministic_checks(prd)
    assert any("frontend" in f for f in failures)
    assert any("backend" in f for f in failures)


def test_prd_deterministic_checks_valid():
    from services.agents.prd_agent import PRDAgent
    prd = {
        "executive_summary": "This is the PRD.",
        "architecture": {
            "frontend": "React app",
            "backend": "Node API",
            "data": "PostgreSQL"
        }
    }
    failures = PRDAgent._run_prd_deterministic_checks(prd)
    assert failures == []


@pytest.mark.asyncio
async def test_self_critique_skips_llm_on_deterministic_failure(agent):
    prd = {"executive_summary": ""}  # Missing/empty executive summary
    result = await agent.self_critique(prd)
    assert result["score"] == 0
    assert any("executive_summary" in str(gap) for gap in result["critical_gaps"])


# ─── Config sanity ────────────────────────────────────────────────────────────

def test_tasks_yaml_uses_decompositions_key():
    import yaml
    path = os.path.join(os.path.dirname(__file__), "../config/agents/tasks.yaml")
    with open(path) as f:
        config = yaml.safe_load(f)
    keys = config["memory"]["read"]["keys"]
    assert "decompositions" in keys, "tasks.yaml must use 'decompositions' not 'decompose'"
    assert "decompose" not in keys
