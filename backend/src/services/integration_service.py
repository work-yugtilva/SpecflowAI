from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from supabase import AsyncClient

try:
    from services.security.token_encryption import decrypt_token, encrypt_token
except ModuleNotFoundError:  # pragma: no cover - allows backend.src.* imports
    from backend.src.services.security.token_encryption import (
        decrypt_token,
        encrypt_token,
    )

TABLE = "user_integrations"
INTERNAL_REFRESH_KEY = "_encrypted_refresh_token"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _workspace_dict(metadata: dict | None) -> dict[str, Any]:
    if isinstance(metadata, dict):
        return dict(metadata)
    return {}


def _sanitize_workspace_info(workspace_info: dict[str, Any]) -> dict[str, Any]:
    out = dict(workspace_info)
    out.pop(INTERNAL_REFRESH_KEY, None)
    return out


def _public_row_without_tokens(row: dict[str, Any]) -> dict[str, Any]:
    public = dict(row)
    public.pop("access_token", None)
    public.pop("refresh_token", None)
    workspace_info = _workspace_dict(public.get("workspace_info"))
    public["workspace_info"] = _sanitize_workspace_info(workspace_info)
    return public


async def _fetch_existing(
    client: AsyncClient, user_id: str, provider: str
) -> dict[str, Any] | None:
    result = (
        await client.table(TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("provider", provider)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


async def save_integration(
    client: AsyncClient,
    user_id: str,
    provider: str,
    access_token: str,
    refresh_token: str | None,
    metadata: dict | None = None,
) -> dict:
    """
    Encrypts access_token and refresh_token, then upserts into user_integrations.
    Returns the saved row (without decrypted tokens).
    """
    if not provider.strip():
        raise ValueError("provider is required")
    if not access_token:
        raise ValueError("access_token is required")

    existing = await _fetch_existing(client, user_id, provider)
    existing_workspace = _workspace_dict(
        existing.get("workspace_info") if isinstance(existing, dict) else None
    )

    workspace_info = _workspace_dict(metadata)
    if refresh_token:
        workspace_info[INTERNAL_REFRESH_KEY] = encrypt_token(refresh_token)
    elif INTERNAL_REFRESH_KEY in existing_workspace:
        workspace_info[INTERNAL_REFRESH_KEY] = existing_workspace[INTERNAL_REFRESH_KEY]

    payload: dict[str, Any] = {
        "user_id": user_id,
        "provider": provider,
        "access_token": encrypt_token(access_token),
        "workspace_info": workspace_info,
        "updated_at": _utc_now_iso(),
    }

    # Keep compatibility with deployments that might include a refresh_token column.
    if refresh_token and isinstance(existing, dict) and "refresh_token" in existing:
        payload["refresh_token"] = encrypt_token(refresh_token)

    result = (
        await client.table(TABLE)
        .upsert(payload, on_conflict="user_id,provider")
        .execute()
    )

    rows = result.data or []
    saved = rows[0] if rows else payload
    return _public_row_without_tokens(saved)


async def get_integration(
    client: AsyncClient, user_id: str, provider: str
) -> dict | None:
    """
    Fetches the integration row and returns it with access_token and refresh_token DECRYPTED.
    Returns None if not found. Raises ValueError if decryption fails
    (token corrupted or key rotated).
    """
    row = await _fetch_existing(client, user_id, provider)
    if not row:
        return None

    encrypted_access = row.get("access_token")
    if not isinstance(encrypted_access, str) or not encrypted_access:
        raise ValueError("Missing encrypted access token")

    decrypted_access = decrypt_token(encrypted_access)

    workspace_info = _workspace_dict(row.get("workspace_info"))
    encrypted_refresh: str | None = None

    refresh_from_column = row.get("refresh_token")
    if isinstance(refresh_from_column, str) and refresh_from_column:
        encrypted_refresh = refresh_from_column
    else:
        candidate = workspace_info.get(INTERNAL_REFRESH_KEY)
        if isinstance(candidate, str) and candidate:
            encrypted_refresh = candidate

    decrypted_refresh = decrypt_token(encrypted_refresh) if encrypted_refresh else None

    public = dict(row)
    public["access_token"] = decrypted_access
    public["refresh_token"] = decrypted_refresh
    public["workspace_info"] = _sanitize_workspace_info(workspace_info)
    return public


async def delete_integration(
    client: AsyncClient, user_id: str, provider: str
) -> None:
    """Deletes the integration row for this user+provider."""
    await (
        client.table(TABLE)
        .delete()
        .eq("user_id", user_id)
        .eq("provider", provider)
        .execute()
    )
