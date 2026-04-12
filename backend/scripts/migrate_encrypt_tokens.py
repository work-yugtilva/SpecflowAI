"""
Run once manually: python -m backend.scripts.migrate_encrypt_tokens
Requires TOKEN_ENCRYPTION_KEY env var. Never run automatically.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

from supabase import Client, create_client


def _ensure_backend_src_on_path() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    backend_src = repo_root / "backend" / "src"
    if str(backend_src) not in sys.path:
        sys.path.insert(0, str(backend_src))


_ensure_backend_src_on_path()

from services.config.load_env import load_root_env
from services.security.token_encryption import decrypt_token, encrypt_token

INTERNAL_REFRESH_KEY = "_encrypted_refresh_token"


def _is_encrypted(value: str) -> bool:
    try:
        decrypt_token(value)
        return True
    except ValueError:
        return False


def _workspace_info(row: dict[str, Any]) -> dict[str, Any]:
    raw = row.get("workspace_info")
    if isinstance(raw, dict):
        return dict(raw)
    return {}


def _get_service_role_client() -> Client:
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    service_role_key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not service_role_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for token migration"
        )
    return create_client(url, service_role_key)


def main() -> None:
    load_root_env()
    client = _get_service_role_client()

    migrated = 0
    skipped = 0
    errors = 0

    result = client.table("user_integrations").select("*").execute()
    rows = result.data or []

    for row in rows:
        try:
            row_id = row.get("id")
            if not row_id:
                skipped += 1
                continue

            updates: dict[str, Any] = {}

            access_token = row.get("access_token")
            if isinstance(access_token, str) and access_token:
                if not _is_encrypted(access_token):
                    updates["access_token"] = encrypt_token(access_token)

            # Support either a refresh_token column (if present in deployment)
            # or refresh token data inside workspace_info.
            workspace_info = _workspace_info(row)
            workspace_changed = False

            refresh_col_present = "refresh_token" in row
            refresh_from_column = row.get("refresh_token") if refresh_col_present else None
            if isinstance(refresh_from_column, str) and refresh_from_column:
                if not _is_encrypted(refresh_from_column):
                    updates["refresh_token"] = encrypt_token(refresh_from_column)

            refresh_internal = workspace_info.get(INTERNAL_REFRESH_KEY)
            if isinstance(refresh_internal, str) and refresh_internal:
                if not _is_encrypted(refresh_internal):
                    workspace_info[INTERNAL_REFRESH_KEY] = encrypt_token(refresh_internal)
                    workspace_changed = True

            refresh_plain = workspace_info.get("refresh_token")
            if isinstance(refresh_plain, str) and refresh_plain:
                if _is_encrypted(refresh_plain):
                    workspace_info[INTERNAL_REFRESH_KEY] = refresh_plain
                else:
                    workspace_info[INTERNAL_REFRESH_KEY] = encrypt_token(refresh_plain)
                workspace_info.pop("refresh_token", None)
                workspace_changed = True

            if workspace_changed:
                updates["workspace_info"] = workspace_info

            if not updates:
                skipped += 1
                continue

            client.table("user_integrations").update(updates).eq("id", row_id).execute()
            migrated += 1
        except Exception as exc:
            print(f"Error migrating row {row.get('id', '<unknown>')}: {type(exc).__name__}")
            errors += 1

    print(f"Migrated: {migrated}")
    print(f"Skipped: {skipped}")
    print(f"Errors: {errors}")


if __name__ == "__main__":
    main()
