# services/memory/memory_repository.py

import asyncio
import logging
from typing import Any, List, Optional
from services.db.supabase_async import first_row_from_result, rows_from_result, run_sync
from services.db.supabase_client import get_supabase_client
from services.memory.memory_schemas import MemoryEntry

logger = logging.getLogger(__name__)

TABLE = "memory_entries"


def _is_missing_user_id_column_error(error: Exception) -> bool:
    message = str(error)
    return (
        "PGRST204" in message
        and "'user_id' column" in message
        and f"'{TABLE}'" in message
    )


class MemoryRepository:
    """
    Persistence layer for memory entries.
    Uses Supabase Python client for CRUD operations.
    All queries are dynamic — no hardcoded keys or agent names.
    """

    def __init__(self, client=None):
        self.client = client or get_supabase_client()

    @staticmethod
    def _without_user_id(data: dict) -> dict:
        if "user_id" not in data:
            return data
        sanitized = dict(data)
        sanitized.pop("user_id", None)
        return sanitized

    async def _retry_async(
        self,
        fn,
        retries: int = 3,
        delays: tuple = (0.5, 1.0, 2.0),
    ):
        """
        Execute async function with exponential backoff retry.
        
        Args:
            fn: Async callable to execute
            retries: Number of retry attempts (default 3)
            delays: Tuple of delays in seconds between retries
        
        Returns:
            Result of successful fn execution
            
        Raises:
            Last exception if all retries exhausted
        """
        last_exception = None
        for attempt in range(1, retries + 1):
            try:
                return await fn()
            except Exception as e:
                last_exception = e
                if attempt < retries:
                    delay = delays[attempt - 1] if attempt - 1 < len(delays) else delays[-1]
                    logger.warning(
                        f"Supabase save attempt {attempt} failed: {e}. "
                        f"Retrying in {delay}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.warning(
                        f"Supabase save attempt {attempt} failed: {e}. "
                        f"All {retries} retries exhausted."
                    )
        raise last_exception

    async def save(self, entry: MemoryEntry) -> MemoryEntry:
        """
        Upsert a memory entry using (project_id, memory_key) as
        the conflict target — no duplicate rows per project+key.
        """
        data = entry.model_dump(
            exclude_none=True,
            exclude={"created_at", "updated_at"},
        )

        async def _upsert_with_fallback():
            def _upsert():
                return self.client.table(TABLE).upsert(
                    data, on_conflict="project_id,memory_key"
                ).execute()
            try:
                result = await run_sync(_upsert)
            except Exception as exc:
                if not _is_missing_user_id_column_error(exc):
                    raise

                fallback_data = self._without_user_id(data)

                def _fallback_upsert():
                    return self.client.table(TABLE).upsert(
                        fallback_data, on_conflict="project_id,memory_key"
                    ).execute()

                result = await run_sync(_fallback_upsert)
            return result

        result = await self._retry_async(_upsert_with_fallback)
        rows = rows_from_result(result)
        if rows:
            return MemoryEntry(**rows[0])
        return entry

    async def get_by_project(self, project_id: str) -> List[MemoryEntry]:
        """Get all memory entries for a project."""

        def _select():
            return (
                self.client.table(TABLE)
                .select("*")
                .eq("project_id", project_id)
                .order("created_at", desc=False)
                .execute()
            )

        result = await run_sync(_select)
        return [MemoryEntry(**row) for row in rows_from_result(result)]

    async def get_by_key(
        self, project_id: str, key: str
    ) -> Optional[MemoryEntry]:
        """Get a single memory entry by project and key."""

        def _select():
            return (
                self.client.table(TABLE)
                .select("*")
                .eq("project_id", project_id)
                .eq("memory_key", key)
                .limit(1)
                .execute()
            )

        result = await run_sync(_select)

        row = first_row_from_result(result)
        if row is None:
            return None
        return MemoryEntry(**row)

    async def append_to_key(
        self,
        project_id: str,
        key: str,
        value: Any,
        agent_name: str,
    ) -> MemoryEntry:
        """
        Append a value to an existing memory entry's content.
        If the entry doesn't exist, create it.
        """
        existing = await self.get_by_key(project_id, key)

        if existing is None:
            entry = MemoryEntry(
                project_id=project_id,
                agent_name=agent_name,
                memory_key=key,
                content={"data": value} if not isinstance(value, dict) else value,
            )
            return await self.save(entry)

        content = existing.content
        if isinstance(content, dict) and "items" in content and isinstance(content["items"], list):
            content["items"].append(value)
        elif isinstance(content, dict) and isinstance(value, dict):
            content.update(value)
        else:
            content = {"items": [content, value]} if content else {"items": [value]}

        existing.content = content
        existing.agent_name = agent_name
        return await self.save(existing)

    async def delete_by_project(self, project_id: str) -> None:
        """Delete all memory entries for a project."""

        def _delete():
            return (
                self.client.table(TABLE)
                .delete()
                .eq("project_id", project_id)
                .execute()
            )

        await run_sync(_delete)

    async def save_for_session(self, entry: MemoryEntry) -> MemoryEntry:
        """
        Upsert a memory entry scoped by session_id.
        Conflict target: (session_id, memory_key) using the partial unique index
        created in the session migration.
        entry.session_id must be set.
        """
        data = entry.model_dump(
            exclude_none=True,
            exclude={"created_at", "updated_at"},
        )

        async def _upsert_with_fallback():
            def _upsert():
                return self.client.table(TABLE).upsert(
                    data, on_conflict="session_id,memory_key"
                ).execute()
            try:
                result = await run_sync(_upsert)
            except Exception as exc:
                if not _is_missing_user_id_column_error(exc):
                    raise

                fallback_data = self._without_user_id(data)

                def _fallback_upsert():
                    return self.client.table(TABLE).upsert(
                        fallback_data, on_conflict="session_id,memory_key"
                    ).execute()

                result = await run_sync(_fallback_upsert)
            return result

        result = await self._retry_async(_upsert_with_fallback)
        rows = rows_from_result(result)
        if rows:
            return MemoryEntry(**rows[0])
        return entry

    async def get_by_session(self, session_id: str) -> List[MemoryEntry]:
        """Get all memory entries for a session."""

        def _select():
            return (
                self.client.table(TABLE)
                .select("*")
                .eq("session_id", session_id)
                .order("created_at", desc=False)
                .execute()
            )

        result = await run_sync(_select)
        return [MemoryEntry(**row) for row in rows_from_result(result)]

    async def get_by_session_and_key(
        self, session_id: str, key: str
    ) -> Optional[MemoryEntry]:
        """Get a single memory entry by session and key."""

        def _select():
            return (
                self.client.table(TABLE)
                .select("*")
                .eq("session_id", session_id)
                .eq("memory_key", key)
                .limit(1)
                .execute()
            )

        result = await run_sync(_select)
        row = first_row_from_result(result)
        if row is None:
            return None
        return MemoryEntry(**row)

    async def delete_by_key(self, project_id: str, key: str) -> None:
        """Delete a specific memory entry."""

        def _delete():
            return (
                self.client.table(TABLE)
                .delete()
                .eq("project_id", project_id)
                .eq("memory_key", key)
                .execute()
            )

        await run_sync(_delete)
