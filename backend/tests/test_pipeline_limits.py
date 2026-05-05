from services.security.pipeline_limits import (
    DEFAULT_DISABLED_PIPELINE_LIMIT,
    pipeline_limits_disabled,
    pipeline_run_limit,
)


def test_pipeline_limits_disabled_by_default(monkeypatch):
    monkeypatch.delenv("DISABLE_PIPELINE_LIMITS", raising=False)
    monkeypatch.delenv("RATE_LIMIT_PIPELINE", raising=False)

    assert pipeline_limits_disabled() is True
    assert pipeline_run_limit() == DEFAULT_DISABLED_PIPELINE_LIMIT


def test_pipeline_limits_can_be_re_enabled(monkeypatch):
    monkeypatch.setenv("DISABLE_PIPELINE_LIMITS", "false")
    monkeypatch.setenv("RATE_LIMIT_PIPELINE", "10/hour")

    assert pipeline_limits_disabled() is False
    assert pipeline_run_limit() == "10/hour"
