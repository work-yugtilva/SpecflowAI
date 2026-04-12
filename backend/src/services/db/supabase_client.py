# services/db/supabase_client.py

import os
import httpx
import asyncio
from cachetools import TTLCache
from supabase import create_client, Client

from services.config.load_env import load_root_env
load_root_env()

_client: Client | None = None
_jwt_cache: TTLCache = TTLCache(maxsize=500, ttl=60)


def _read_supabase_url() -> str | None:
    return os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")


def _read_supabase_anon_key() -> str | None:
    return os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")


def get_supabase_client() -> Client:
    """Return a singleton Supabase client using service role credentials."""
    global _client
    if _client is None:
        url = _read_supabase_url()
        key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or _read_supabase_anon_key()
        )
        if not url or not key:
            raise RuntimeError(
                "Missing Supabase environment variables. Set SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY in the repo root .env before using the pipeline backend."
            )
        _client = create_client(url, key)
    return _client


async def verify_supabase_jwt(jwt: str) -> str:
    """
    Verify a Supabase access token against the Auth API and return the user id.
    This avoids trusting unsigned JWT payload fields inside request handlers.
    Uses async httpx to avoid blocking the event loop.
    Results are cached in-memory (TTL=60s, max 500 entries) to eliminate
    redundant round-trips on back-to-back requests.
    """
    cached = _jwt_cache.get(jwt)
    if cached is not None:
        return cached

    url = _read_supabase_url()
    key = _read_supabase_anon_key()
    if not url or not key:
        raise RuntimeError(
            "Missing Supabase environment variables. Set SUPABASE_URL and "
            "SUPABASE_ANON_KEY in the repo root .env."
        )

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{url.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {jwt}",
            },
            timeout=5.0,
        )
    if response.status_code != 200:
        raise ValueError("Invalid or expired token")

    payload = response.json()
    user_id = payload.get("id")
    if not user_id:
        raise ValueError("Verified token missing user id")
    _jwt_cache[jwt] = str(user_id)
    return str(user_id)


def get_user_supabase_client(jwt: str) -> Client:
    """
    Return a fresh Supabase client scoped to the given user JWT.
    Uses the anon key so Supabase RLS policies (user_id = auth.uid()) are enforced.
    Creates a new client per call — do NOT use as a singleton.
    """
    url = _read_supabase_url()
    key = _read_supabase_anon_key()
    if not url or not key:
        raise RuntimeError(
            "Missing Supabase environment variables. Set SUPABASE_URL and "
            "SUPABASE_ANON_KEY in the repo root .env."
        )
    client = create_client(url, key)
    client.postgrest.auth(jwt)
    return client
