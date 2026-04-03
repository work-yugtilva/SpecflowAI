"""
Unit tests for verify_supabase_jwt in supabase_client.py.
Mocks httpx.AsyncClient to avoid real network calls.
"""
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.db.supabase_client import verify_supabase_jwt


def _mock_response(status_code: int, payload: dict):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = payload
    return resp


def _patched_client(response):
    """Returns (mock_client, patch_ctx) where get() returns `response`."""
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_ctx = MagicMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_client)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)
    return mock_client, patch("httpx.AsyncClient", return_value=mock_ctx)


@pytest.mark.asyncio
async def test_verify_jwt_returns_user_id():
    resp = _mock_response(200, {"id": "user-abc"})
    _, ctx = _patched_client(resp)
    with ctx:
        result = await verify_supabase_jwt("tok123")
    assert result == "user-abc"


@pytest.mark.asyncio
async def test_verify_jwt_sends_correct_headers():
    resp = _mock_response(200, {"id": "user-abc"})
    mock_client, ctx = _patched_client(resp)
    with ctx:
        await verify_supabase_jwt("my-jwt-token")
    call_kwargs = mock_client.get.call_args
    headers = (
        call_kwargs.kwargs.get("headers")
        or (call_kwargs[1] or {}).get("headers")
        or (call_kwargs[0][1] if len(call_kwargs[0]) > 1 else {})
    )
    assert headers["Authorization"] == "Bearer my-jwt-token"
    assert "apikey" in headers


@pytest.mark.asyncio
async def test_verify_jwt_raises_on_401():
    resp = _mock_response(401, {})
    _, ctx = _patched_client(resp)
    with ctx, pytest.raises(ValueError, match="Invalid or expired token"):
        await verify_supabase_jwt("bad-token")


@pytest.mark.asyncio
async def test_verify_jwt_raises_on_non_200():
    resp = _mock_response(500, {})
    _, ctx = _patched_client(resp)
    with ctx, pytest.raises(ValueError, match="Invalid or expired token"):
        await verify_supabase_jwt("any-token")


@pytest.mark.asyncio
async def test_verify_jwt_raises_when_id_missing():
    resp = _mock_response(200, {"email": "user@example.com"})  # no "id" key
    _, ctx = _patched_client(resp)
    with ctx, pytest.raises(ValueError, match="missing user id"):
        await verify_supabase_jwt("tok-no-id")


@pytest.mark.asyncio
async def test_verify_jwt_raises_when_env_missing():
    with patch.dict(
        os.environ,
        {"SUPABASE_URL": "", "NEXT_PUBLIC_SUPABASE_URL": ""},
        clear=False,
    ):
        with pytest.raises(RuntimeError, match="Missing Supabase environment variables"):
            await verify_supabase_jwt("any-token")
