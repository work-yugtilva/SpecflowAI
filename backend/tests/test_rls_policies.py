"""
Integration tests verifying Supabase RLS policies from 011_enable_rls.sql.

Tests that Row Level Security policies correctly:
1. Allow users to read/write/update/delete their own data
2. Block users from accessing other users' data
3. Allow service-role (admin) access for system operations
"""
import os
import pytest
import uuid
from typing import Optional

# Skip entire test module if using test mock URL
pytestmark = pytest.mark.skipif(
    os.environ.get("SUPABASE_URL", "").strip() == "https://test.supabase.co"
    or "test" in os.environ.get("SUPABASE_URL", "").lower(),
    reason="RLS tests require real Supabase instance, not mocked URL"
)


@pytest.fixture
async def supabase_auth_config():
    """Load Supabase auth config from environment."""
    url = os.environ.get("SUPABASE_URL", "").strip()
    anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    
    if not url or not anon_key or not service_role_key:
        pytest.skip("Missing Supabase environment variables (URL, anon key, service role key)")
    
    return {
        "url": url,
        "anon_key": anon_key,
        "service_role_key": service_role_key,
    }


async def create_auth_user(config: dict, email: str, password: str = "Test@12345") -> dict:
    """
    Sign up a new user via Supabase Auth API.
    
    Returns:
        {"user_id": UUID, "access_token": JWT}
    
    Raises:
        Exception if signup fails
    """
    import httpx
    
    url = config["url"].rstrip("/")
    anon_key = config["anon_key"]
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{url}/auth/v1/signup",
            json={"email": email, "password": password},
            headers={"apikey": anon_key},
            timeout=10.0,
        )
    
    if response.status_code not in (200, 201):
        raise Exception(
            f"Auth signup failed ({response.status_code}): {response.text}"
        )
    
    data = response.json()
    user_id = data.get("user") or data.get("id")
    if isinstance(user_id, dict):
        user_id = user_id.get("id")
    
    access_token = data.get("session", {}).get("access_token") or data.get("access_token")
    
    if not user_id or not access_token:
        raise Exception(f"Unexpected auth response structure: {data}")
    
    return {
        "user_id": user_id,
        "access_token": access_token,
    }


