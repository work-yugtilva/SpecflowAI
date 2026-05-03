import os
import sys

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))


def test_agent_config_keeps_critic_binary_checks():
    from services.config.config_manager import ConfigManager

    cfg = ConfigManager.load_agent("features").model_dump()

    assert len(cfg["critic"]["binary_checks"]) == 3
    assert cfg["critic"]["binary_checks"][0]["name"] == "evidence_cited"


def test_quality_gate_config_keeps_top_level_binary_checks():
    from services.config.config_manager import ConfigManager

    cfg = ConfigManager.load_agent("quality_gate").model_dump()

    assert len(cfg["binary_checks"]) == 5
    assert cfg["binary_checks"][0]["name"] == "evidence_cited"
