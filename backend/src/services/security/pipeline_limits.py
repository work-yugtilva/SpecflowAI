import os


DEFAULT_PIPELINE_LIMIT = "10/hour"
DEFAULT_DISABLED_PIPELINE_LIMIT = "1000000/hour"


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def pipeline_limits_disabled() -> bool:
    return _truthy(os.getenv("DISABLE_PIPELINE_LIMITS", "true"))


def pipeline_run_limit() -> str:
    if pipeline_limits_disabled():
        return DEFAULT_DISABLED_PIPELINE_LIMIT
    return os.getenv("RATE_LIMIT_PIPELINE", DEFAULT_PIPELINE_LIMIT)
