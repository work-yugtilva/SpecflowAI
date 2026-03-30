# services/db/supabase_client.py

import os
from supabase import create_client, Client

from services.config.load_env import load_root_env

load_root_env()

_client: Client | None = None


def get_supabase_client() -> Client:
    """Return a singleton Supabase client using service role credentials."""
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_ANON_KEY")
            or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        )
        if not url or not key:
            raise RuntimeError(
                "Missing Supabase environment variables. Set SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY in the repo root .env before using the pipeline backend."
            )
        _client = create_client(url, key)
    return _client


def get_user_integration(user_id: str, provider: str) -> dict | None:
    """Return a user_integrations row for (user_id, provider), or None if not found."""
    client = get_supabase_client()
    result = (
        client.table("user_integrations")
        .select("*")
        .eq("user_id", user_id)
        .eq("provider", provider)
        .maybe_single()
        .execute()
    )
    return result.data if result else None
