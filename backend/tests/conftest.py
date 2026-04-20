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
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_123")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test_123")
os.environ.setdefault("STRIPE_PRO_PRICE_ID", "price_pro_123")
os.environ.setdefault("STRIPE_TEAM_PRICE_ID", "price_team_123")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))


@pytest_asyncio.fixture(autouse=True)
async def clean_db():
    """
    Autouse fixture: Clean Supabase test database before each test.
    
    Deletes all rows from:
    - pipelines
    - memory_entries
    - sessions
    - context_entries
    - research_entries
    - session_events
    - auth.users (best-effort, logs failures but doesn't fail the test)
    
    Skips cleanup if SUPABASE_URL is not a valid Supabase instance.
    Uses service-role credentials (get_supabase_client()) to bypass RLS.
    """
    try:
        from services.db.supabase_client import get_supabase_client
        
        # Skip cleanup if using test mock URL
        url = os.environ.get("SUPABASE_URL", "").strip()
        if not url or url == "https://test.supabase.co" or "test" in url.lower():
            # Mocked Supabase, skip cleanup
            yield
            return
        
        client = get_supabase_client()
        
        # Tables to clean, in dependency order (FK constraints)
        tables_to_clean = [
            "pipelines",
            "memory_entries", 
            "sessions",
            "context_entries",
            "research_entries",
            "session_events",
        ]
        
        for table_name in tables_to_clean:
            try:
                response = client.table(table_name).delete().neq("id", None).execute()
                row_count = len(response.data) if response.data else 0
                if row_count > 0:
                    print(f"[cleanup] Deleted {row_count} rows from {table_name}")
            except Exception as e:
                print(f"[cleanup] Warning: Failed to clean {table_name}: {e}")
        
        # Attempt to clean auth.users (best-effort, may fail if RLS denies access)
        try:
            response = client.table("users").delete().neq("id", None).execute()
            row_count = len(response.data) if response.data else 0
            if row_count > 0:
                print(f"[cleanup] Deleted {row_count} rows from auth.users")
        except Exception as e:
            # Don't fail the test if auth.users cleanup fails
            print(f"[cleanup] Info: auth.users cleanup skipped or failed: {e}")
        
        yield
        
    except Exception as e:
        # If client creation fails, just skip cleanup and continue
        print(f"[cleanup] Skipping cleanup: {e}")
        yield


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
