import os
import sys

import pytest_asyncio
from unittest.mock import MagicMock

# Set env vars BEFORE any backend import (load_root_env runs at import time)
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))


@pytest_asyncio.fixture
async def client():
    from httpx import AsyncClient, ASGITransport
    from main import app, AuthContext, require_auth_context

    async def _fake_auth():
        return AuthContext(user_id="test-user-id", client=MagicMock(name="supabase_client"))

    app.dependency_overrides[require_auth_context] = _fake_auth
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
