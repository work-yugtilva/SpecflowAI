import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any

from fastapi import Header, HTTPException, Request
from supabase import AsyncClient, acreate_client

from services.config.load_env import load_root_env
from services.db.supabase_client import get_user_supabase_client

load_root_env()

logger = logging.getLogger(__name__)

# IMPORTANT: This client is ONLY for auth.get_user() token verification.
# It uses the service-role key. Never use it for data reads — it bypasses RLS.
_auth_verification_client: AsyncClient | None = None
_client_lock = asyncio.Lock()


def _read_supabase_url() -> str | None:
    return os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")


def _read_service_role_key() -> str | None:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


async def _get_async_supabase_client() -> AsyncClient:
    global _auth_verification_client
    if _auth_verification_client is not None:
        return _auth_verification_client

    async with _client_lock:
        if _auth_verification_client is not None:
            return _auth_verification_client

        url = _read_supabase_url()
        service_role_key = _read_service_role_key()
        if not url or not service_role_key:
            raise HTTPException(
                status_code=401,
                detail="Missing Supabase environment variables",
            )

        _auth_verification_client = await acreate_client(url, service_role_key)
        return _auth_verification_client


@dataclass
class SupabaseUser:
    id: str
    email: str
    role: str
    user_id: str
    client: Any


async def verify_supabase_token(authorization: str | None) -> SupabaseUser:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    client = await _get_async_supabase_client()
    try:
        response = await client.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    user = response.user if response else None
    if user is None:
        error_message = "Invalid or expired token"
        error_obj = getattr(response, "error", None) if response else None
        if error_obj is not None:
            error_message = getattr(error_obj, "message", error_message) or error_message
        raise HTTPException(status_code=401, detail=error_message)

    role = getattr(user, "role", "") or ""
    logger.debug("FastAPI auth verified user_id=%s", user.id)
    return SupabaseUser(
        id=str(user.id),
        email=str(getattr(user, "email", "") or ""),
        role=str(role),
        user_id=str(user.id),
        client=get_user_supabase_client(token),
    )


async def require_auth(
    request: Request,
    authorization: str = Header(None),
) -> SupabaseUser:
    user = await verify_supabase_token(authorization)
    request.state.user = user
    return user
