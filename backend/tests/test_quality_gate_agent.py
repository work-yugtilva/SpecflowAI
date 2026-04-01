import os
import sys

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))

from unittest.mock import patch


def test_quality_gate_uses_decompositions_threshold():
    from services.agent_factory import AgentFactory

    agent = AgentFactory.create("quality_gate")

    assert agent._get_threshold("decompositions") == 60


def test_quality_gate_evaluate_strips_reasoning_and_scores():
    from services.agent_factory import AgentFactory

    agent = AgentFactory.create("quality_gate")
    raw = """
    {
      "reasoning": "One item failed evidence_cited.",
      "items": [
        {
          "index": 0,
          "binary_checks": {"evidence_cited": false, "metrics_concrete": true},
          "quality_issues": ["Evidence citation is missing."],
          "quality_flag": null
        }
      ],
      "critical_issues": ["Evidence citation is missing."]
    }
    """

    with patch("services.agents.quality_gate_agent.run_ai", return_value=raw):
        result = agent.evaluate(
            "features",
            [{"id": "f1", "title": "Feature 1", "acceptance_criteria": "Users can do X", "linked_problems": ["P1"]}],
            {"ingest": [{"quote": "Users asked for evidence."}]},
        )

    assert "reasoning" not in result
    assert result["score"] == 0
    assert result["passed"] is False
    assert result["items"][0]["quality_flag"] == "binary_fail"


# ─── Deterministic Checks ─────────────────────────────────────────────────────

def test_deterministic_checks_features_missing_acceptance_criteria():
    from services.agent_factory import AgentFactory

    agent = AgentFactory.create("quality_gate")
    failures = agent._run_deterministic_checks("features", [
        {"id": "f1", "title": "Feature 1", "linked_problems": ["P1"]}
    ])
    assert any("acceptance_criteria" in f for f in failures)


def test_deterministic_checks_features_missing_linked_problems():
    from services.agent_factory import AgentFactory

    agent = AgentFactory.create("quality_gate")
    failures = agent._run_deterministic_checks("features", [
        {"id": "f1", "title": "Feature 1", "acceptance_criteria": "AC1"}
    ])
    assert any("linked_problems" in f for f in failures)


def test_deterministic_checks_features_valid():
    from services.agent_factory import AgentFactory

    agent = AgentFactory.create("quality_gate")
    failures = agent._run_deterministic_checks("features", [
        {
            "id": "f1",
            "title": "Feature 1",
            "acceptance_criteria": "User can login",
            "linked_problems": ["P1"]
        }
    ])
    assert failures == []


def test_deterministic_checks_tasks_non_imperative():
    from services.agent_factory import AgentFactory

    agent = AgentFactory.create("quality_gate")
    failures = agent._run_deterministic_checks("tasks", [
        {
            "id": "t1",
            "title": "The feature should be deployed",
            "acceptance_criteria": "Deployment successful"
        }
    ])
    assert any("imperative verb" in f for f in failures)


def test_deterministic_checks_tasks_missing_acceptance_criteria():
    from services.agent_factory import AgentFactory

    agent = AgentFactory.create("quality_gate")
    failures = agent._run_deterministic_checks("tasks", [
        {"id": "t1", "title": "Implement authentication"}
    ])
    assert any("acceptance_criteria" in f for f in failures)


def test_deterministic_checks_tasks_valid():
    from services.agent_factory import AgentFactory

    agent = AgentFactory.create("quality_gate")
    failures = agent._run_deterministic_checks("tasks", [
        {
            "id": "t1",
            "title": "Implement authentication",
            "acceptance_criteria": "Users can login with email"
        }
    ])
    assert failures == []


def test_evaluate_skips_llm_on_deterministic_failure():
    from services.agent_factory import AgentFactory

    agent = AgentFactory.create("quality_gate")
    # Missing acceptance_criteria should trigger deterministic failure
    result = agent.evaluate(
        "features",
        [{"id": "f1", "title": "Feature 1", "linked_problems": ["P1"]}],
        {},
    )
    assert result["score"] == 0
    assert result["passed"] is False
    assert any("acceptance_criteria" in str(issue) for issue in result["critical_issues"])