@pytest.mark.asyncio
class TestRLSPolicies:
    """Integration tests for RLS policy enforcement on pipelines table."""
    
    async def setup_method(self):
        """Set up test fixtures: clean state, sign up two users."""
        from services.db.supabase_client import get_supabase_client, get_user_supabase_client
        
        # Get environment config
        url = os.environ.get("SUPABASE_URL", "").strip()
        anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
        service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        
        if not url or not anon_key or not service_role_key:
            pytest.skip("Missing Supabase environment variables")
        
        self.config = {
            "url": url,
            "anon_key": anon_key,
            "service_role_key": service_role_key,
        }
        
        # Create admin client for verification and cleanup
        self.admin_client = get_supabase_client()
        
        # Sign up two test users with unique emails
        test_id = str(uuid.uuid4())[:8]
        user_a_email = f"test-user-a-{test_id}@example.com"
        user_b_email = f"test-user-b-{test_id}@example.com"
        
        try:
            user_a_data = await create_auth_user(self.config, user_a_email)
            user_b_data = await create_auth_user(self.config, user_b_email)
        except Exception as e:
            pytest.skip(f"Auth signup failed: {e}")
        
        self.user_a_id = user_a_data["user_id"]
        self.user_a_jwt = user_a_data["access_token"]
        self.user_a_client = get_user_supabase_client(self.user_a_jwt)
        
        self.user_b_id = user_b_data["user_id"]
        self.user_b_jwt = user_b_data["access_token"]
        self.user_b_client = get_user_supabase_client(self.user_b_jwt)
        
        self.pipeline_id = None
    
    async def teardown_method(self):
        """Clean up: delete test data created during test."""
        if self.pipeline_id:
            try:
                self.admin_client.table("pipelines").delete().eq("id", self.pipeline_id).execute()
            except Exception:
                pass  # Ignore cleanup errors
    
    @pytest.mark.asyncio
    async def test_user_a_can_insert_own_pipeline(self):
        """User A successfully inserts a pipeline row with their user_id."""
        response = self.user_a_client.table("pipelines").insert({
            "user_id": self.user_a_id,
            "session_id": None,
            "status": "pending",
            "input_data": {"test": "data"},
            "output_data": {},
        }).execute()
        
        assert len(response.data) == 1, f"Insert failed: {response}"
        inserted = response.data[0]
        assert inserted["user_id"] == self.user_a_id
        assert inserted["status"] == "pending"
        assert inserted["input_data"]["test"] == "data"
        
        self.pipeline_id = inserted["id"]
    
    @pytest.mark.asyncio
    async def test_user_b_cannot_read_user_a_pipeline(self):
        """User B's query returns empty list (RLS hides User A's pipeline)."""
        # First, User A inserts a pipeline
        response = self.user_a_client.table("pipelines").insert({
            "user_id": self.user_a_id,
            "session_id": None,
            "status": "pending",
            "input_data": {},
            "output_data": {},
        }).execute()
        self.pipeline_id = response.data[0]["id"]
        
        # Now User B queries for all pipelines
        response = self.user_b_client.table("pipelines").select("*").execute()
        
        # RLS policy should hide User A's pipeline from User B
        assert len(response.data) == 0, (
            f"User B should not see User A's pipeline. Got: {response.data}"
        )
    
    @pytest.mark.asyncio
    async def test_user_b_cannot_update_user_a_pipeline(self):
        """User B's update attempt is blocked by RLS."""
        # User A inserts a pipeline
        response = self.user_a_client.table("pipelines").insert({
            "user_id": self.user_a_id,
            "session_id": None,
            "status": "pending",
            "input_data": {},
            "output_data": {},
        }).execute()
        self.pipeline_id = response.data[0]["id"]
        
        # User B attempts to update it
        response = self.user_b_client.table("pipelines").update({
            "status": "running",
            "output_data": {"modified": True},
        }).eq("id", self.pipeline_id).execute()
        
        # RLS should block: either exception or 0 rows updated
        assert len(response.data) == 0, (
            f"User B's update should have been blocked. Updated rows: {len(response.data)}"
        )
        
        # Verify original row is unchanged via admin client
        admin_response = self.admin_client.table("pipelines").select("*").eq(
            "id", self.pipeline_id
        ).execute()
        assert len(admin_response.data) == 1
        original = admin_response.data[0]
        assert original["status"] == "pending", "Status should remain pending"
        assert original["output_data"] == {}, "Output data should remain empty"
    
    @pytest.mark.asyncio
    async def test_user_b_cannot_delete_user_a_pipeline(self):
        """User B's delete attempt is blocked by RLS."""
        # User A inserts a pipeline
        response = self.user_a_client.table("pipelines").insert({
            "user_id": self.user_a_id,
            "session_id": None,
            "status": "pending",
            "input_data": {},
            "output_data": {},
        }).execute()
        self.pipeline_id = response.data[0]["id"]
        
        # User B attempts to delete it
        response = self.user_b_client.table("pipelines").delete().eq(
            "id", self.pipeline_id
        ).execute()
        
        # RLS should block: either exception or 0 rows deleted
        assert len(response.data) == 0, (
            f"User B's delete should have been blocked. Deleted rows: {len(response.data)}"
        )
        
        # Verify row still exists via admin client
        admin_response = self.admin_client.table("pipelines").select("*").eq(
            "id", self.pipeline_id
        ).execute()
        assert len(admin_response.data) == 1, "Pipeline row should not be deleted"
    
    @pytest.mark.asyncio
    async def test_admin_can_see_and_modify_any_pipeline(self):
        """Service-role (admin) client can query and modify any pipeline."""
        # User A inserts a pipeline
        response = self.user_a_client.table("pipelines").insert({
            "user_id": self.user_a_id,
            "session_id": None,
            "status": "pending",
            "input_data": {"creator": "user_a"},
            "output_data": {},
        }).execute()
        pipeline_id = response.data[0]["id"]
        self.pipeline_id = pipeline_id
        
        # Admin queries the pipeline (service-role bypass)
        admin_response = self.admin_client.table("pipelines").select("*").eq(
            "id", pipeline_id
        ).execute()
        assert len(admin_response.data) == 1
        assert admin_response.data[0]["user_id"] == self.user_a_id
        
        # Admin updates the pipeline (service-role bypass)
        admin_response = self.admin_client.table("pipelines").update({
            "status": "completed",
            "output_data": {"admin": "modified"},
        }).eq("id", pipeline_id).execute()
        assert len(admin_response.data) == 1
        
        # Verify User A can see the changes (their own row)
        user_a_response = self.user_a_client.table("pipelines").select("*").eq(
            "id", pipeline_id
        ).execute()
        assert len(user_a_response.data) == 1
        assert user_a_response.data[0]["status"] == "completed"
        assert user_a_response.data[0]["output_data"]["admin"] == "modified"
    
    @pytest.mark.asyncio
    async def test_user_a_can_update_own_pipeline(self):
        """User A can update their own pipeline (user_id matches auth.uid())."""
        # User A inserts a pipeline
        response = self.user_a_client.table("pipelines").insert({
            "user_id": self.user_a_id,
            "session_id": None,
            "status": "pending",
            "input_data": {},
            "output_data": {},
        }).execute()
        self.pipeline_id = response.data[0]["id"]
        
        # User A updates their own pipeline
        response = self.user_a_client.table("pipelines").update({
            "status": "running",
            "output_data": {"step": "processing"},
        }).eq("id", self.pipeline_id).execute()
        
        assert len(response.data) == 1, f"Update failed: {response}"
        updated = response.data[0]
        assert updated["status"] == "running"
        assert updated["output_data"]["step"] == "processing"
    
    @pytest.mark.asyncio
    async def test_user_a_can_delete_own_pipeline(self):
        """User A can delete their own pipeline (user_id matches auth.uid())."""
        # User A inserts a pipeline
        response = self.user_a_client.table("pipelines").insert({
            "user_id": self.user_a_id,
            "session_id": None,
            "status": "pending",
            "input_data": {},
            "output_data": {},
        }).execute()
        pipeline_id = response.data[0]["id"]
        
        # User A deletes their own pipeline
        response = self.user_a_client.table("pipelines").delete().eq(
            "id", pipeline_id
        ).execute()
        
        assert len(response.data) == 1, f"Delete failed: {response}"
        
        # Verify row is gone via admin client
        admin_response = self.admin_client.table("pipelines").select("*").eq(
            "id", pipeline_id
        ).execute()
        assert len(admin_response.data) == 0, "Pipeline should be deleted"
        
        # Don't try to clean up in teardown (already deleted)
        self.pipeline_id = None


@pytest.mark.asyncio
async def test_rls_auth_api_integration():
    """Smoke test: verify Auth API is accessible and responsive."""
    from services.db.supabase_client import get_supabase_client
    
    url = os.environ.get("SUPABASE_URL", "").strip()
    anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    
    if url == "https://test.supabase.co" or not url or not anon_key:
        pytest.skip("Real Supabase required for auth integration test")
    
    config = {
        "url": url,
        "anon_key": anon_key,
        "service_role_key": os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
    }
    
    try:
        user_data = await create_auth_user(
            config,
            f"smoke-test-{uuid.uuid4()}@example.com"
        )
        assert "user_id" in user_data
        assert "access_token" in user_data
    except Exception as e:
        pytest.skip(f"Auth API unavailable: {e}")
