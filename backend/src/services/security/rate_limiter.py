import os

from fastapi import Request
from slowapi import Limiter


def _get_user_id(request: Request) -> str:
    """Use authenticated user_id for rate limits; fallback to client host when unavailable."""
    user = getattr(request.state, "user", None)
    if user is None:
        client = getattr(request, "client", None)
        host = getattr(client, "host", None)
        return host or "unknown"
    return str(getattr(user, "user_id", getattr(user, "id", "unknown")))


limiter = Limiter(key_func=_get_user_id)

PIPELINE_RUN_LIMIT = os.getenv("RATE_LIMIT_PIPELINE", "1000/hour")  # TODO: revert to 10/hour after testing
AGENT_HANDOFF_LIMIT = os.getenv("RATE_LIMIT_HANDOFF", "1000/hour")  # TODO: revert to 20/hour after testing
GENERAL_API_LIMIT = os.getenv("RATE_LIMIT_GENERAL", "10000/minute")  # TODO: revert to 120/minute after testing

