import logging
import os
import sys

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
