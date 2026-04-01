import os
import sys

import pytest

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))


@pytest.fixture
def agent_factory():
    from services.config.load_env import load_root_env
    load_root_env()
    from services.agent_factory import AgentFactory

    return AgentFactory


@pytest.fixture
def full_context():
    def build_items(prefix: str, count: int) -> list[dict]:
        return [{"title": f"{prefix} {idx}"} for idx in range(1, count + 1)]

    return {
        "product_context": {
            "companyName": "Acme",
            "productName": "Widget",
            "productDescription": "A planning workflow product.",
        },
        "ingest": [
            {"content": "Interview 1"},
            {"content": "Interview 2"},
        ],
        "problems": {"data": build_items("Problem", 8)},
        "features": {"data": build_items("Feature", 9)},
        "decompositions": {"data": build_items("Decomposition", 9)},
        "tasks": {"data": build_items("Task", 11)},
    }


@pytest.mark.parametrize(
    "agent_name",
    ["problems", "features", "decompose", "tasks", "prd"],
)
def test_build_prompt_preserves_task_string(agent_factory, full_context, agent_name):
    agent = agent_factory.create(agent_name)
    task = "UNIQUE TASK PAYLOAD"

    prompt = agent.build_prompt(task, context=full_context)

    assert f"<task>\n{task}\n</task>" in prompt


@pytest.mark.parametrize(
    "agent_name",
    ["problems", "features", "decompose", "tasks", "prd"],
)
def test_build_prompt_renders_previous_attempt_failure(agent_factory, full_context, agent_name):
    agent = agent_factory.create(agent_name)
    context = {
        **full_context,
        "previous_attempt_failure": {
            "source": "quality_gate",
            "critical_issues": ["Missing evidence"],
        },
    }

    prompt = agent.build_prompt("task", context=context)

    assert "<previous_attempt_failure>" in prompt
    assert "quality_gate" in prompt
    assert "Missing evidence" in prompt


def test_problems_agent_limits_context_to_product_and_research(agent_factory, full_context):
    agent = agent_factory.create("problems")

    prompt = agent.build_prompt("task", context=full_context)

    assert "<product_context>" in prompt
    assert "<research_context>" in prompt
    assert "<prior_problems>" not in prompt
    assert "<prior_features>" not in prompt
    assert "<prior_decompositions>" not in prompt
    assert "<prior_tasks>" not in prompt


def test_features_agent_uses_clipped_problem_context(agent_factory, full_context):
    agent = agent_factory.create("features")

    prompt = agent.build_prompt("task", context=full_context)

    assert "<product_context>" in prompt
    assert "<research_context>" in prompt
    assert "<prior_problems>" in prompt
    assert "Problem 7" in prompt
    assert "Problem 8" not in prompt
    assert "<prior_features>" not in prompt
    assert "<prior_decompositions>" not in prompt
    assert "<prior_tasks>" not in prompt


def test_decompose_agent_uses_clipped_problem_and_feature_context(agent_factory, full_context):
    agent = agent_factory.create("decompose")

    prompt = agent.build_prompt("task", context=full_context)

    assert "<product_context>" in prompt
    assert "<research_context>" in prompt
    assert "<prior_problems>" in prompt
    assert "<prior_features>" in prompt
    assert "Problem 4" in prompt
    assert "Problem 5" not in prompt
    assert "Feature 8" in prompt
    assert "Feature 9" not in prompt
    assert "<prior_decompositions>" not in prompt
    assert "<prior_tasks>" not in prompt


def test_tasks_agent_uses_clipped_upstream_outputs_only(agent_factory, full_context):
    agent = agent_factory.create("tasks")

    prompt = agent.build_prompt("task", context=full_context)

    assert "<product_context>" not in prompt
    assert "<research_context>" not in prompt
    assert "<prior_problems>" in prompt
    assert "<prior_features>" in prompt
    assert "<prior_decompositions>" in prompt
    assert "Problem 4" in prompt
    assert "Problem 5" not in prompt
    assert "Feature 6" in prompt
    assert "Feature 7" not in prompt
    assert "Decomposition 8" in prompt
    assert "Decomposition 9" not in prompt
    assert "<prior_tasks>" not in prompt


def test_prd_agent_uses_clipped_final_aggregation_context(agent_factory, full_context):
    agent = agent_factory.create("prd")

    prompt = agent.build_prompt("task", context=full_context)

    assert "<product_context>" in prompt
    assert "<research_context>" not in prompt
    assert "<prior_problems>" in prompt
    assert "<prior_features>" in prompt
    assert "<prior_decompositions>" in prompt
    assert "<prior_tasks>" in prompt
    assert "Problem 5" in prompt
    assert "Problem 6" not in prompt
    assert "Feature 6" in prompt
    assert "Feature 7" not in prompt
    assert "Decomposition 8" in prompt
    assert "Decomposition 9" not in prompt
    assert "Task 10" in prompt
    assert "Task 11" not in prompt
